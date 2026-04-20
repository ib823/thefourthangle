"""Prediction pipeline — unifies HMM, Cox, SARIMA into the radar cycle.

Each cycle after fusion writes an issue queue. This module:

    1. Advances the radar's "days of data" counter (from first_cycle_at).
    2. Gates each predictor until enough data has accumulated:
         HMM      >= 7 days    (regime + escalation)
         Cox      >= 14 days   (eruption timing)
         SARIMA   >= 30 days   (global controversy windows)
    3. Retrains each on its own cadence once cold-start has passed:
         HMM      weekly
         Cox      monthly
         SARIMA   weekly
    4. Writes a unified per-issue `prediction` block:
         { regime, probabilities, eruption_hours, confidence,
           risk_factors, survival_curve }
       and a global `upcoming_controversy_windows` block on every issue.

Persisted pickles live under radar/output/models/ so predictions survive
process restarts without re-bootstrapping every cycle.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from radar.prediction.hmm_regime import (
    HMMRegimeDetector,
    STATE_INDEX,
    extract_observation as hmm_extract_observation,
)
from radar.prediction.cox_timing import (
    CoxTimingPredictor,
    build_covariates as cox_build_covariates,
    bootstrap_synthetic as cox_bootstrap_synthetic,
    load_seed_issues_from_repo as cox_load_seed_issues,
)
from radar.prediction.sarima_forecast import (
    SARIMAForecaster,
    FORECAST_HORIZONS,
)

COLD_START_DAYS = {
    "hmm": 7,
    "cox": 14,
    "sarima": 30,
}

RETRAIN_DAYS = {
    "hmm": 7,     # weekly
    "cox": 30,    # monthly
    "sarima": 7,  # weekly
}

DAILY_MENTIONS_KEEP_DAYS = 5 * 365   # keep up to 5 years
SURVIVAL_CURVE_POINTS = 16           # trimmed survival curve stored per issue


# ---- helpers -------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def days_of_data(state: dict, now: datetime | None = None) -> int:
    now = now or _now()
    first = _parse_iso(state.get("first_cycle_at"))
    if first is None:
        return 0
    return max(0, (now - first).days)


def _needs_retrain(last_trained: datetime | None, cadence_days: int,
                   now: datetime | None = None) -> bool:
    now = now or _now()
    if last_trained is None:
        return True
    return (now - last_trained).days >= cadence_days


# ---- daily-mention bookkeeping ------------------------------------------


def update_daily_mentions(state: dict, events_count: int,
                          now: datetime | None = None) -> dict[str, int]:
    now = now or _now()
    today = now.date().isoformat()
    daily = state.setdefault("daily_mentions", {})
    daily[today] = int(daily.get(today, 0)) + int(events_count)

    # Prune entries older than DAILY_MENTIONS_KEEP_DAYS.
    cutoff = (now - timedelta(days=DAILY_MENTIONS_KEEP_DAYS)).date().isoformat()
    for k in list(daily.keys()):
        if k < cutoff:
            del daily[k]
    return daily


def daily_mentions_to_series(daily: dict[str, int]) -> pd.Series:
    if not daily:
        return pd.Series(dtype=float)
    dates = sorted(daily.keys())
    idx = pd.date_range(start=dates[0], end=dates[-1], freq="D")
    vals = [float(daily.get(d.date().isoformat(), 0)) for d in idx]
    return pd.Series(vals, index=idx, name="mentions")


# ---- per-issue annotation ------------------------------------------------


def _prediction_block(issue: dict) -> dict:
    return issue.setdefault("prediction", {})


def _annotate_hmm(issues: list[dict], detector: HMMRegimeDetector) -> int:
    """Attach regime + probabilities to each issue's prediction block."""
    applied = 0
    dwell_pre = detector.dwell_time("PRE_CONTROVERSY")
    for issue in issues:
        obs = hmm_extract_observation(issue.get("stream_signals", {}))
        block = _prediction_block(issue)
        if obs is None:
            block["regime"] = None
            block["probabilities"] = None
            continue
        try:
            pred = detector.predict_regime(obs)
        except Exception:
            block["regime"] = None
            block["probabilities"] = None
            continue
        block["regime"] = pred.current_state
        block["probabilities"] = pred.current_posterior
        # Escalation ETA stays on the block so UI can surface it directly.
        p_pre = pred.current_posterior.get("PRE_CONTROVERSY", 0.0)
        block["escalation_eta_cycles"] = dwell_pre if p_pre > detector.alert_threshold else None
        applied += 1
    return applied


def _annotate_cox(issues: list[dict], predictor: CoxTimingPredictor,
                  calendar: dict, now: datetime | None = None) -> int:
    now = now or _now()
    applied = 0
    for issue in issues:
        ts = _parse_iso(issue.get("timestamp")) or now
        text = str(issue.get("title", "")) + " " + str(issue.get("issue_id", ""))
        cov = cox_build_covariates(text, issue.get("stream_signals", {}),
                                   ts, calendar)
        try:
            pred = predictor.predict_timing(cov)
            risk = predictor.risk_factors(cov, top_k=3)
        except Exception:
            continue

        block = _prediction_block(issue)
        block["eruption_hours"] = pred.median_survival_hours
        block["regime_curve"] = pred.regime
        block["p_eruption_within_72h"] = pred.p_eruption_within_horizon
        block["confidence"] = issue.get("confidence", 0.0)
        block["risk_factors"] = risk

        # Trim the survival curve so the queue stays small.
        curve = pred.survival_curve
        if len(curve) > SURVIVAL_CURVE_POINTS:
            step = len(curve) // SURVIVAL_CURVE_POINTS
            curve = curve[::step][:SURVIVAL_CURVE_POINTS]
        block["survival_curve"] = curve
        applied += 1
    return applied


def _annotate_sarima(issues: list[dict], forecaster: SARIMAForecaster) -> int:
    try:
        windows = forecaster.get_high_controversy_windows(horizons=FORECAST_HORIZONS)
    except Exception:
        windows = {h: [] for h in FORECAST_HORIZONS}
    annotation = {str(h): windows.get(h, []) for h in FORECAST_HORIZONS}
    for issue in issues:
        issue["upcoming_controversy_windows"] = annotation
    return len(issues)


# ---- pipeline ------------------------------------------------------------


class PredictionPipeline:
    """Runs HMM + Cox + SARIMA after fusion, honouring cold-start gates."""

    def __init__(
        self,
        calendar: dict,
        models_dir: Path,
        issues_dir: Path = Path("src/data/issues"),
        cox_bootstrap_n: int = 100,
        cox_seed_limit: int = 28,
        sarima_aic_grid: dict | None = None,
    ):
        self.calendar = calendar
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.issues_dir = Path(issues_dir)
        self.cox_bootstrap_n = cox_bootstrap_n
        self.cox_seed_limit = cox_seed_limit
        # Default SARIMA grid is large; callers running inside cycles can
        # pass a smaller grid to keep refits snappy.
        self.sarima_aic_grid = sarima_aic_grid or {
            "p": range(0, 3), "q": range(0, 3),
            "P": range(0, 2), "Q": range(0, 2),
        }

    @property
    def hmm_path(self) -> Path:   return self.models_dir / "hmm.pkl"
    @property
    def cox_path(self) -> Path:   return self.models_dir / "cox.pkl"
    @property
    def sarima_path(self) -> Path: return self.models_dir / "sarima.pkl"

    def _last_trained(self, state: dict, key: str) -> datetime | None:
        predictors = state.setdefault("predictors", {})
        entry = predictors.setdefault(key, {})
        return _parse_iso(entry.get("last_trained_at"))

    def _record_trained(self, state: dict, key: str, now: datetime):
        predictors = state.setdefault("predictors", {})
        entry = predictors.setdefault(key, {})
        entry["last_trained_at"] = now.isoformat()

    # ---- HMM --------------------------------------------------------

    def _run_hmm(self, issues: list[dict], state: dict, days: int,
                 now: datetime) -> dict:
        needed = COLD_START_DAYS["hmm"]
        if days < needed:
            return {"cold_start": True, "days_needed": needed - days,
                    "applied": 0, "retrained": False}

        if self.hmm_path.exists():
            try:
                det = HMMRegimeDetector.load(self.hmm_path)
            except Exception:
                det = HMMRegimeDetector()
        else:
            det = HMMRegimeDetector()

        retrained = False
        if _needs_retrain(self._last_trained(state, "hmm"),
                          RETRAIN_DAYS["hmm"], now):
            # Without persisted per-topic observation histories, we re-save the
            # framework-default detector; a future enhancement can store the
            # obs sequences in state and Baum-Welch refit here.
            det.save(self.hmm_path)
            self._record_trained(state, "hmm", now)
            retrained = True

        applied = _annotate_hmm(issues, det)
        return {"cold_start": False, "applied": applied,
                "retrained": retrained, "days_needed": 0}

    # ---- Cox --------------------------------------------------------

    def _run_cox(self, issues: list[dict], state: dict, days: int,
                 now: datetime) -> dict:
        needed = COLD_START_DAYS["cox"]
        if days < needed:
            return {"cold_start": True, "days_needed": needed - days,
                    "applied": 0, "retrained": False}

        predictor = None
        if self.cox_path.exists():
            try:
                predictor = CoxTimingPredictor.load(self.cox_path)
            except Exception:
                predictor = None
        if predictor is None:
            predictor = CoxTimingPredictor(calendar=self.calendar)

        retrained = False
        if (predictor.model is None
                or _needs_retrain(self._last_trained(state, "cox"),
                                  RETRAIN_DAYS["cox"], now)):
            seeds = cox_load_seed_issues(self.issues_dir,
                                         limit=self.cox_seed_limit)
            if len(seeds) < 5:
                return {"cold_start": True, "days_needed": needed,
                        "applied": 0, "retrained": False,
                        "note": "not enough seed issues for bootstrap"}
            df = cox_bootstrap_synthetic(seeds, self.calendar,
                                         n=self.cox_bootstrap_n)
            predictor.fit(df)
            predictor.save(self.cox_path)
            self._record_trained(state, "cox", now)
            retrained = True

        applied = _annotate_cox(issues, predictor, self.calendar, now)
        return {"cold_start": False, "applied": applied,
                "retrained": retrained, "days_needed": 0}

    # ---- SARIMA -----------------------------------------------------

    def _run_sarima(self, issues: list[dict], state: dict, days: int,
                    now: datetime) -> dict:
        needed = COLD_START_DAYS["sarima"]
        if days < needed:
            return {"cold_start": True, "days_needed": needed - days,
                    "applied": 0, "retrained": False}

        forecaster = None
        if self.sarima_path.exists():
            try:
                forecaster = SARIMAForecaster.load(self.sarima_path)
            except Exception:
                forecaster = None
        if forecaster is None:
            forecaster = SARIMAForecaster(
                calendar=self.calendar, aic_grid=self.sarima_aic_grid,
            )

        retrained = False
        if (forecaster.results_ is None
                or _needs_retrain(self._last_trained(state, "sarima"),
                                  RETRAIN_DAYS["sarima"], now)):
            series = daily_mentions_to_series(state.get("daily_mentions", {}))
            if len(series) < needed:
                return {"cold_start": True, "days_needed": needed - len(series),
                        "applied": 0, "retrained": False,
                        "note": "daily_mentions history too short"}
            try:
                forecaster.fit(series)
            except Exception as e:
                return {"cold_start": False, "applied": 0,
                        "retrained": False, "error": str(e),
                        "days_needed": 0}
            forecaster.save(self.sarima_path)
            self._record_trained(state, "sarima", now)
            retrained = True

        applied = _annotate_sarima(issues, forecaster)
        return {"cold_start": False, "applied": applied,
                "retrained": retrained, "days_needed": 0}

    # ---- public runner ----------------------------------------------

    def run(
        self,
        queue_path: Path,
        state: dict,
        events_count: int = 0,
        now: datetime | None = None,
    ) -> dict:
        """Load queue, apply predictors, persist enriched queue + state.

        Mutates `state` in place: sets `first_cycle_at` (if missing), updates
        `daily_mentions`, and records predictor training timestamps under
        `predictors.{hmm,cox,sarima}.last_trained_at`.
        """
        now = now or _now()
        queue_path = Path(queue_path)

        # Seed the clock on first cycle.
        state.setdefault("first_cycle_at", now.isoformat())
        update_daily_mentions(state, events_count, now)

        days = days_of_data(state, now)

        with open(queue_path) as f:
            issues = json.load(f)
        if not isinstance(issues, list):
            raise ValueError("issue-queue.json must be a JSON list")

        hmm_status = self._run_hmm(issues, state, days, now)
        cox_status = self._run_cox(issues, state, days, now)
        sarima_status = self._run_sarima(issues, state, days, now)

        with open(queue_path, "w") as f:
            json.dump(issues, f, indent=2, default=str)

        return {
            "days_of_data": days,
            "hmm": hmm_status,
            "cox": cox_status,
            "sarima": sarima_status,
        }


# ---- summary helpers used by --status ------------------------------------


def summarize_predictions(issues: list[dict]) -> dict:
    """Aggregate counts + top entries for the status CLI."""
    regime_counts: dict[str, int] = {}
    escalations: list[dict] = []
    imminent: list[dict] = []
    windows_seen: dict | None = None

    for issue in issues:
        pred = issue.get("prediction") or {}
        regime = pred.get("regime")
        if regime:
            regime_counts[regime] = regime_counts.get(regime, 0) + 1
        if pred.get("escalation_eta_cycles") is not None:
            escalations.append({
                "title": issue.get("title"),
                "priority": issue.get("priority"),
                "probabilities": pred.get("probabilities"),
            })
        eh = pred.get("eruption_hours")
        if eh is not None and eh <= 72:
            imminent.append({
                "title": issue.get("title"),
                "priority": issue.get("priority"),
                "eruption_hours": eh,
                "p_eruption_within_72h": pred.get("p_eruption_within_72h"),
            })
        if windows_seen is None and issue.get("upcoming_controversy_windows"):
            windows_seen = issue["upcoming_controversy_windows"]

    escalations.sort(
        key=lambda e: (e.get("probabilities") or {}).get("PRE_CONTROVERSY", 0),
        reverse=True,
    )
    imminent.sort(key=lambda i: i["eruption_hours"])

    return {
        "regime_counts": regime_counts,
        "escalations": escalations,
        "imminent": imminent,
        "upcoming_controversy_windows": windows_seen or {},
    }
