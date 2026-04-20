"""Tests for the prediction pipeline — cold-start, retrain, queue enrichment."""

from __future__ import annotations

import json
import warnings
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from radar.prediction.pipeline import (
    COLD_START_DAYS,
    RETRAIN_DAYS,
    PredictionPipeline,
    daily_mentions_to_series,
    days_of_data,
    summarize_predictions,
    update_daily_mentions,
)

warnings.filterwarnings("ignore")

CALENDAR_PATH = Path("radar/config/malaysia-calendar.json")


@pytest.fixture(scope="module")
def calendar() -> dict:
    return json.loads(CALENDAR_PATH.read_text())


def _sample_queue():
    return [
        {
            "issue_id": "T4A-TEST-001",
            "title": "masjid renovation",
            "controversy_score": 0.82,
            "confidence": 0.75,
            "priority": "critical",
            "timestamp": "2026-03-15T00:00:00+00:00",
            "stream_signals": {
                "volume": {"z_score": 3.0, "severity": 0.8},
                "polarization": {"er_index": 0.7, "max_pairwise_divergence": 0.6},
                "cascade": {"n_star": 0.5},
                "bridge": {"bridge_score": 0.3},
            },
        },
        {
            "issue_id": "T4A-TEST-002",
            "title": "weather",
            "controversy_score": 0.2,
            "confidence": 0.5,
            "priority": "low",
            "timestamp": "2026-07-01T00:00:00+00:00",
            "stream_signals": {
                "volume": {"z_score": 0.1},
                "polarization": {"er_index": 0.05},
            },
        },
    ]


def _write_queue(path: Path, queue: list[dict]):
    path.write_text(json.dumps(queue))


# ---- data-age bookkeeping ------------------------------------------------


class TestDataAgeTracking:
    def test_first_cycle_at_not_set(self):
        assert days_of_data({}) == 0

    def test_days_of_data_elapsed(self):
        ten_days_ago = datetime.now(timezone.utc) - timedelta(days=10)
        state = {"first_cycle_at": ten_days_ago.isoformat()}
        assert days_of_data(state) == 10

    def test_update_daily_mentions_accumulates(self):
        state = {}
        now = datetime(2026, 4, 19, 12, tzinfo=timezone.utc)
        update_daily_mentions(state, 100, now)
        update_daily_mentions(state, 25, now)
        assert state["daily_mentions"]["2026-04-19"] == 125

    def test_update_daily_mentions_prunes_old(self):
        state = {"daily_mentions": {"2019-01-01": 5, "2026-04-19": 10}}
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        update_daily_mentions(state, 0, now)
        assert "2019-01-01" not in state["daily_mentions"]
        assert "2026-04-19" in state["daily_mentions"]

    def test_daily_mentions_to_series_fills_gaps(self):
        daily = {"2026-04-01": 10, "2026-04-03": 20}
        series = daily_mentions_to_series(daily)
        assert len(series) == 3  # 01, 02, 03
        assert series.iloc[0] == 10.0
        assert series.iloc[1] == 0.0  # gap day
        assert series.iloc[2] == 20.0


# ---- cold-start gating ---------------------------------------------------


@pytest.fixture
def pipeline(tmp_path: Path, calendar) -> PredictionPipeline:
    return PredictionPipeline(
        calendar=calendar,
        models_dir=tmp_path / "models",
        issues_dir=Path("src/data/issues"),
        cox_bootstrap_n=80,
        sarima_aic_grid={"p": range(0, 2), "q": range(0, 2),
                         "P": range(0, 2), "Q": range(0, 2)},
    )


class TestColdStart:
    def test_day_zero_skips_all_predictors(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        state = {}
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        result = pipeline.run(queue_path, state, events_count=50, now=now)
        for key in ("hmm", "cox", "sarima"):
            assert result[key]["cold_start"] is True
            assert result[key]["applied"] == 0
        # No prediction blocks were written.
        q = json.loads(queue_path.read_text())
        assert all("prediction" not in i for i in q)

    def test_day_7_hmm_runs_but_cox_sarima_skip(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=7)).isoformat()}
        result = pipeline.run(queue_path, state, events_count=50, now=now)
        assert result["hmm"]["cold_start"] is False
        assert result["cox"]["cold_start"] is True
        assert result["cox"]["days_needed"] == COLD_START_DAYS["cox"] - 7
        assert result["sarima"]["cold_start"] is True
        # HMM annotated both issues (both have some signal).
        q = json.loads(queue_path.read_text())
        regimes = [i.get("prediction", {}).get("regime") for i in q]
        assert any(r is not None for r in regimes)

    def test_day_14_cox_joins(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=14)).isoformat()}
        result = pipeline.run(queue_path, state, events_count=50, now=now)
        assert result["hmm"]["cold_start"] is False
        assert result["cox"]["cold_start"] is False
        assert result["cox"]["retrained"] is True
        assert result["sarima"]["cold_start"] is True

    def test_day_30_with_mentions_history_sarima_joins(self, tmp_path, pipeline, calendar):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)

        # Pre-seed 60 days of daily mentions so SARIMA has enough history.
        daily = {}
        rng = np.random.default_rng(0)
        for i in range(60):
            d = (now - timedelta(days=60 - i)).date().isoformat()
            daily[d] = int(100 + rng.normal(0, 10))
        state = {
            "first_cycle_at": (now - timedelta(days=35)).isoformat(),
            "daily_mentions": daily,
        }
        result = pipeline.run(queue_path, state, events_count=50, now=now)
        assert result["sarima"]["cold_start"] is False
        assert result["sarima"]["retrained"] is True
        q = json.loads(queue_path.read_text())
        assert all("upcoming_controversy_windows" in i for i in q)


# ---- retrain cadence -----------------------------------------------------


class TestRetrainCadence:
    def test_retrain_cadence_values(self):
        assert RETRAIN_DAYS["hmm"] == 7
        assert RETRAIN_DAYS["cox"] == 30
        assert RETRAIN_DAYS["sarima"] == 7

    def test_cox_refits_after_month(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=20)).isoformat()}

        pipeline.run(queue_path, state, events_count=50, now=now)
        assert state["predictors"]["cox"]["last_trained_at"] is not None

        # Run again 5 days later — not due yet.
        _write_queue(queue_path, _sample_queue())
        result2 = pipeline.run(queue_path, state, events_count=50,
                               now=now + timedelta(days=5))
        assert result2["cox"]["retrained"] is False

        # Run again 31 days later — due.
        _write_queue(queue_path, _sample_queue())
        result3 = pipeline.run(queue_path, state, events_count=50,
                               now=now + timedelta(days=31))
        assert result3["cox"]["retrained"] is True

    def test_hmm_refits_weekly(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=10)).isoformat()}

        pipeline.run(queue_path, state, events_count=50, now=now)

        _write_queue(queue_path, _sample_queue())
        result2 = pipeline.run(queue_path, state, events_count=50,
                               now=now + timedelta(days=3))
        assert result2["hmm"]["retrained"] is False

        _write_queue(queue_path, _sample_queue())
        result3 = pipeline.run(queue_path, state, events_count=50,
                               now=now + timedelta(days=8))
        assert result3["hmm"]["retrained"] is True


# ---- unified prediction block -------------------------------------------


class TestPredictionBlock:
    def test_block_has_expected_keys_after_cox(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=14)).isoformat()}
        pipeline.run(queue_path, state, events_count=50, now=now)

        q = json.loads(queue_path.read_text())
        expected = {"regime", "probabilities", "eruption_hours",
                    "confidence", "risk_factors", "survival_curve"}
        for issue in q:
            pred = issue.get("prediction") or {}
            # Confidence always present once Cox runs.
            if pred:
                assert expected.issubset(pred.keys()), (
                    f"missing keys: {expected - set(pred.keys())}"
                )

    def test_probabilities_sum_to_one(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=7)).isoformat()}
        pipeline.run(queue_path, state, events_count=50, now=now)

        q = json.loads(queue_path.read_text())
        for issue in q:
            probs = (issue.get("prediction") or {}).get("probabilities")
            if probs:
                assert sum(probs.values()) == pytest.approx(1.0, abs=1e-6)

    def test_risk_factors_sorted_by_contribution(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=14)).isoformat()}
        pipeline.run(queue_path, state, events_count=50, now=now)
        q = json.loads(queue_path.read_text())
        for issue in q:
            rf = (issue.get("prediction") or {}).get("risk_factors")
            if rf:
                abs_contribs = [abs(r["contribution"]) for r in rf]
                assert abs_contribs == sorted(abs_contribs, reverse=True)

    def test_survival_curve_trimmed(self, tmp_path, pipeline):
        queue_path = tmp_path / "q.json"
        _write_queue(queue_path, _sample_queue())
        now = datetime(2026, 4, 19, tzinfo=timezone.utc)
        state = {"first_cycle_at": (now - timedelta(days=14)).isoformat()}
        pipeline.run(queue_path, state, events_count=50, now=now)
        q = json.loads(queue_path.read_text())
        for issue in q:
            curve = (issue.get("prediction") or {}).get("survival_curve")
            if curve:
                assert 2 <= len(curve) <= 32  # bounded, not unbounded


# ---- summary helpers -----------------------------------------------------


class TestSummary:
    def test_summarize_counts_regimes(self):
        issues = [
            {"title": "a", "prediction": {"regime": "STABLE"}},
            {"title": "b", "prediction": {"regime": "STABLE"}},
            {"title": "c", "prediction": {"regime": "PRE_CONTROVERSY",
                                          "probabilities": {"PRE_CONTROVERSY": 0.7,
                                                            "STABLE": 0.3}}},
        ]
        out = summarize_predictions(issues)
        assert out["regime_counts"] == {"STABLE": 2, "PRE_CONTROVERSY": 1}

    def test_summarize_flags_imminent(self):
        issues = [
            {"title": "hot", "prediction": {
                "eruption_hours": 12, "p_eruption_within_72h": 0.85}},
            {"title": "calm", "prediction": {
                "eruption_hours": 500, "p_eruption_within_72h": 0.05}},
        ]
        out = summarize_predictions(issues)
        assert len(out["imminent"]) == 1
        assert out["imminent"][0]["title"] == "hot"

    def test_summarize_captures_windows(self):
        issues = [
            {"title": "x", "upcoming_controversy_windows": {
                "7": [{"start": "2026-04-20", "end": "2026-04-22",
                       "peak_date": "2026-04-21", "peak_value": 150.0}],
                "30": [],
            }},
        ]
        out = summarize_predictions(issues)
        assert "7" in out["upcoming_controversy_windows"]
