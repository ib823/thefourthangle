"""SARIMAX forecaster for daily mention totals — controversy demand-planning.

Reference: fourth-angle-controversy-radar-framework.md §3.6.

What it does:
    - Fits SARIMAX with weekly seasonality (s=7) on a daily mention-total series.
    - Auto-selects (p, q, P, Q) by AIC given fixed d, D (default 1, 1).
    - Uses five calendar exogenous regressors built from malaysia-calendar.json:
        parliamentary_session, ramadan, school_holiday,
        days_to_budget, sensitivity_date
    - Produces 7/14/30/90/180-day forecasts with 80% and 95% CI.
    - Flags HIGH-CONTROVERSY WINDOWS: forecast days where the predicted mean
      exceeds baseline_mean + 2·baseline_std (the training-set baseline).
    - Feeds back a forecast-anomaly z-score: (actual - forecast) / forecast_sd.

Public API:
    SARIMAForecaster.fit(series, exog=None)
    SARIMAForecaster.forecast(horizon_days=30, levels=(0.80, 0.95))
    SARIMAForecaster.get_high_controversy_windows(horizons=(7, 14, 30, 90, 180), sigma=2.0)
    SARIMAForecaster.get_forecast_anomaly(recent_series)
    SARIMAForecaster.save / load

    build_calendar_exog(dates, calendar, school_holidays=None) -> pd.DataFrame
    generate_synthetic_trends_series(...)  (for bootstrap / testing)
    apply_windows_to_queue(queue_path, forecaster)
"""

from __future__ import annotations

import json
import pickle
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta, date
from itertools import product
from pathlib import Path

import numpy as np
import pandas as pd

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from statsmodels.tsa.statespace.sarimax import SARIMAX

EXOG_COLS = [
    "parliamentary_session",
    "ramadan",
    "school_holiday",
    "days_to_budget",
    "sensitivity_date",
]

FORECAST_HORIZONS = (7, 14, 30, 90, 180)
DEFAULT_SIGMA = 2.0
SENSITIVITY_WINDOW_DAYS = 3

# Malaysian school-term breaks, approximate for 2026. Replace from the calendar
# JSON once explicit school_holiday windows are authoritative there.
DEFAULT_SCHOOL_HOLIDAYS_2026 = [
    ("2026-03-21", "2026-03-28"),
    ("2026-05-30", "2026-06-07"),
    ("2026-08-22", "2026-08-29"),
    ("2026-11-21", "2026-12-31"),
]

# Grid for AIC-based order selection. d/D fixed at 1 (usual for daily series
# with weekly seasonality) to keep the search bounded.
DEFAULT_D = 1
DEFAULT_D_SEASONAL = 1
DEFAULT_SEASON = 7
DEFAULT_AIC_GRID = {
    "p": range(0, 3),
    "q": range(0, 3),
    "P": range(0, 2),
    "Q": range(0, 2),
}


# ---- calendar helpers ----------------------------------------------------


def _to_dt(x) -> datetime:
    if isinstance(x, datetime):
        return x if x.tzinfo else x.replace(tzinfo=timezone.utc)
    if isinstance(x, date):
        return datetime(x.year, x.month, x.day, tzinfo=timezone.utc)
    return datetime.fromisoformat(str(x)).replace(tzinfo=timezone.utc)


def _parse_date(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def _parse_ranges(cfg: dict) -> list[tuple[datetime, datetime]]:
    return [(_parse_date(r["start"]), _parse_date(r["end"]))
            for r in cfg.values()
            if isinstance(r, dict) and "start" in r and "end" in r]


def _in_any_range(dt: datetime, ranges: list[tuple[datetime, datetime]]) -> bool:
    return any(start <= dt <= end for start, end in ranges)


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


def _school_ranges(
    calendar: dict,
    override: list[tuple[str, str]] | None = None,
) -> list[tuple[datetime, datetime]]:
    if override is not None:
        src = override
    else:
        src = calendar.get("school_holidays_2026", DEFAULT_SCHOOL_HOLIDAYS_2026)
    return [(_parse_date(s), _parse_date(e)) for s, e in src]


def build_calendar_exog(
    dates: pd.DatetimeIndex,
    calendar: dict,
    school_holidays: list[tuple[str, str]] | None = None,
) -> pd.DataFrame:
    """Build exogenous regressor DataFrame for the given daily DatetimeIndex.

    Columns match EXOG_COLS. Index is the input dates.
    """
    parl = _parse_ranges(calendar.get("parliamentary_sessions_2026", {}))
    ramadan = _ramadan_range(calendar)
    school = _school_ranges(calendar, school_holidays)
    sensitivity = _sensitivity_dates(calendar)
    budget = _budget_date(calendar)

    rows = []
    for ts in dates:
        dt = _to_dt(ts)
        in_parl = int(_in_any_range(dt, parl))
        in_ram = int(ramadan is not None and ramadan[0] <= dt <= ramadan[1])
        in_school = int(_in_any_range(dt, school))
        near_sens = int(any(
            abs((sd - dt).total_seconds()) <= SENSITIVITY_WINDOW_DAYS * 86400
            for sd in sensitivity
        ))
        if budget:
            d_budget = max(0.0, (budget - dt).total_seconds() / 86400)
        else:
            d_budget = 0.0
        rows.append({
            "parliamentary_session": in_parl,
            "ramadan": in_ram,
            "school_holiday": in_school,
            "days_to_budget": d_budget,
            "sensitivity_date": near_sens,
        })
    return pd.DataFrame(rows, index=dates, columns=EXOG_COLS)


# ---- forecaster ----------------------------------------------------------


@dataclass
class ForecastResult:
    horizon_days: int
    mean: pd.Series                 # index: future dates, values: forecast mean
    ci_80: pd.DataFrame             # columns: lower_80, upper_80
    ci_95: pd.DataFrame             # columns: lower_95, upper_95
    high_controversy_dates: list[str]

    def to_dict(self) -> dict:
        return {
            "horizon_days": self.horizon_days,
            "forecast": [
                {
                    "date": str(ts.date() if hasattr(ts, "date") else ts),
                    "mean": float(self.mean.iloc[i]),
                    "lower_80": float(self.ci_80.iloc[i, 0]),
                    "upper_80": float(self.ci_80.iloc[i, 1]),
                    "lower_95": float(self.ci_95.iloc[i, 0]),
                    "upper_95": float(self.ci_95.iloc[i, 1]),
                }
                for i, ts in enumerate(self.mean.index)
            ],
            "high_controversy_dates": self.high_controversy_dates,
        }


class SARIMAForecaster:
    """Weekly-seasonal SARIMAX on daily mention totals with calendar exogs."""

    def __init__(
        self,
        calendar: dict,
        seasonal_period: int = DEFAULT_SEASON,
        d: int = DEFAULT_D,
        seasonal_d: int = DEFAULT_D_SEASONAL,
        aic_grid: dict | None = None,
        school_holidays: list[tuple[str, str]] | None = None,
        sigma: float = DEFAULT_SIGMA,
    ):
        self.calendar = calendar
        self.seasonal_period = seasonal_period
        self.d = d
        self.seasonal_d = seasonal_d
        self.aic_grid = aic_grid or DEFAULT_AIC_GRID
        self.school_holidays = school_holidays
        self.sigma = sigma

        self.results_ = None          # fitted statsmodels results
        self.order_: tuple | None = None
        self.seasonal_order_: tuple | None = None
        self.aic_: float | None = None
        self.baseline_mean_: float | None = None
        self.baseline_std_: float | None = None
        self.last_fit_at: datetime | None = None
        self.training_end_: pd.Timestamp | None = None
        self.used_exog_: bool = False

    # ---- fitting ---------------------------------------------------------

    def _build_exog(self, dates: pd.DatetimeIndex) -> pd.DataFrame:
        return build_calendar_exog(dates, self.calendar, self.school_holidays)

    def _fit_single(self, series: pd.Series, order, seasonal_order, exog):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = SARIMAX(
                series,
                exog=exog,
                order=order,
                seasonal_order=seasonal_order,
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
            return model.fit(disp=False, maxiter=50)

    def fit(
        self,
        series: pd.Series,
        exog: pd.DataFrame | None = None,
    ) -> "SARIMAForecaster":
        """Fit SARIMAX with AIC-optimal (p, q, P, Q)."""
        if not isinstance(series.index, pd.DatetimeIndex):
            raise ValueError("series must have a DatetimeIndex")
        if series.isna().any():
            series = series.interpolate().ffill().bfill()

        use_exog = exog is not None or self.calendar is not None
        if use_exog and exog is None:
            exog = self._build_exog(series.index)
        if exog is not None:
            exog = exog.reindex(series.index).ffill().bfill()

        best_aic = float("inf")
        best_fit = None
        best_order = None
        best_seasonal = None

        for p, q, P, Q in product(
            self.aic_grid["p"], self.aic_grid["q"],
            self.aic_grid["P"], self.aic_grid["Q"],
        ):
            order = (p, self.d, q)
            seasonal_order = (P, self.seasonal_d, Q, self.seasonal_period)
            try:
                res = self._fit_single(series, order, seasonal_order, exog)
            except Exception:
                continue
            if not np.isfinite(res.aic):
                continue
            if res.aic < best_aic:
                best_aic = res.aic
                best_fit = res
                best_order = order
                best_seasonal = seasonal_order

        if best_fit is None:
            raise RuntimeError("AIC grid search produced no convergent fit")

        self.results_ = best_fit
        self.order_ = best_order
        self.seasonal_order_ = best_seasonal
        self.aic_ = best_aic
        self.baseline_mean_ = float(series.mean())
        self.baseline_std_ = float(series.std(ddof=1))
        self.training_end_ = series.index[-1]
        self.used_exog_ = exog is not None
        self.last_fit_at = datetime.now(timezone.utc)
        return self

    # ---- forecasting ----------------------------------------------------

    def forecast(
        self,
        horizon_days: int = 30,
        levels: tuple[float, float] = (0.80, 0.95),
    ) -> ForecastResult:
        if self.results_ is None:
            raise RuntimeError("fit() before forecast()")

        future_idx = pd.date_range(
            start=self.training_end_ + pd.Timedelta(days=1),
            periods=horizon_days,
            freq="D",
        )
        exog_future = self._build_exog(future_idx) if self.used_exog_ else None
        pred = self.results_.get_forecast(steps=horizon_days, exog=exog_future)

        mean = pred.predicted_mean
        mean.index = future_idx

        ci_80 = pred.conf_int(alpha=1 - levels[0])
        ci_95 = pred.conf_int(alpha=1 - levels[1])
        ci_80.index = future_idx
        ci_95.index = future_idx
        ci_80.columns = ["lower_80", "upper_80"]
        ci_95.columns = ["lower_95", "upper_95"]

        threshold = self.baseline_mean_ + self.sigma * self.baseline_std_
        high_dates = [
            str(ts.date()) for ts, v in mean.items() if v > threshold
        ]

        return ForecastResult(
            horizon_days=horizon_days,
            mean=mean,
            ci_80=ci_80,
            ci_95=ci_95,
            high_controversy_dates=high_dates,
        )

    def get_high_controversy_windows(
        self,
        horizons: tuple[int, ...] = FORECAST_HORIZONS,
        sigma: float | None = None,
    ) -> dict[int, list[dict]]:
        """Return per-horizon list of contiguous date ranges where forecast > mean + sigma*std."""
        if sigma is None:
            sigma = self.sigma
        threshold = self.baseline_mean_ + sigma * self.baseline_std_

        out: dict[int, list[dict]] = {}
        # Fetch the longest forecast once; shorter horizons are prefixes.
        max_h = max(horizons)
        full = self.forecast(horizon_days=max_h)
        for h in horizons:
            sub = full.mean.iloc[:h]
            windows = _contiguous_windows(sub, threshold)
            out[h] = windows
        return out

    def get_forecast_anomaly(self, recent_series: pd.Series) -> list[dict]:
        """Score (actual - forecast) / forecast_sd for each observed day.

        Expects `recent_series` to start on (training_end_ + 1 day) with
        contiguous daily observations. Returns list of per-day z-scores; the
        caller can threshold (e.g., |z| > 2) to trigger detection feedback.
        """
        if self.results_ is None:
            raise RuntimeError("fit() before get_forecast_anomaly()")
        if not isinstance(recent_series.index, pd.DatetimeIndex):
            raise ValueError("recent_series must have a DatetimeIndex")

        horizon = len(recent_series)
        if horizon == 0:
            return []

        future_idx = pd.date_range(
            start=self.training_end_ + pd.Timedelta(days=1),
            periods=horizon,
            freq="D",
        )
        exog_future = self._build_exog(future_idx) if self.used_exog_ else None
        pred = self.results_.get_forecast(steps=horizon, exog=exog_future)
        mean = pred.predicted_mean.values
        # SE of forecast — fall back to baseline std if missing.
        try:
            se = pred.se_mean.values
            se = np.where((se <= 0) | ~np.isfinite(se), self.baseline_std_, se)
        except Exception:
            se = np.full(horizon, self.baseline_std_)

        recent = recent_series.reindex(future_idx).ffill().bfill().values
        z = (recent - mean) / se
        return [
            {
                "date": str(future_idx[i].date()),
                "actual": float(recent[i]),
                "forecast": float(mean[i]),
                "z_score": float(z[i]),
                "anomaly": bool(abs(z[i]) > 2.0),
            }
            for i in range(horizon)
        ]

    # ---- scheduling ----------------------------------------------------

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
                "seasonal_period": self.seasonal_period,
                "d": self.d,
                "seasonal_d": self.seasonal_d,
                "aic_grid": {k: list(v) for k, v in self.aic_grid.items()},
                "school_holidays": self.school_holidays,
                "sigma": self.sigma,
                "results": self.results_,
                "order": self.order_,
                "seasonal_order": self.seasonal_order_,
                "aic": self.aic_,
                "baseline_mean": self.baseline_mean_,
                "baseline_std": self.baseline_std_,
                "training_end": self.training_end_,
                "used_exog": self.used_exog_,
                "last_fit_at": self.last_fit_at.isoformat() if self.last_fit_at else None,
            }, f)

    @classmethod
    def load(cls, path: str | Path) -> "SARIMAForecaster":
        with open(path, "rb") as f:
            d = pickle.load(f)
        f = cls(
            calendar=d["calendar"],
            seasonal_period=d["seasonal_period"],
            d=d["d"],
            seasonal_d=d["seasonal_d"],
            aic_grid={k: list(v) for k, v in d["aic_grid"].items()},
            school_holidays=d["school_holidays"],
            sigma=d["sigma"],
        )
        f.results_ = d["results"]
        f.order_ = d["order"]
        f.seasonal_order_ = d["seasonal_order"]
        f.aic_ = d["aic"]
        f.baseline_mean_ = d["baseline_mean"]
        f.baseline_std_ = d["baseline_std"]
        f.training_end_ = d["training_end"]
        f.used_exog_ = d["used_exog"]
        if d.get("last_fit_at"):
            f.last_fit_at = datetime.fromisoformat(d["last_fit_at"])
        return f


def _contiguous_windows(series: pd.Series, threshold: float) -> list[dict]:
    """Collapse above-threshold days into {start, end, peak} dicts."""
    windows = []
    start = None
    peak = -np.inf
    peak_date = None
    last_ts = None
    for ts, v in series.items():
        above = v > threshold
        if above:
            if start is None:
                start = ts
                peak = v
                peak_date = ts
            elif v > peak:
                peak = v
                peak_date = ts
            last_ts = ts
        else:
            if start is not None:
                windows.append({
                    "start": str(start.date()),
                    "end": str(last_ts.date()),
                    "peak_date": str(peak_date.date()),
                    "peak_value": float(peak),
                })
                start = None
                peak = -np.inf
                peak_date = None
                last_ts = None
    if start is not None:
        windows.append({
            "start": str(start.date()),
            "end": str(last_ts.date()),
            "peak_date": str(peak_date.date()),
            "peak_value": float(peak),
        })
    return windows


# ---- bootstrap synthetic Google Trends history --------------------------


def generate_synthetic_trends_series(
    calendar: dict,
    start: str = "2021-04-01",
    end: str = "2026-04-01",
    base_level: float = 100.0,
    weekly_amplitude: float = 25.0,
    annual_amplitude: float = 15.0,
    noise_std: float = 10.0,
    seed: int = 0,
    school_holidays: list[tuple[str, str]] | None = None,
) -> pd.Series:
    """Synthetic 5-year daily mentions series for bootstrapping / testing.

    Real pipeline should replace this with Google Trends history. The synthetic
    series includes weekly seasonality, annual cycle, calendar-driven bumps, and
    Gaussian noise — enough to exercise SARIMAX order selection.
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start=start, end=end, freq="D")
    t = np.arange(len(dates))

    # Weekly (s=7) and yearly seasonality
    weekly = weekly_amplitude * np.sin(2 * np.pi * t / 7)
    annual = annual_amplitude * np.sin(2 * np.pi * t / 365.25)

    # Gentle upward trend over 5y
    trend = 0.01 * t

    # Calendar bumps — use the 2026 calendar pattern as a plausible proxy.
    exog = build_calendar_exog(dates, calendar, school_holidays)
    calendar_effect = (
        20 * exog["parliamentary_session"].values +
        12 * exog["ramadan"].values +
        -5 * exog["school_holiday"].values +
        25 * exog["sensitivity_date"].values
    )

    noise = rng.normal(0, noise_std, size=len(dates))
    vals = base_level + trend + weekly + annual + calendar_effect + noise
    vals = np.clip(vals, 0, None)
    return pd.Series(vals, index=dates, name="mentions")


# ---- queue integration ---------------------------------------------------


def apply_windows_to_queue(
    queue_path: str | Path,
    forecaster: SARIMAForecaster,
    horizons: tuple[int, ...] = FORECAST_HORIZONS,
    write: bool = True,
) -> list[dict]:
    """Annotate every issue with upcoming_controversy_windows across horizons.

    Windows are global (per-system) since SARIMA runs on aggregate daily totals,
    so every issue carries the same list. This keeps downstream consumers
    able to read the fact from any issue record without a separate metadata file.
    """
    queue_path = Path(queue_path)
    with open(queue_path) as f:
        queue = json.load(f)
    if not isinstance(queue, list):
        raise ValueError("issue-queue.json must be a JSON list")

    try:
        windows = forecaster.get_high_controversy_windows(horizons=horizons)
    except Exception as e:
        # Don't break the queue if forecasting fails; leave field as empty dict.
        windows = {h: [] for h in horizons}
        err_note = str(e)
    else:
        err_note = None

    annotation = {str(h): windows.get(h, []) for h in horizons}
    if err_note:
        annotation["_error"] = err_note

    for issue in queue:
        issue["upcoming_controversy_windows"] = annotation

    if write:
        with open(queue_path, "w") as f:
            json.dump(queue, f, indent=2, default=str)
    return queue


# ---- CLI -----------------------------------------------------------------


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Fit SARIMAX and apply windows to issue queue")
    ap.add_argument("--calendar", default="radar/config/malaysia-calendar.json")
    ap.add_argument("--queue", default="radar/output/issue-queue.json")
    ap.add_argument("--trends", default=None, help="CSV with date,mentions columns")
    ap.add_argument("--model-out", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cal = json.loads(Path(args.calendar).read_text())
    if args.trends:
        df = pd.read_csv(args.trends, parse_dates=["date"]).set_index("date")
        series = df["mentions"]
    else:
        series = generate_synthetic_trends_series(cal)

    f = SARIMAForecaster(calendar=cal).fit(series)
    print(f"order={f.order_}  seasonal={f.seasonal_order_}  AIC={f.aic_:.1f}")
    windows = f.get_high_controversy_windows()
    for h, ws in windows.items():
        print(f"  {h:3d}d horizon: {len(ws)} windows")

    if args.model_out:
        f.save(args.model_out)
        print(f"Saved model to {args.model_out}")

    q = apply_windows_to_queue(args.queue, f, write=not args.dry_run)
    print(f"Annotated {len(q)} issues with upcoming_controversy_windows")
