"""Cox Proportional Hazards timing predictor for controversy eruption.

Reference: fourth-angle-controversy-radar-framework.md §3.3.

Survival framing:
    event    = 1 if a topic's controversy_score ever exceeds 0.7, else 0 (censored)
    duration = hours from first observation to eruption (or to current time, if censored)

Covariates (12):
    parliamentary_session   binary  — currently in a sitting window
    days_to_budget          float   — days until Budget presentation
    days_to_election        float   — days until next general election
    ramadan                 binary  — date falls in Ramadan
    religious_keyword       binary  — topic contains religious terms
    ethnic_keyword          binary  — topic contains ethnic terms
    initial_er_index        float   — Esteban-Ray at first detection [0, 1]
    initial_n_star          float   — Hawkes n* at first detection [0, 1]
    initial_bridge_score    float   — HHI bridge score at first detection [0, 1]
    weekend                 binary  — Sat / Sun
    sensitivity_date        binary  — near May 13 / Merdeka / Malaysia Day (±3d)
    elite_mention           binary  — topic text mentions a named elite

Exports CoxTimingPredictor (fit / predict_timing / get_imminent_eruptions)
plus synthetic bootstrap and queue-integration helpers.
"""

from __future__ import annotations

import json
import pickle
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from lifelines import CoxPHFitter

COVARIATE_COLS = [
    "parliamentary_session",
    "days_to_budget",
    "days_to_election",
    "ramadan",
    "religious_keyword",
    "ethnic_keyword",
    "initial_er_index",
    "initial_n_star",
    "initial_bridge_score",
    "weekend",
    "sensitivity_date",
    "elite_mention",
]

RELIGIOUS_TERMS = {
    "islam", "agama", "fatwa", "halal", "haram", "syariah", "shariah",
    "religion", "mosque", "masjid", "allah", "jakim", "muslim", "kristian",
    "christian", "hindu", "buddha", "temple", "church", "gereja", "kuil",
}
ETHNIC_TERMS = {
    "kaum", "bangsa", "melayu", "cina", "india", "bumiputera", "race",
    "ethnic", "chinese", "indian", "malay", "discrimination", "orang asli",
    "dayak", "iban", "kadazan",
}
ELITE_TERMS = {
    "pm", "prime minister", "perdana menteri", "menteri", "minister",
    "timbalan", "deputy", "speaker", "ketua", "agong", "sultan", "raja",
    "najib", "anwar", "mahathir", "muhyiddin", "zahid", "hadi", "lim",
    "guan eng", "hishammuddin", "rafizi", "saifuddin",
}

HORIZON_IMMINENT_HOURS = 72
SENSITIVITY_WINDOW_DAYS = 3

DEFAULT_ELECTION_TARGET = datetime(2028, 3, 1, tzinfo=timezone.utc)


# ---- calendar helpers ----------------------------------------------------


def _parse_date(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def _in_any_range(dt: datetime, ranges: list[tuple[datetime, datetime]]) -> bool:
    return any(start <= dt <= end for start, end in ranges)


def _parse_parliament_ranges(calendar: dict) -> list[tuple[datetime, datetime]]:
    sessions = calendar.get("parliamentary_sessions_2026", {}) or {}
    ranges = []
    for sess in sessions.values():
        if isinstance(sess, dict) and "start" in sess and "end" in sess:
            ranges.append((_parse_date(sess["start"]), _parse_date(sess["end"])))
    return ranges


def _ramadan_range(calendar: dict) -> tuple[datetime, datetime] | None:
    rc = calendar.get("religious_calendar_2026", {}) or {}
    start = rc.get("ramadan_start")
    raya = rc.get("hari_raya_aidilfitri")
    if not start or not raya:
        return None
    return _parse_date(start), _parse_date(raya)


def _sensitivity_dates(calendar: dict) -> list[datetime]:
    hist = calendar.get("historical_sensitivity_dates", {}) or {}
    return [_parse_date(v) for v in hist.values() if isinstance(v, str)]


def _budget_date(calendar: dict) -> datetime | None:
    s = calendar.get("budget_presentation")
    return _parse_date(s) if s else None


# ---- covariate construction ---------------------------------------------


def _contains_any(text: str, terms: set[str]) -> int:
    t = text.lower()
    return int(any(term in t for term in terms))


def build_covariates(
    topic_text: str,
    signals: dict,
    occur_dt: datetime,
    calendar: dict,
    election_target: datetime = DEFAULT_ELECTION_TARGET,
) -> dict[str, float]:
    """Derive the 12-dim covariate row for one topic at one timestamp."""
    if occur_dt.tzinfo is None:
        occur_dt = occur_dt.replace(tzinfo=timezone.utc)

    parl_ranges = _parse_parliament_ranges(calendar)
    ramadan = _ramadan_range(calendar)
    sensitivity = _sensitivity_dates(calendar)
    budget = _budget_date(calendar)

    budget_delta = (budget - occur_dt).total_seconds() / 86400 if budget else 0.0
    election_delta = (election_target - occur_dt).total_seconds() / 86400

    near_sensitivity = 0
    for sd in sensitivity:
        if abs((sd - occur_dt).total_seconds()) <= SENSITIVITY_WINDOW_DAYS * 86400:
            near_sensitivity = 1
            break

    pol = (signals or {}).get("polarization", {})
    cas = (signals or {}).get("cascade", {}) or (signals or {}).get("cascade_tracker", {})
    brg = (signals or {}).get("bridge", {}) or (signals or {}).get("network_bridge", {})

    return {
        "parliamentary_session": int(_in_any_range(occur_dt, parl_ranges)),
        "days_to_budget": float(max(0.0, budget_delta)),
        "days_to_election": float(max(0.0, election_delta)),
        "ramadan": int(ramadan is not None and ramadan[0] <= occur_dt <= ramadan[1]),
        "religious_keyword": _contains_any(topic_text, RELIGIOUS_TERMS),
        "ethnic_keyword": _contains_any(topic_text, ETHNIC_TERMS),
        "initial_er_index": float(pol.get("er_index", 0.0)),
        "initial_n_star": float(cas.get("n_star", 0.0)),
        "initial_bridge_score": float(brg.get("bridge_score", 0.0)),
        "weekend": int(occur_dt.weekday() >= 5),
        "sensitivity_date": near_sensitivity,
        "elite_mention": _contains_any(topic_text, ELITE_TERMS),
    }


# ---- predictor -----------------------------------------------------------


@dataclass
class TimingPrediction:
    median_survival_hours: float | None   # None if curve never crosses 0.5
    survival_curve: list[tuple[float, float]]   # [(t_hours, S(t))]
    regime: str                                 # "accelerating" | "decelerating" | "flat"
    p_eruption_within_horizon: float            # P(T <= HORIZON)

    def to_dict(self) -> dict:
        return {
            "median_survival_hours": self.median_survival_hours,
            "regime": self.regime,
            "p_eruption_within_horizon": self.p_eruption_within_horizon,
            "survival_curve": self.survival_curve,
        }


class CoxTimingPredictor:
    """Cox PH timing model for controversy eruption."""

    def __init__(
        self,
        calendar: dict,
        penalizer: float = 0.01,
        horizon_hours: float = HORIZON_IMMINENT_HOURS,
        election_target: datetime = DEFAULT_ELECTION_TARGET,
    ):
        self.calendar = calendar
        self.penalizer = penalizer
        self.horizon_hours = horizon_hours
        self.election_target = election_target
        self.model: CoxPHFitter | None = None
        self.last_fit_at: datetime | None = None
        self._training_columns: list[str] = list(COVARIATE_COLS)

    # ---- training -------------------------------------------------------

    def fit(self, df: pd.DataFrame) -> "CoxTimingPredictor":
        """Fit Cox PH on a survival DataFrame with columns:
        duration, event, plus the 12 covariates.
        """
        required = {"duration", "event", *COVARIATE_COLS}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"fit() missing columns: {sorted(missing)}")
        if len(df) < 10:
            raise ValueError(f"need at least 10 rows to fit Cox PH, got {len(df)}")

        # Drop covariates with no variance — Cox can't identify coefs on constants.
        usable = [c for c in COVARIATE_COLS if df[c].nunique(dropna=True) > 1]
        dropped = sorted(set(COVARIATE_COLS) - set(usable))
        self._training_columns = usable

        cph = CoxPHFitter(penalizer=self.penalizer)
        cph.fit(df[["duration", "event", *usable]], duration_col="duration", event_col="event")
        self.model = cph
        self.last_fit_at = datetime.now(timezone.utc)
        self._dropped_cols = dropped
        return self

    def hazard_ratios(self) -> dict[str, float]:
        """Return exp(coef) per covariate. Missing covariates (no-variance) → 1.0."""
        if self.model is None:
            raise RuntimeError("fit() before hazard_ratios()")
        hr = {c: 1.0 for c in COVARIATE_COLS}
        summary = self.model.summary
        for col in self._training_columns:
            if col in summary.index:
                hr[col] = float(summary.loc[col, "exp(coef)"])
        return hr

    def coefficients(self) -> dict[str, float]:
        """Return log-hazard coefficient per covariate (dropped covariates → 0.0)."""
        if self.model is None:
            raise RuntimeError("fit() before coefficients()")
        coefs = {c: 0.0 for c in COVARIATE_COLS}
        summary = self.model.summary
        for col in self._training_columns:
            if col in summary.index:
                coefs[col] = float(summary.loc[col, "coef"])
        return coefs

    def risk_factors(self, covariates: dict[str, float], top_k: int = 3) -> list[dict]:
        """Top-k covariates ranked by |coef × value| for a single issue.

        Returns a list of {name, contribution, hazard_ratio} dicts. Positive
        contribution → this factor raises hazard (accelerates eruption) for
        this issue; negative → it lowers hazard.
        """
        coefs = self.coefficients()
        hr = self.hazard_ratios()
        contribs = []
        for name in COVARIATE_COLS:
            c = coefs.get(name, 0.0)
            v = float(covariates.get(name, 0.0))
            contribs.append({
                "name": name,
                "contribution": c * v,
                "hazard_ratio": hr.get(name, 1.0),
            })
        contribs.sort(key=lambda r: abs(r["contribution"]), reverse=True)
        return contribs[:top_k]

    # ---- inference ------------------------------------------------------

    def _covariate_row(self, covariates: dict[str, float]) -> pd.DataFrame:
        row = {c: float(covariates.get(c, 0.0)) for c in self._training_columns}
        return pd.DataFrame([row])

    def predict_timing(
        self,
        covariates: dict[str, float],
        t_grid_hours: np.ndarray | None = None,
    ) -> TimingPrediction:
        if self.model is None:
            raise RuntimeError("fit() before predict_timing()")
        if t_grid_hours is None:
            t_grid_hours = np.linspace(1.0, 168.0, 64)  # 1 hour → 1 week

        X = self._covariate_row(covariates)
        sf = self.model.predict_survival_function(X, times=t_grid_hours)
        # sf is (len(t_grid), 1). Extract column.
        curve_series = sf.iloc[:, 0]

        # Median survival: first t where S(t) <= 0.5
        median = None
        for t, s in zip(curve_series.index, curve_series.values):
            if s <= 0.5:
                median = float(t)
                break

        # Regime: compare initial hazard slope vs late slope.
        vals = curve_series.values
        times = np.asarray(curve_series.index, dtype=float)
        if len(vals) >= 6:
            mid = len(vals) // 2
            early_drop = vals[0] - vals[mid]
            late_drop = vals[mid] - vals[-1]
            if late_drop > early_drop * 1.1:
                regime = "accelerating"
            elif early_drop > late_drop * 1.1:
                regime = "decelerating"
            else:
                regime = "flat"
        else:
            regime = "flat"

        # P(eruption within horizon) = 1 - S(horizon)
        horizon = self.horizon_hours
        s_horizon = float(np.interp(horizon, times, vals))
        p_eruption = float(max(0.0, min(1.0, 1.0 - s_horizon)))

        curve = [(float(t), float(s)) for t, s in zip(times, vals)]
        return TimingPrediction(
            median_survival_hours=median,
            survival_curve=curve,
            regime=regime,
            p_eruption_within_horizon=p_eruption,
        )

    def get_imminent_eruptions(
        self,
        topic_covariates: dict[str, dict[str, float]],
        horizon_hours: float | None = None,
        threshold: float = 0.5,
    ) -> list[dict]:
        """Scan multiple topics, return those with P(eruption within horizon) > threshold."""
        horizon = horizon_hours if horizon_hours is not None else self.horizon_hours
        results: list[dict] = []
        for topic, cov in topic_covariates.items():
            try:
                pred = self.predict_timing(cov)
            except Exception:
                continue
            if pred.p_eruption_within_horizon <= threshold:
                continue
            results.append({
                "topic": topic,
                "median_survival_hours": pred.median_survival_hours,
                "p_eruption_within_horizon": pred.p_eruption_within_horizon,
                "regime": pred.regime,
                "horizon_hours": horizon,
            })
        results.sort(key=lambda r: r["p_eruption_within_horizon"], reverse=True)
        return results

    # ---- refit scheduling ----------------------------------------------

    def needs_refit(self, now: datetime | None = None, max_age_days: int = 30) -> bool:
        now = now or datetime.now(timezone.utc)
        if self.last_fit_at is None:
            return True
        return (now - self.last_fit_at).days >= max_age_days

    # ---- persistence ---------------------------------------------------

    def save(self, path: str | Path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({
                "calendar": self.calendar,
                "penalizer": self.penalizer,
                "horizon_hours": self.horizon_hours,
                "election_target": self.election_target.isoformat(),
                "model": self.model,
                "last_fit_at": self.last_fit_at.isoformat() if self.last_fit_at else None,
                "training_columns": self._training_columns,
            }, f)

    @classmethod
    def load(cls, path: str | Path) -> "CoxTimingPredictor":
        with open(path, "rb") as f:
            d = pickle.load(f)
        pred = cls(
            calendar=d["calendar"],
            penalizer=d["penalizer"],
            horizon_hours=d["horizon_hours"],
            election_target=datetime.fromisoformat(d["election_target"]),
        )
        pred.model = d["model"]
        pred._training_columns = d.get("training_columns", list(COVARIATE_COLS))
        if d.get("last_fit_at"):
            pred.last_fit_at = datetime.fromisoformat(d["last_fit_at"])
        return pred


# ---- synthetic bootstrap -------------------------------------------------


def _sample_date_2026(rng: np.random.Generator) -> datetime:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    days = int(rng.integers(0, 365))
    hours = int(rng.integers(0, 24))
    return start + timedelta(days=days, hours=hours)


def _seed_topic_text(seed: dict) -> str:
    parts = [seed.get("headline", ""), seed.get("context", "")]
    for card in seed.get("cards", []):
        parts.append(str(card.get("big", "")))
        parts.append(str(card.get("sub", "")))
    return " ".join(parts)


def _seed_signals(seed: dict, rng: np.random.Generator) -> dict:
    """Synthesize initial stream signals from a seed issue's editorial scores."""
    stages = seed.get("stageScores", {}) or {}
    # Map editorial scores to plausible stream-signal ranges.
    er = min(1.0, max(0.0, (stages.get("ba", 50) / 100.0) * 0.6 + rng.uniform(0.1, 0.3)))
    n_star = min(1.0, max(0.0, (stages.get("ct", 50) / 100.0) * 0.5 + rng.uniform(0.2, 0.4)))
    bridge = min(1.0, max(0.0, (stages.get("af", 50) / 100.0) * 0.4 + rng.uniform(0.1, 0.3)))
    return {
        "polarization": {"er_index": er},
        "cascade": {"n_star": n_star},
        "bridge": {"bridge_score": bridge},
    }


# Baseline log-scale for Weibull synthesis. Coefficients here are the
# ground-truth direction used to generate the bootstrap — Cox should recover
# their sign (HR > 1 for accelerators).
_LOG_SCALE_INTERCEPT = 4.4   # exp(4.4) ≈ 81 h baseline time-to-eruption
_WEIBULL_SHAPE = 1.3

_COEF = {
    "parliamentary_session": -0.80,
    "ramadan": -0.25,
    "religious_keyword": -0.30,
    "ethnic_keyword": -0.40,
    "weekend": 0.30,          # slower eruptions on weekends
    "sensitivity_date": -0.45,
    "elite_mention": -0.55,
    "initial_er_index": -1.20,
    "initial_n_star": -1.10,
    "initial_bridge_score": -0.80,
    "days_to_budget": 0.0015,     # far from budget → slower
    "days_to_election": 0.0008,
}


def bootstrap_synthetic(
    seed_issues: list[dict],
    calendar: dict,
    n: int = 100,
    rng_seed: int = 0,
    censor_at_hours: float = 168.0,
    ramadan_religious_extra: float = -0.50,
) -> pd.DataFrame:
    """Generate n synthetic survival rows from seed-issue metadata.

    Times are sampled from a Weibull whose scale depends on the covariates,
    so the ground-truth hazard direction of each covariate is identifiable.
    An additional ramadan×religious interaction accelerates eruption (shrinks
    scale) without itself being a fitted covariate — both marginal coefs will
    therefore come out with HR > 1.
    """
    if not seed_issues:
        raise ValueError("bootstrap_synthetic needs at least one seed issue")

    rng = np.random.default_rng(rng_seed)
    rows = []
    for _ in range(n):
        seed = seed_issues[int(rng.integers(0, len(seed_issues)))]
        occur_dt = _sample_date_2026(rng)
        text = _seed_topic_text(seed)
        signals = _seed_signals(seed, rng)
        cov = build_covariates(text, signals, occur_dt, calendar)

        log_scale = _LOG_SCALE_INTERCEPT
        for k, c in _COEF.items():
            log_scale += c * cov.get(k, 0.0)
        # Interaction: Ramadan AND religious_keyword → additional acceleration.
        if cov["ramadan"] and cov["religious_keyword"]:
            log_scale += ramadan_religious_extra

        scale = float(np.exp(log_scale))
        # Weibull: T = scale * (-ln U)^(1/shape)
        u = rng.uniform(1e-6, 1.0)
        t = scale * (-np.log(u)) ** (1.0 / _WEIBULL_SHAPE)

        event = 1
        if t >= censor_at_hours:
            t = censor_at_hours
            event = 0
        # Tiny jitter prevents lifelines from complaining about exact ties.
        t += float(rng.uniform(0.0, 0.1))

        rows.append({"duration": float(t), "event": int(event), **cov})

    df = pd.DataFrame(rows)
    return df


def load_seed_issues_from_repo(
    issues_dir: str | Path = "src/data/issues",
    limit: int = 28,
    only_published: bool = True,
) -> list[dict]:
    """Load seed issues from the T4A repo. Defaults to 28 (pipeline-v3.md spec)."""
    issues_dir = Path(issues_dir)
    if not issues_dir.exists():
        return []
    seeds: list[dict] = []
    for p in sorted(issues_dir.glob("*.json")):
        try:
            d = json.loads(p.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        if only_published and not d.get("published"):
            continue
        seeds.append(d)
        if len(seeds) >= limit:
            break
    return seeds


# ---- queue integration ---------------------------------------------------


def apply_timing_to_queue(
    queue_path: str | Path,
    predictor: CoxTimingPredictor,
    calendar: dict,
    now: datetime | None = None,
    write: bool = True,
) -> list[dict]:
    """Annotate each issue with predicted_eruption (median + horizon probability)."""
    queue_path = Path(queue_path)
    now = now or datetime.now(timezone.utc)

    with open(queue_path) as f:
        queue = json.load(f)
    if not isinstance(queue, list):
        raise ValueError("issue-queue.json must be a JSON list")

    for issue in queue:
        try:
            ts_raw = issue.get("timestamp")
            occur_dt = (
                datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                if isinstance(ts_raw, str) else now
            )
        except ValueError:
            occur_dt = now
        text = str(issue.get("title", "")) + " " + str(issue.get("issue_id", ""))
        cov = build_covariates(text, issue.get("stream_signals", {}), occur_dt, calendar)
        try:
            pred = predictor.predict_timing(cov)
        except Exception:
            issue["predicted_eruption"] = None
            continue
        issue["predicted_eruption"] = {
            "median_survival_hours": pred.median_survival_hours,
            "regime": pred.regime,
            "p_eruption_within_72h": pred.p_eruption_within_horizon,
        }

    if write:
        with open(queue_path, "w") as f:
            json.dump(queue, f, indent=2, default=str)
    return queue


# ---- CLI -----------------------------------------------------------------


def _load_calendar(path: str | Path) -> dict:
    return json.loads(Path(path).read_text())


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Fit & apply Cox timing predictor")
    ap.add_argument("--calendar", default="radar/config/malaysia-calendar.json")
    ap.add_argument("--issues-dir", default="src/data/issues")
    ap.add_argument("--queue", default="radar/output/issue-queue.json")
    ap.add_argument("--n-bootstrap", type=int, default=100)
    ap.add_argument("--seed-limit", type=int, default=28)
    ap.add_argument("--model-out", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cal = _load_calendar(args.calendar)
    seeds = load_seed_issues_from_repo(args.issues_dir, limit=args.seed_limit)
    if len(seeds) < 5:
        raise SystemExit(f"not enough seed issues in {args.issues_dir}: {len(seeds)}")

    df = bootstrap_synthetic(seeds, cal, n=args.n_bootstrap)
    pred = CoxTimingPredictor(calendar=cal).fit(df)
    print("Hazard ratios:")
    for k, v in sorted(pred.hazard_ratios().items(), key=lambda kv: -kv[1]):
        print(f"  {k:<28s} {v:.3f}")

    if args.model_out:
        pred.save(args.model_out)
        print(f"Saved model to {args.model_out}")

    updated = apply_timing_to_queue(args.queue, pred, cal, write=not args.dry_run)
    imminent = [i for i in updated if (i.get("predicted_eruption") or {}).get("p_eruption_within_72h", 0) > 0.5]
    print(f"Annotated {len(updated)} issues; {len(imminent)} predicted to erupt within 72h")
