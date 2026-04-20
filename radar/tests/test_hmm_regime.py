"""Tests for HMMRegimeDetector — synthetic lifecycle recovery + alert timing."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from radar.prediction.hmm_regime import (
    FRAMEWORK_COVARS,
    FRAMEWORK_MEANS,
    FRAMEWORK_TRANSMAT,
    HMMRegimeDetector,
    STATE_INDEX,
    STATE_NAMES,
    apply_regime_to_queue,
    extract_observation,
)


def _emit(state_idx: int, n: int, rng: np.random.Generator) -> np.ndarray:
    """Sample n observations from the framework Gaussian emission for a state."""
    mean = FRAMEWORK_MEANS[state_idx]
    std = np.sqrt(FRAMEWORK_COVARS[state_idx])
    obs = rng.normal(loc=mean, scale=std, size=(n, mean.shape[0]))
    # Clip the two bounded indices to [0, 1] so synthetic data stays realistic.
    obs[:, 1:] = np.clip(obs[:, 1:], 0.0, 1.0)
    return obs


def build_lifecycle(seed: int = 0,
                    lengths=(30, 12, 20, 15)) -> tuple[np.ndarray, np.ndarray]:
    """Synthetic STABLE → PRE → ACTIVE → POST observation sequence.

    Returns (observations, ground_truth_states).
    """
    rng = np.random.default_rng(seed)
    segments = []
    truth = []
    for state_idx, n in enumerate(lengths):
        segments.append(_emit(state_idx, n, rng))
        truth.extend([state_idx] * n)
    return np.vstack(segments), np.array(truth)


class TestConfig:
    def test_framework_transmat_rows_sum_to_one(self):
        assert np.allclose(FRAMEWORK_TRANSMAT.sum(axis=1), 1.0)

    def test_state_name_ordering(self):
        assert STATE_NAMES == ["STABLE", "PRE_CONTROVERSY", "ACTIVE", "POST_CONTROVERSY"]
        assert STATE_INDEX["PRE_CONTROVERSY"] == 1

    def test_rejects_invalid_transmat(self):
        bad = np.ones((4, 4)) * 0.5  # rows don't sum to 1
        with pytest.raises(ValueError, match="sum to 1"):
            HMMRegimeDetector(transmat=bad)

    def test_rejects_wrong_shape(self):
        with pytest.raises(ValueError, match="shape"):
            HMMRegimeDetector(means=np.zeros((3, 3)))


class TestDwellTime:
    def test_pre_controversy_dwell_matches_framework(self):
        # a_ii = 0.55 → E[dwell] = 1/(1-0.55) ≈ 2.222
        det = HMMRegimeDetector()
        assert det.dwell_time("PRE_CONTROVERSY") == pytest.approx(1.0 / 0.45, rel=1e-6)

    def test_stable_dwell_longer_than_pre(self):
        det = HMMRegimeDetector()
        assert det.dwell_time("STABLE") > det.dwell_time("PRE_CONTROVERSY")

    def test_accepts_int_state(self):
        det = HMMRegimeDetector()
        assert det.dwell_time(1) == det.dwell_time("PRE_CONTROVERSY")


class TestViterbiRecovery:
    def test_viterbi_recovers_lifecycle_without_fit(self):
        """With framework defaults, Viterbi should label each segment dominantly correctly."""
        obs, truth = build_lifecycle(seed=0)
        det = HMMRegimeDetector()
        pred = det.predict_regime(obs)
        accuracy = float(np.mean(pred.viterbi == truth))
        assert accuracy >= 0.75, f"lifecycle recovery accuracy too low: {accuracy:.2f}"

    def test_viterbi_improves_after_fit(self):
        """Baum-Welch on the synthetic lifecycle should not degrade recovery."""
        obs, truth = build_lifecycle(seed=1)
        det = HMMRegimeDetector().fit([obs])
        pred = det.predict_regime(obs)
        accuracy = float(np.mean(pred.viterbi == truth))
        assert accuracy >= 0.75, f"post-fit accuracy too low: {accuracy:.2f}"

    def test_posteriors_are_valid_distributions(self):
        obs, _ = build_lifecycle(seed=2)
        det = HMMRegimeDetector()
        pred = det.predict_regime(obs)
        assert pred.posteriors.shape == (len(obs), 4)
        assert np.allclose(pred.posteriors.sum(axis=1), 1.0, atol=1e-6)
        assert (pred.posteriors >= 0).all()


class TestAlertTiming:
    def test_alert_fires_in_pre_segment(self):
        """P(PRE_CONTROVERSY) should exceed 0.5 at some point during the PRE segment."""
        lengths = (30, 12, 20, 15)
        obs, truth = build_lifecycle(seed=3, lengths=lengths)
        det = HMMRegimeDetector()
        pred = det.predict_regime(obs)

        pre_idx = STATE_INDEX["PRE_CONTROVERSY"]
        pre_mask = truth == pre_idx
        pre_posteriors = pred.posteriors[pre_mask, pre_idx]

        assert pre_posteriors.max() > 0.5, (
            f"PRE alert never fired; max P(PRE) during PRE segment = {pre_posteriors.max():.2f}"
        )

    def test_no_false_alert_during_stable(self):
        """Stable-only sequence must not trip the PRE alert on average."""
        rng = np.random.default_rng(7)
        obs = _emit(STATE_INDEX["STABLE"], 60, rng)
        det = HMMRegimeDetector()
        pred = det.predict_regime(obs)
        pre_idx = STATE_INDEX["PRE_CONTROVERSY"]
        mean_p_pre = float(pred.posteriors[:, pre_idx].mean())
        assert mean_p_pre < 0.3, f"false-alert rate too high: mean P(PRE) = {mean_p_pre:.2f}"

    def test_get_escalation_warnings_flags_pre_topic(self):
        det = HMMRegimeDetector()
        # Enough PRE emissions to overcome the framework's STABLE-heavy startprob.
        pre_obs = _emit(STATE_INDEX["PRE_CONTROVERSY"], 12, np.random.default_rng(0))
        stable_obs = _emit(STATE_INDEX["STABLE"], 12, np.random.default_rng(1))

        warnings = det.get_escalation_warnings({
            "hot_topic": pre_obs,
            "cold_topic": stable_obs,
        })

        topics_flagged = [w["topic"] for w in warnings]
        assert "hot_topic" in topics_flagged
        assert "cold_topic" not in topics_flagged

        w = warnings[0]
        assert w["escalation_eta_cycles"] == pytest.approx(1.0 / 0.45, rel=1e-6)
        assert 0.0 <= w["p_active_next"] <= 1.0
        assert sum(w["current_posterior"].values()) == pytest.approx(1.0, abs=1e-6)


class TestQueueIntegration:
    def test_extract_observation_from_signals(self):
        signals = {
            "volume": {"z_score": 2.5, "severity": 0.9, "alert": True},
            "polarization": {"er_index": 0.7, "max_pairwise_divergence": 0.6},
            "narrative": {"jsd_overall": 0.2},
        }
        obs = extract_observation(signals)
        assert obs.shape == (1, 3)
        assert obs[0, 0] == 2.5
        assert obs[0, 1] == 0.6
        assert obs[0, 2] == 0.7

    def test_extract_falls_back_to_narrative_when_no_polarization(self):
        signals = {
            "volume": {"z_score": 1.0},
            "narrative": {"jsd_overall": 0.3},
        }
        obs = extract_observation(signals)
        assert obs[0, 1] == 0.3  # sentiment_divergence falls back to jsd
        assert obs[0, 2] == 0.0

    def test_extract_returns_none_for_empty(self):
        assert extract_observation({}) is None
        assert extract_observation({"volume": {"z_score": 0.0}}) is None

    def test_apply_regime_annotates_queue(self, tmp_path: Path):
        queue = [
            {
                "issue_id": "T4A-TEST-001",
                "title": "hot",
                "stream_signals": {
                    "volume": {"z_score": 3.5},
                    "polarization": {"er_index": 0.75, "max_pairwise_divergence": 0.8},
                },
            },
            {
                "issue_id": "T4A-TEST-002",
                "title": "quiet",
                "stream_signals": {
                    "volume": {"z_score": 0.1},
                    "polarization": {"er_index": 0.05, "max_pairwise_divergence": 0.05},
                },
            },
            {
                "issue_id": "T4A-TEST-003",
                "title": "no_signal",
                "stream_signals": {},
            },
        ]
        queue_path = tmp_path / "issue-queue.json"
        queue_path.write_text(json.dumps(queue))

        det = HMMRegimeDetector()
        updated = apply_regime_to_queue(queue_path, det)

        assert updated[0]["predicted_regime"]["state"] in {"ACTIVE", "PRE_CONTROVERSY"}
        assert updated[1]["predicted_regime"]["state"] == "STABLE"
        assert updated[2]["predicted_regime"] is None
        assert updated[2]["escalation_eta_cycles"] is None

        # File is written back as valid JSON list.
        reread = json.loads(queue_path.read_text())
        assert len(reread) == 3
        assert reread[0]["predicted_regime"]["state"] == updated[0]["predicted_regime"]["state"]

    def test_apply_regime_dry_run_does_not_write(self, tmp_path: Path):
        queue = [{"issue_id": "X", "title": "x", "stream_signals": {"volume": {"z_score": 1.0}}}]
        queue_path = tmp_path / "q.json"
        original = json.dumps(queue)
        queue_path.write_text(original)

        det = HMMRegimeDetector()
        apply_regime_to_queue(queue_path, det, write=False)

        assert queue_path.read_text() == original


class TestPersistence:
    def test_save_and_load_roundtrip(self, tmp_path: Path):
        det = HMMRegimeDetector(alert_threshold=0.42)
        path = tmp_path / "model.pkl"
        det.save(path)

        loaded = HMMRegimeDetector.load(path)
        assert loaded.alert_threshold == 0.42
        assert np.allclose(loaded.transmat, det.transmat)
        assert np.allclose(loaded.means, det.means)

        # Predictions agree after round-trip.
        rng = np.random.default_rng(0)
        obs = _emit(STATE_INDEX["ACTIVE"], 10, rng)
        p1 = det.predict_regime(obs)
        p2 = loaded.predict_regime(obs)
        assert np.array_equal(p1.viterbi, p2.viterbi)
