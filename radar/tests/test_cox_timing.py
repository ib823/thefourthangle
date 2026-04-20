"""Tests for CoxTimingPredictor — hazard direction + survival curve properties."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from radar.prediction.cox_timing import (
    COVARIATE_COLS,
    CoxTimingPredictor,
    HORIZON_IMMINENT_HOURS,
    apply_timing_to_queue,
    bootstrap_synthetic,
    build_covariates,
    load_seed_issues_from_repo,
)


CALENDAR_PATH = Path("radar/config/malaysia-calendar.json")


@pytest.fixture(scope="module")
def calendar() -> dict:
    return json.loads(CALENDAR_PATH.read_text())


@pytest.fixture(scope="module")
def seed_issues() -> list[dict]:
    # Use repo-published issues; fall back to synthetic seeds if none available.
    seeds = load_seed_issues_from_repo(limit=28)
    if len(seeds) >= 10:
        return seeds
    # Synthetic minimum to keep tests green if repo state lacks published issues.
    return [
        {
            "id": f"{i:04d}",
            "headline": f"Seed issue {i}",
            "context": "Test context",
            "cards": [],
            "stageScores": {"pa": 50, "ba": 50, "fc": 50, "af": 50, "ct": 50, "sr": 50},
            "published": True,
        }
        for i in range(28)
    ]


@pytest.fixture(scope="module")
def fitted_predictor(calendar, seed_issues) -> CoxTimingPredictor:
    df = bootstrap_synthetic(seed_issues, calendar, n=500, rng_seed=7)
    pred = CoxTimingPredictor(calendar=calendar).fit(df)
    return pred


# ---- covariate builder ---------------------------------------------------


class TestCovariateBuilder:
    def test_all_12_covariates_returned(self, calendar):
        cov = build_covariates(
            "mosque renovation dispute",
            signals={"polarization": {"er_index": 0.5}},
            occur_dt=datetime(2026, 3, 15, tzinfo=timezone.utc),
            calendar=calendar,
        )
        assert set(cov.keys()) == set(COVARIATE_COLS)
        assert len(cov) == 12

    def test_parliament_flag_true_during_session(self, calendar):
        # First session 2026-03-09 → 2026-04-16
        cov = build_covariates("x", {}, datetime(2026, 3, 20, tzinfo=timezone.utc), calendar)
        assert cov["parliamentary_session"] == 1

    def test_parliament_flag_false_outside_session(self, calendar):
        cov = build_covariates("x", {}, datetime(2026, 5, 1, tzinfo=timezone.utc), calendar)
        assert cov["parliamentary_session"] == 0

    def test_ramadan_detected(self, calendar):
        # Ramadan 2026-02-18 → 2026-03-20
        cov = build_covariates("x", {}, datetime(2026, 3, 1, tzinfo=timezone.utc), calendar)
        assert cov["ramadan"] == 1

    def test_religious_keyword_detected(self, calendar):
        cov = build_covariates("Masjid demolition", {}, datetime(2026, 5, 1, tzinfo=timezone.utc), calendar)
        assert cov["religious_keyword"] == 1

    def test_ethnic_keyword_detected(self, calendar):
        cov = build_covariates("Bumiputera policy debate", {}, datetime(2026, 5, 1, tzinfo=timezone.utc), calendar)
        assert cov["ethnic_keyword"] == 1

    def test_sensitivity_date_may_13(self, calendar):
        cov = build_covariates("x", {}, datetime(2026, 5, 13, tzinfo=timezone.utc), calendar)
        assert cov["sensitivity_date"] == 1

    def test_weekend_detection(self, calendar):
        # 2026-05-02 is a Saturday
        cov = build_covariates("x", {}, datetime(2026, 5, 2, tzinfo=timezone.utc), calendar)
        assert cov["weekend"] == 1
        # 2026-05-04 is a Monday
        cov = build_covariates("x", {}, datetime(2026, 5, 4, tzinfo=timezone.utc), calendar)
        assert cov["weekend"] == 0

    def test_signals_flow_through(self, calendar):
        cov = build_covariates(
            "x",
            {
                "polarization": {"er_index": 0.42},
                "cascade": {"n_star": 0.77},
                "bridge": {"bridge_score": 0.31},
            },
            datetime(2026, 5, 1, tzinfo=timezone.utc),
            calendar,
        )
        assert cov["initial_er_index"] == pytest.approx(0.42)
        assert cov["initial_n_star"] == pytest.approx(0.77)
        assert cov["initial_bridge_score"] == pytest.approx(0.31)


# ---- bootstrap + fit -----------------------------------------------------


class TestBootstrap:
    def test_bootstrap_shape_and_columns(self, calendar, seed_issues):
        df = bootstrap_synthetic(seed_issues, calendar, n=50, rng_seed=0)
        assert len(df) == 50
        assert "duration" in df.columns and "event" in df.columns
        for c in COVARIATE_COLS:
            assert c in df.columns
        assert (df["duration"] > 0).all()
        assert set(df["event"].unique()).issubset({0, 1})

    def test_bootstrap_produces_variance(self, calendar, seed_issues):
        df = bootstrap_synthetic(seed_issues, calendar, n=200, rng_seed=1)
        # At least 8 of 12 covariates should show variance with this many draws.
        with_var = sum(df[c].nunique() > 1 for c in COVARIATE_COLS)
        assert with_var >= 8

    def test_fit_records_timestamp(self, calendar, seed_issues):
        df = bootstrap_synthetic(seed_issues, calendar, n=200, rng_seed=2)
        pred = CoxTimingPredictor(calendar=calendar).fit(df)
        assert pred.last_fit_at is not None
        assert not pred.needs_refit(max_age_days=30)
        # 31 days later → refit due.
        assert pred.needs_refit(
            now=pred.last_fit_at + timedelta(days=31), max_age_days=30
        )


# ---- hazard ratios -------------------------------------------------------


class TestHazardRatios:
    def test_parliament_increases_hazard(self, fitted_predictor):
        hr = fitted_predictor.hazard_ratios()
        assert hr["parliamentary_session"] > 1.0, (
            f"parliamentary_session HR={hr['parliamentary_session']:.2f}, expected >1"
        )

    def test_ramadan_religious_both_increase_hazard(self, fitted_predictor):
        hr = fitted_predictor.hazard_ratios()
        assert hr["ramadan"] > 1.0, f"ramadan HR={hr['ramadan']:.2f}"
        assert hr["religious_keyword"] > 1.0, f"religious_keyword HR={hr['religious_keyword']:.2f}"

    def test_initial_er_index_increases_hazard(self, fitted_predictor):
        # High polarization at detection should accelerate eruption.
        hr = fitted_predictor.hazard_ratios()
        assert hr["initial_er_index"] > 1.0

    def test_weekend_decreases_hazard(self, fitted_predictor):
        # Synthesis coded weekend as decelerator.
        hr = fitted_predictor.hazard_ratios()
        assert hr["weekend"] < 1.0


# ---- survival curve properties ------------------------------------------


class TestSurvivalCurve:
    def test_curve_monotonically_non_increasing(self, fitted_predictor):
        cov = {c: 0.0 for c in COVARIATE_COLS}
        cov["parliamentary_session"] = 1
        cov["initial_er_index"] = 0.5
        pred = fitted_predictor.predict_timing(cov)
        values = [s for _, s in pred.survival_curve]
        # Non-increasing with small numerical slack.
        for a, b in zip(values, values[1:]):
            assert b <= a + 1e-8, f"curve rises at some point: {a} → {b}"
        assert values[0] <= 1.0 + 1e-8
        assert values[-1] >= 0.0 - 1e-8

    def test_curve_starts_near_one(self, fitted_predictor):
        cov = {c: 0.0 for c in COVARIATE_COLS}
        pred = fitted_predictor.predict_timing(cov)
        assert pred.survival_curve[0][1] > 0.8  # early time: most still alive

    def test_median_survival_returned_when_curve_crosses_half(self, fitted_predictor):
        # High-hazard covariate bundle → curve should drop below 0.5 within horizon.
        cov = {c: 0.0 for c in COVARIATE_COLS}
        cov["parliamentary_session"] = 1
        cov["initial_er_index"] = 0.9
        cov["initial_n_star"] = 0.9
        cov["elite_mention"] = 1
        pred = fitted_predictor.predict_timing(cov)
        assert pred.median_survival_hours is not None
        assert 0 < pred.median_survival_hours <= 168

    def test_regime_label_valid(self, fitted_predictor):
        cov = {c: 0.0 for c in COVARIATE_COLS}
        pred = fitted_predictor.predict_timing(cov)
        assert pred.regime in {"accelerating", "decelerating", "flat"}


# ---- imminent eruptions --------------------------------------------------


class TestImminentEruptions:
    def test_imminent_flagged_for_high_hazard(self, fitted_predictor):
        hot = {c: 0.0 for c in COVARIATE_COLS}
        hot["parliamentary_session"] = 1
        hot["initial_er_index"] = 0.9
        hot["initial_n_star"] = 0.9
        hot["religious_keyword"] = 1
        hot["ramadan"] = 1
        hot["elite_mention"] = 1

        cold = {c: 0.0 for c in COVARIATE_COLS}
        cold["weekend"] = 1
        cold["days_to_budget"] = 250
        cold["days_to_election"] = 700

        results = fitted_predictor.get_imminent_eruptions({
            "hot_topic": hot,
            "cold_topic": cold,
        }, horizon_hours=HORIZON_IMMINENT_HOURS, threshold=0.3)

        topics = [r["topic"] for r in results]
        assert "hot_topic" in topics

    def test_imminent_sorted_by_probability(self, fitted_predictor):
        covs = {}
        for i in range(5):
            cov = {c: 0.0 for c in COVARIATE_COLS}
            cov["initial_er_index"] = 0.1 * i + 0.2
            cov["initial_n_star"] = 0.1 * i + 0.2
            covs[f"t{i}"] = cov
        results = fitted_predictor.get_imminent_eruptions(covs, threshold=0.0)
        if len(results) > 1:
            ps = [r["p_eruption_within_horizon"] for r in results]
            assert ps == sorted(ps, reverse=True)


# ---- queue integration ---------------------------------------------------


class TestQueueIntegration:
    def test_apply_timing_writes_predicted_eruption(self, tmp_path: Path, fitted_predictor, calendar):
        queue = [
            {
                "issue_id": "T4A-TEST-001",
                "title": "masjid dispute",
                "timestamp": "2026-03-15T00:00:00+00:00",
                "stream_signals": {
                    "polarization": {"er_index": 0.8},
                    "cascade": {"n_star": 0.7},
                    "bridge": {"bridge_score": 0.4},
                },
            },
            {
                "issue_id": "T4A-TEST-002",
                "title": "weather",
                "timestamp": "2026-07-01T00:00:00+00:00",
                "stream_signals": {},
            },
        ]
        queue_path = tmp_path / "q.json"
        queue_path.write_text(json.dumps(queue))

        updated = apply_timing_to_queue(queue_path, fitted_predictor, calendar)
        for issue in updated:
            assert "predicted_eruption" in issue
            pe = issue["predicted_eruption"]
            assert pe is not None
            assert pe["regime"] in {"accelerating", "decelerating", "flat"}
            assert 0.0 <= pe["p_eruption_within_72h"] <= 1.0

    def test_apply_timing_dry_run(self, tmp_path: Path, fitted_predictor, calendar):
        queue = [{"issue_id": "X", "title": "t", "stream_signals": {}}]
        queue_path = tmp_path / "q.json"
        original = json.dumps(queue)
        queue_path.write_text(original)

        apply_timing_to_queue(queue_path, fitted_predictor, calendar, write=False)
        assert queue_path.read_text() == original


# ---- persistence ---------------------------------------------------------


class TestPersistence:
    def test_save_load_roundtrip(self, tmp_path: Path, fitted_predictor):
        p = tmp_path / "cox.pkl"
        fitted_predictor.save(p)
        loaded = CoxTimingPredictor.load(p)

        cov = {c: 0.0 for c in COVARIATE_COLS}
        cov["initial_er_index"] = 0.5
        p1 = fitted_predictor.predict_timing(cov)
        p2 = loaded.predict_timing(cov)
        assert p1.regime == p2.regime
        assert p1.p_eruption_within_horizon == pytest.approx(p2.p_eruption_within_horizon, abs=1e-6)
