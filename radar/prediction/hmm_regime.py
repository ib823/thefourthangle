"""HMM Regime Detector — 4-state controversy lifecycle model.

Reference: fourth-angle-controversy-radar-framework.md §3.2.

States (canonical ordering):
    0 STABLE             normal discourse
    1 PRE_CONTROVERSY    early-warning — alerts fire here
    2 ACTIVE             controversy in progress
    3 POST_CONTROVERSY   aftermath / decay

Observables (3-dim Gaussian):
    volume_z_score        deseasonalized mention-count z-score
    sentiment_divergence  max pairwise community sentiment gap [0, 1]
    er_index              Esteban-Ray polarization index       [0, 1]

Training: Baum-Welch (hmmlearn.GaussianHMM.fit) seeded with framework
defaults so recovered states keep their canonical meaning.

Inference: forward-backward posteriors P(state_t | obs_1..T) and Viterbi.

Alerts: P(PRE_CONTROVERSY | obs) > alert_threshold fires an escalation
warning. Expected dwell time in state i: E[dwell] = 1 / (1 - a_ii).
"""

from __future__ import annotations

import json
import pickle
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from hmmlearn import hmm

STATE_NAMES = ["STABLE", "PRE_CONTROVERSY", "ACTIVE", "POST_CONTROVERSY"]
STATE_INDEX = {name: i for i, name in enumerate(STATE_NAMES)}
N_STATES = 4
N_FEATURES = 3

# Framework §3.2 defaults. Rows sum to 1.0.
FRAMEWORK_TRANSMAT = np.array([
    [0.90, 0.08, 0.01, 0.01],  # STABLE
    [0.20, 0.55, 0.23, 0.02],  # PRE_CONTROVERSY
    [0.02, 0.03, 0.80, 0.15],  # ACTIVE
    [0.40, 0.05, 0.05, 0.50],  # POST_CONTROVERSY
])

# Emission means: (volume_z, sentiment_div, er_index)
FRAMEWORK_MEANS = np.array([
    [0.0, 0.10, 0.10],  # STABLE
    [1.8, 0.40, 0.40],  # PRE_CONTROVERSY
    [3.5, 0.80, 0.75],  # ACTIVE
    [0.8, 0.55, 0.60],  # POST_CONTROVERSY
])

# Diagonal covariances; volume_z has larger spread than the bounded indices.
FRAMEWORK_COVARS = np.array([
    [1.00, 0.05, 0.05],
    [1.00, 0.08, 0.08],
    [1.50, 0.08, 0.08],
    [1.00, 0.08, 0.08],
])

FRAMEWORK_STARTPROB = np.array([0.85, 0.08, 0.04, 0.03])


@dataclass
class RegimePrediction:
    """Per-topic regime inference result."""

    posteriors: np.ndarray        # shape (T, 4) — P(state_t | obs_1..T)
    viterbi: np.ndarray           # shape (T,)  — most likely path
    current_state: str            # STATE_NAMES[argmax(posteriors[-1])]
    current_posterior: dict       # {state_name: probability}
    log_likelihood: float

    def to_dict(self) -> dict:
        return {
            "current_state": self.current_state,
            "current_posterior": self.current_posterior,
            "viterbi_path": [STATE_NAMES[s] for s in self.viterbi.tolist()],
            "log_likelihood": float(self.log_likelihood),
        }


class HMMRegimeDetector:
    """4-state controversy-lifecycle HMM over (volume_z, sent_div, er_index)."""

    def __init__(
        self,
        alert_threshold: float = 0.5,
        transmat: np.ndarray | None = None,
        means: np.ndarray | None = None,
        covars: np.ndarray | None = None,
        startprob: np.ndarray | None = None,
        random_state: int = 42,
    ):
        self.alert_threshold = alert_threshold
        self.random_state = random_state

        self.transmat = np.array(transmat if transmat is not None else FRAMEWORK_TRANSMAT, dtype=float)
        self.means = np.array(means if means is not None else FRAMEWORK_MEANS, dtype=float)
        self.covars = np.array(covars if covars is not None else FRAMEWORK_COVARS, dtype=float)
        self.startprob = np.array(startprob if startprob is not None else FRAMEWORK_STARTPROB, dtype=float)

        self._validate_params()
        self.model = self._build_model(fit_params="")
        self._fitted = False  # True once Baum-Welch has run

    def _validate_params(self):
        if self.transmat.shape != (N_STATES, N_STATES):
            raise ValueError(f"transmat shape {self.transmat.shape} != ({N_STATES},{N_STATES})")
        if not np.allclose(self.transmat.sum(axis=1), 1.0, atol=1e-6):
            raise ValueError("transmat rows must sum to 1")
        if self.means.shape != (N_STATES, N_FEATURES):
            raise ValueError(f"means shape {self.means.shape} != ({N_STATES},{N_FEATURES})")
        if self.covars.shape != (N_STATES, N_FEATURES):
            raise ValueError(f"covars shape {self.covars.shape} != ({N_STATES},{N_FEATURES})")
        if np.any(self.covars <= 0):
            raise ValueError("diagonal covariances must be positive")
        if not np.isclose(self.startprob.sum(), 1.0, atol=1e-6):
            raise ValueError("startprob must sum to 1")

    def _build_model(self, fit_params: str) -> hmm.GaussianHMM:
        m = hmm.GaussianHMM(
            n_components=N_STATES,
            covariance_type="diag",
            init_params="",      # we seed all params manually
            params=fit_params,   # subset to update during fit()
            random_state=self.random_state,
            n_iter=50,
            tol=1e-3,
        )
        m.startprob_ = self.startprob.copy()
        m.transmat_ = self.transmat.copy()
        m.means_ = self.means.copy()
        m.covars_ = self.covars.copy()
        return m

    # ---- training ---------------------------------------------------------

    def fit(
        self,
        sequences: list[np.ndarray] | np.ndarray,
        params: str = "stmc",
    ) -> "HMMRegimeDetector":
        """Baum-Welch training.

        Args:
            sequences: list of per-topic observation arrays, each shape (T_i, 3),
                or a single 2D array shape (T, 3).
            params: which params to update — 's'tartprob, 't'ransmat, 'm'eans, 'c'ovars.
                Default updates all four. Use "mc" to freeze topology.
        """
        if isinstance(sequences, np.ndarray):
            if sequences.ndim != 2 or sequences.shape[1] != N_FEATURES:
                raise ValueError(f"single sequence must be shape (T, {N_FEATURES})")
            X = sequences
            lengths = [len(sequences)]
        else:
            if not sequences:
                raise ValueError("fit() requires at least one sequence")
            X = np.vstack(sequences)
            lengths = [len(s) for s in sequences]

        self.model = self._build_model(fit_params=params)
        self.model.fit(X, lengths=lengths)

        self._canonicalize_states()

        self.transmat = self.model.transmat_.copy()
        self.means = self.model.means_.copy()
        # hmmlearn returns covars_ as (n_states, n_features, n_features) full matrices
        # even for covariance_type="diag"; extract the diagonals we originally set.
        fitted_covars = self.model.covars_
        if fitted_covars.ndim == 3:
            self.covars = np.diagonal(fitted_covars, axis1=1, axis2=2).copy()
        else:
            self.covars = fitted_covars.reshape(N_STATES, N_FEATURES).copy()
        self.startprob = self.model.startprob_.copy()
        self._fitted = True
        return self

    def _canonicalize_states(self):
        """Permute trained states to match framework (STABLE, PRE, ACTIVE, POST) ordering.

        Baum-Welch has label-switching ambiguity. We find the permutation of
        trained states that minimises L2 distance to framework means, so
        downstream code can rely on index i ↔ STATE_NAMES[i].
        """
        from itertools import permutations

        best_perm = tuple(range(N_STATES))
        best_cost = float("inf")
        for perm in permutations(range(N_STATES)):
            cost = float(np.sum((self.model.means_[list(perm)] - FRAMEWORK_MEANS) ** 2))
            if cost < best_cost:
                best_cost = cost
                best_perm = perm

        if best_perm == tuple(range(N_STATES)):
            return

        perm = list(best_perm)
        self.model.startprob_ = self.model.startprob_[perm]
        self.model.transmat_ = self.model.transmat_[perm][:, perm]
        self.model.means_ = self.model.means_[perm]
        # Post-fit covars_ is (n_states, n_features, n_features); pre-fit it's (n_states, n_features).
        current_covars = self.model.covars_
        if current_covars.ndim == 3:
            diag = np.diagonal(current_covars, axis1=1, axis2=2)
        else:
            diag = current_covars
        self.model.covars_ = diag[perm]

    # ---- inference --------------------------------------------------------

    def predict_regime(self, observations: np.ndarray) -> RegimePrediction:
        """Forward-backward posteriors + Viterbi for one observation sequence.

        Args:
            observations: shape (T, 3) — rows are (volume_z, sent_div, er_index).

        Returns:
            RegimePrediction with smoothed posteriors, Viterbi path, and the
            current (last step) posterior distribution.
        """
        X = np.atleast_2d(np.asarray(observations, dtype=float))
        if X.shape[1] != N_FEATURES:
            raise ValueError(f"observations must have {N_FEATURES} cols, got {X.shape[1]}")

        log_lik, posteriors = self.model.score_samples(X)
        viterbi = self.model.predict(X)

        last = posteriors[-1]
        current_state = STATE_NAMES[int(np.argmax(last))]
        current_posterior = {STATE_NAMES[i]: float(last[i]) for i in range(N_STATES)}

        return RegimePrediction(
            posteriors=posteriors,
            viterbi=viterbi,
            current_state=current_state,
            current_posterior=current_posterior,
            log_likelihood=float(log_lik),
        )

    def dwell_time(self, state: str | int) -> float:
        """Expected number of steps the chain stays in `state` once entered.

        Geometric dwell distribution: E[dwell] = 1 / (1 - a_ii).
        """
        idx = STATE_INDEX[state] if isinstance(state, str) else int(state)
        a_ii = float(self.transmat[idx, idx])
        if a_ii >= 1.0:
            return float("inf")
        return 1.0 / (1.0 - a_ii)

    def get_escalation_warnings(
        self,
        topic_observations: dict[str, np.ndarray],
        threshold: float | None = None,
    ) -> list[dict]:
        """Scan multiple topics, return warnings where P(PRE_CONTROVERSY) > threshold.

        Args:
            topic_observations: {topic_id: observations shape (T, 3)}.
            threshold: override default alert_threshold.

        Returns:
            List of warnings sorted by P(PRE) descending. Each:
                topic, p_pre, current_state, current_posterior,
                escalation_eta_cycles (expected dwell in PRE before transition),
                p_active_next (one-step-ahead P(ACTIVE))
        """
        thr = self.alert_threshold if threshold is None else threshold
        warnings: list[dict] = []

        dwell_pre = self.dwell_time("PRE_CONTROVERSY")
        pre_idx = STATE_INDEX["PRE_CONTROVERSY"]
        active_idx = STATE_INDEX["ACTIVE"]

        for topic, obs in topic_observations.items():
            try:
                pred = self.predict_regime(obs)
            except Exception:
                continue

            p_pre = pred.current_posterior["PRE_CONTROVERSY"]
            if p_pre <= thr:
                continue

            # One-step-ahead: P(state_{t+1}=ACTIVE) = sum_i P(s_t=i) * A[i, active]
            last_post = pred.posteriors[-1]
            p_active_next = float(last_post @ self.transmat[:, active_idx])

            warnings.append({
                "topic": topic,
                "p_pre": p_pre,
                "current_state": pred.current_state,
                "current_posterior": pred.current_posterior,
                "escalation_eta_cycles": dwell_pre,
                "p_active_next": p_active_next,
            })

        warnings.sort(key=lambda w: w["p_pre"], reverse=True)
        return warnings

    # ---- persistence ------------------------------------------------------

    def save(self, path: str | Path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({
                "alert_threshold": self.alert_threshold,
                "transmat": self.transmat,
                "means": self.means,
                "covars": self.covars,
                "startprob": self.startprob,
                "random_state": self.random_state,
                "fitted": self._fitted,
            }, f)

    @classmethod
    def load(cls, path: str | Path) -> "HMMRegimeDetector":
        with open(path, "rb") as f:
            d = pickle.load(f)
        det = cls(
            alert_threshold=d["alert_threshold"],
            transmat=d["transmat"],
            means=d["means"],
            covars=d["covars"],
            startprob=d["startprob"],
            random_state=d["random_state"],
        )
        det._fitted = d.get("fitted", False)
        return det


# ---- issue-queue integration --------------------------------------------


def extract_observation(stream_signals: dict) -> np.ndarray | None:
    """Build a single (1, 3) observation row from one topic's stream_signals.

    Returns None if no usable signal is present.
    """
    sig = stream_signals or {}

    vol = sig.get("volume", {})
    pol = sig.get("polarization", {})
    narr = sig.get("narrative", {})

    volume_z = float(vol.get("z_score", 0.0))

    # sentiment_divergence: prefer polarization.max_pairwise_divergence,
    # fall back to narrative JSD as a community-divergence proxy.
    sent_div = float(pol.get("max_pairwise_divergence", narr.get("jsd_overall", 0.0)))

    er_index = float(pol.get("er_index", 0.0))

    if volume_z == 0.0 and sent_div == 0.0 and er_index == 0.0:
        return None

    return np.array([[volume_z, sent_div, er_index]], dtype=float)


def apply_regime_to_queue(
    queue_path: str | Path,
    detector: HMMRegimeDetector,
    write: bool = True,
) -> list[dict]:
    """Annotate each issue in issue-queue.json with predicted_regime + escalation_eta.

    Uses a single read-modify-write pass so concurrent writers either see the
    pre- or post-state of the file, never a partial update.
    """
    queue_path = Path(queue_path)
    with open(queue_path) as f:
        queue = json.load(f)
    if not isinstance(queue, list):
        raise ValueError("issue-queue.json must be a JSON list")

    dwell_pre = detector.dwell_time("PRE_CONTROVERSY")
    active_idx = STATE_INDEX["ACTIVE"]

    for issue in queue:
        obs = extract_observation(issue.get("stream_signals", {}))
        if obs is None:
            issue["predicted_regime"] = None
            issue["escalation_eta_cycles"] = None
            continue

        pred = detector.predict_regime(obs)
        last_post = pred.posteriors[-1]
        p_active_next = float(last_post @ detector.transmat[:, active_idx])

        issue["predicted_regime"] = {
            "state": pred.current_state,
            "posterior": pred.current_posterior,
            "p_active_next": p_active_next,
        }
        p_pre = pred.current_posterior["PRE_CONTROVERSY"]
        issue["escalation_eta_cycles"] = dwell_pre if p_pre > detector.alert_threshold else None

    if write:
        with open(queue_path, "w") as f:
            json.dump(queue, f, indent=2, default=str)

    return queue


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Apply HMM regime predictions to issue queue")
    ap.add_argument("--queue", default="radar/output/issue-queue.json")
    ap.add_argument("--model", default=None, help="pickled detector; else framework defaults")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    det = HMMRegimeDetector.load(args.model) if args.model else HMMRegimeDetector()
    updated = apply_regime_to_queue(args.queue, det, write=not args.dry_run)
    flagged = [i for i in updated if i.get("escalation_eta_cycles") is not None]
    print(f"Annotated {len(updated)} issues; {len(flagged)} flagged PRE_CONTROVERSY")
