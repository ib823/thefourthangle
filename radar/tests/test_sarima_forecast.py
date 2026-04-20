"""Tests for SARIMAForecaster — seasonality, calendar-regressor AIC, anomalies."""

from __future__ import annotations

import json
import warnings
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from radar.prediction.sarima_forecast import (
    DEFAULT_AIC_GRID,
    EXOG_COLS,
    FORECAST_HORIZONS,
    SARIMAForecaster,
    _contiguous_windows,
    apply_windows_to_queue,
    build_calendar_exog,
    generate_synthetic_trends_series,
)

warnings.filterwarnings("ignore")

CALENDAR_PATH = Path("radar/config/malaysia-calendar.json")


@pytest.fixture(scope="module")
def calendar() -> dict:
    return json.loads(CALENDAR_PATH.read_text())


@pytest.fixture(scope="module")
def series_with_season(calendar) -> pd.Series:
    """6-month synthetic series — fast enough for tests, long enough for s=7."""
    return generate_synthetic_trends_series(
        calendar,
        start="2025-10-01",
        end="2026-04-01",
        seed=42,
    )


# Small AIC grid keeps the test suite fast.
SMALL_GRID = {"p": range(0, 2), "q": range(0, 2), "P": range(0, 2), "Q": range(0, 2)}


@pytest.fixture(scope="module")
def fitted(calendar, series_with_season) -> SARIMAForecaster:
    f = SARIMAForecaster(calendar=calendar, aic_grid=SMALL_GRID).fit(series_with_season)
    return f


# ---- calendar exog builder -----------------------------------------------


class TestCalendarExog:
    def test_shape_and_columns(self, calendar):
        idx = pd.date_range("2026-03-01", periods=30, freq="D")
        exog = build_calendar_exog(idx, calendar)
        assert list(exog.columns) == EXOG_COLS
        assert len(exog) == 30
        assert (exog.index == idx).all()

    def test_parliament_binary_during_session(self, calendar):
        idx = pd.date_range("2026-03-09", periods=10, freq="D")
        exog = build_calendar_exog(idx, calendar)
        assert (exog["parliamentary_session"] == 1).all()

    def test_ramadan_flag_within_window(self, calendar):
        idx = pd.date_range("2026-02-20", periods=5, freq="D")
        exog = build_calendar_exog(idx, calendar)
        assert (exog["ramadan"] == 1).all()

    def test_school_holiday_default_range(self, calendar):
        idx = pd.date_range("2026-05-30", periods=5, freq="D")
        exog = build_calendar_exog(idx, calendar)
        assert (exog["school_holiday"] == 1).all()

    def test_sensitivity_date_may_13(self, calendar):
        idx = pd.date_range("2026-05-12", periods=3, freq="D")
        exog = build_calendar_exog(idx, calendar)
        assert (exog["sensitivity_date"] == 1).all()

    def test_days_to_budget_decreases(self, calendar):
        idx = pd.date_range("2026-09-01", periods=30, freq="D")
        exog = build_calendar_exog(idx, calendar)
        d = exog["days_to_budget"].values
        # Should be strictly decreasing by 1/day until budget day.
        assert all(d[i] > d[i + 1] for i in range(len(d) - 1))


# ---- fitting + seasonality -----------------------------------------------


class TestFit:
    def test_records_model_state(self, fitted):
        assert fitted.results_ is not None
        assert fitted.order_ is not None
        assert fitted.seasonal_order_ is not None
        assert fitted.seasonal_order_[-1] == 7  # weekly period
        assert fitted.aic_ is not None
        assert fitted.baseline_mean_ > 0
        assert fitted.baseline_std_ >= 0
        assert fitted.last_fit_at is not None

    def test_refit_schedule(self, fitted):
        assert not fitted.needs_refit(max_age_days=30)
        late = fitted.last_fit_at + timedelta(days=31)
        assert fitted.needs_refit(now=late, max_age_days=30)

    def test_weekly_seasonality_recovered(self, calendar, series_with_season):
        """Residuals of the fitted model should show less weekly-lag structure
        than the raw series — i.e., the model captured the s=7 pattern."""
        f = SARIMAForecaster(calendar=calendar, aic_grid=SMALL_GRID).fit(series_with_season)
        raw = series_with_season.values
        raw_lag7_acf = np.corrcoef(raw[:-7], raw[7:])[0, 1]
        resid = f.results_.resid.values
        resid = resid[~np.isnan(resid)]
        if len(resid) > 14:
            resid_lag7_acf = np.corrcoef(resid[:-7], resid[7:])[0, 1]
            assert abs(resid_lag7_acf) < abs(raw_lag7_acf), (
                f"residual 7-lag ACF {resid_lag7_acf:.3f} "
                f"vs raw {raw_lag7_acf:.3f} — seasonality not absorbed"
            )


class TestCalendarImprovesAIC:
    def test_exog_lowers_or_matches_aic(self, calendar, series_with_season):
        """With calendar-driven bumps in the generator, adding exogs should help AIC.

        We fit twice: once with calendar exogs (the forecaster's default), once with
        a zero-matrix exog of the same shape (structurally matched but uninformative).
        The zero-exog fit has the same parameter count as the informative one, so
        AIC comparison is apples-to-apples.
        """
        f_with = SARIMAForecaster(
            calendar=calendar, aic_grid=SMALL_GRID,
        ).fit(series_with_season)

        zero_exog = build_calendar_exog(series_with_season.index, calendar) * 0.0
        f_without = SARIMAForecaster(
            calendar=calendar, aic_grid=SMALL_GRID,
        ).fit(series_with_season, exog=zero_exog)

        assert f_with.aic_ < f_without.aic_, (
            f"calendar exogs did not improve AIC: "
            f"with={f_with.aic_:.1f} vs without={f_without.aic_:.1f}"
        )


# ---- forecast -------------------------------------------------------------


class TestForecast:
    def test_forecast_7_days(self, fitted):
        r = fitted.forecast(horizon_days=7)
        assert len(r.mean) == 7
        assert r.mean.index[0] == fitted.training_end_ + pd.Timedelta(days=1)

    def test_ci_order_80_95(self, fitted):
        r = fitted.forecast(horizon_days=14)
        # 95% CI must be at least as wide as 80% CI at every step.
        for i in range(14):
            w80 = r.ci_80.iloc[i, 1] - r.ci_80.iloc[i, 0]
            w95 = r.ci_95.iloc[i, 1] - r.ci_95.iloc[i, 0]
            assert w95 >= w80 - 1e-6, f"95% CI narrower than 80% at step {i}"

    def test_all_horizons_produce_forecast(self, fitted):
        for h in FORECAST_HORIZONS:
            r = fitted.forecast(horizon_days=h)
            assert len(r.mean) == h

    def test_high_controversy_dates_in_horizon(self, fitted):
        r = fitted.forecast(horizon_days=30)
        threshold = fitted.baseline_mean_ + fitted.sigma * fitted.baseline_std_
        for d_str in r.high_controversy_dates:
            d = pd.Timestamp(d_str)
            assert d in r.mean.index
            assert r.mean.loc[d] > threshold


class TestHighControversyWindows:
    def test_per_horizon_dict_keys(self, fitted):
        out = fitted.get_high_controversy_windows(horizons=(7, 14, 30))
        assert set(out.keys()) == {7, 14, 30}

    def test_windows_consistent_with_threshold(self, fitted):
        threshold = fitted.baseline_mean_ + fitted.sigma * fitted.baseline_std_
        out = fitted.get_high_controversy_windows(horizons=(30,))
        for w in out[30]:
            assert "start" in w and "end" in w and "peak_value" in w
            assert w["peak_value"] > threshold

    def test_contiguous_window_helper(self):
        idx = pd.date_range("2026-01-01", periods=10, freq="D")
        vals = [0, 5, 6, 6, 0, 0, 7, 0, 0, 8]  # two spans above threshold=3
        series = pd.Series(vals, index=idx)
        windows = _contiguous_windows(series, threshold=3)
        # Expect three windows: (Jan 2-4), (Jan 7), (Jan 10)
        assert len(windows) == 3
        assert windows[0]["start"] == "2026-01-02"
        assert windows[0]["end"] == "2026-01-04"
        assert windows[0]["peak_value"] == 6.0


# ---- anomaly detection ---------------------------------------------------


class TestAnomaly:
    def test_anomaly_flags_large_deviation(self, fitted):
        future_idx = pd.date_range(
            start=fitted.training_end_ + pd.Timedelta(days=1),
            periods=7, freq="D",
        )
        # Build a recent series that's way above the training mean.
        spike = pd.Series(
            [fitted.baseline_mean_ + 10 * fitted.baseline_std_] * 7,
            index=future_idx,
        )
        out = fitted.get_forecast_anomaly(spike)
        assert len(out) == 7
        assert any(r["anomaly"] for r in out), "huge deviation produced no anomaly"
        assert all(r["z_score"] > 0 for r in out)

    def test_anomaly_quiet_when_on_target(self, fitted):
        r = fitted.forecast(horizon_days=7)
        # Reuse the forecast mean as "actual" — z should be near zero.
        out = fitted.get_forecast_anomaly(r.mean)
        z_values = [abs(o["z_score"]) for o in out]
        assert max(z_values) < 1.0, f"quiet anomaly z={max(z_values):.2f}"

    def test_anomaly_payload_fields(self, fitted):
        future_idx = pd.date_range(
            start=fitted.training_end_ + pd.Timedelta(days=1),
            periods=3, freq="D",
        )
        actual = pd.Series([fitted.baseline_mean_] * 3, index=future_idx)
        out = fitted.get_forecast_anomaly(actual)
        for row in out:
            assert {"date", "actual", "forecast", "z_score", "anomaly"} <= set(row.keys())
            assert isinstance(row["anomaly"], bool)


# ---- queue integration + persistence -------------------------------------


class TestQueueIntegration:
    def test_apply_windows_to_queue(self, tmp_path: Path, fitted):
        queue = [
            {"issue_id": "T4A-TEST-001", "title": "a", "stream_signals": {}},
            {"issue_id": "T4A-TEST-002", "title": "b", "stream_signals": {}},
        ]
        queue_path = tmp_path / "q.json"
        queue_path.write_text(json.dumps(queue))

        updated = apply_windows_to_queue(queue_path, fitted, horizons=(7, 30))
        for issue in updated:
            assert "upcoming_controversy_windows" in issue
            w = issue["upcoming_controversy_windows"]
            assert "7" in w and "30" in w

        reread = json.loads(queue_path.read_text())
        assert reread[0]["upcoming_controversy_windows"] == updated[0]["upcoming_controversy_windows"]

    def test_apply_windows_dry_run(self, tmp_path: Path, fitted):
        queue = [{"issue_id": "X", "title": "x", "stream_signals": {}}]
        queue_path = tmp_path / "q.json"
        original = json.dumps(queue)
        queue_path.write_text(original)
        apply_windows_to_queue(queue_path, fitted, write=False)
        assert queue_path.read_text() == original


class TestPersistence:
    def test_save_load_roundtrip(self, tmp_path: Path, fitted):
        p = tmp_path / "sarima.pkl"
        fitted.save(p)
        loaded = SARIMAForecaster.load(p)
        assert loaded.order_ == fitted.order_
        assert loaded.seasonal_order_ == fitted.seasonal_order_
        r1 = fitted.forecast(horizon_days=7)
        r2 = loaded.forecast(horizon_days=7)
        assert np.allclose(r1.mean.values, r2.mean.values, rtol=1e-6)
