"""Stream 2: Cascade Tracker — Hawkes Process for virality detection.

Monitors self-exciting event cascades using:
  - Univariate Hawkes with exponential kernel (O(1) recursive intensity)
  - Branching ratio n* = alpha/beta as criticality indicator
  - Multivariate Hawkes for cross-platform triggering
  - Cascade size prediction via branching ratio

Reference: framework §2.3 (Hawkes Processes)
"""

from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

import numpy as np
from scipy.optimize import minimize
from loguru import logger


class UnivariateHawkes:
    """Hawkes process with exponential kernel and O(1) recursive updates.

    Intensity: lambda*(t) = mu + sum_{t_i < t} alpha * exp(-beta * (t - t_i))
    Recursive:  lambda*(t_{k+1}) = mu + (lambda*(t_k) - mu + alpha) * exp(-beta * dt)
    """

    def __init__(self, mu: float = 1.0, alpha: float = 0.5, beta: float = 1.0):
        self.mu = mu
        self.alpha = alpha
        self.beta = beta
        self._intensity = mu  # Current intensity (recursive)
        self._last_time: float | None = None
        self._event_times: list[float] = []
        self._max_events = 2000

    @property
    def branching_ratio(self) -> float:
        """n* = alpha / beta. Critical when n* >= 1."""
        if self.beta <= 0:
            return float("inf")
        return self.alpha / self.beta

    def intensity(self, t: float) -> float:
        """Compute intensity at time t using recursive formula."""
        if self._last_time is None:
            return self.mu
        dt = t - self._last_time
        if dt < 0:
            return self.mu
        return self.mu + (self._intensity - self.mu) * np.exp(-self.beta * dt)

    def add_event(self, t: float):
        """Register event at time t and update recursive intensity."""
        if self._last_time is not None:
            dt = t - self._last_time
            if dt >= 0:
                self._intensity = self.mu + (self._intensity - self.mu + self.alpha) * np.exp(-self.beta * dt)
            else:
                self._intensity = self.mu + self.alpha
        else:
            self._intensity = self.mu + self.alpha

        self._last_time = t
        self._event_times.append(t)

        # Trim old events
        if len(self._event_times) > self._max_events:
            self._event_times = self._event_times[-self._max_events:]

    def log_likelihood(self, params: np.ndarray, times: np.ndarray) -> float:
        """Negative log-likelihood for MLE. Uses recursive computation."""
        mu, alpha, beta = params
        if mu <= 0 or alpha < 0 or beta <= 0:
            return 1e10
        if alpha / beta >= 1.0:
            # Penalize supercritical to keep optimization stable
            pass  # Allow but don't force subcritical

        n = len(times)
        if n == 0:
            return 1e10

        T = times[-1] - times[0]
        if T <= 0:
            return 1e10

        # Recursive intensity computation
        log_lam_sum = 0.0
        A = 0.0  # Recursive kernel sum

        for i in range(n):
            if i > 0:
                dt = times[i] - times[i - 1]
                A = np.exp(-beta * dt) * (A + 1.0)

            lam = mu + alpha * A
            if lam <= 0:
                return 1e10
            log_lam_sum += np.log(lam)

        # Integral of intensity: mu*T + (alpha/beta) * sum(1 - exp(-beta*(T - t_i)))
        # Use shifted times
        t0 = times[0]
        integral = mu * T
        for ti in times:
            integral += (alpha / beta) * (1.0 - np.exp(-beta * (times[-1] - ti)))

        nll = -log_lam_sum + integral
        return nll

    def fit(self, times: np.ndarray) -> dict:
        """Fit parameters via MLE. Returns {mu, alpha, beta, n_star, success}."""
        if len(times) < 5:
            return {"mu": self.mu, "alpha": self.alpha, "beta": self.beta,
                    "n_star": self.branching_ratio, "success": False}

        # Sort and shift to start at 0
        times = np.sort(times)
        times = times - times[0]

        x0 = np.array([self.mu, self.alpha, self.beta])
        bounds = [(1e-6, None), (1e-6, None), (1e-6, None)]

        try:
            result = minimize(
                self.log_likelihood,
                x0,
                args=(times,),
                method="L-BFGS-B",
                bounds=bounds,
                options={"maxiter": 200},
            )
            if result.success or result.fun < self.log_likelihood(x0, times):
                self.mu, self.alpha, self.beta = result.x
        except Exception:
            return {"mu": self.mu, "alpha": self.alpha, "beta": self.beta,
                    "n_star": self.branching_ratio, "success": False}

        return {
            "mu": float(self.mu),
            "alpha": float(self.alpha),
            "beta": float(self.beta),
            "n_star": float(self.branching_ratio),
            "success": True,
        }

    def cheap_branching_estimate(self, times: np.ndarray, window_seconds: float = 3600) -> float:
        """Hardiman-Bouchaud approximation: n* ≈ 1 - mean²/variance."""
        if len(times) < 10:
            return 0.0

        # Count events in fixed windows
        t_min, t_max = times[0], times[-1]
        total_duration = t_max - t_min
        if total_duration <= 0:
            return 0.0

        n_windows = max(int(total_duration / window_seconds), 2)
        counts = np.zeros(n_windows)
        for t in times:
            idx = min(int((t - t_min) / window_seconds), n_windows - 1)
            counts[idx] += 1

        mean = np.mean(counts)
        var = np.var(counts)
        if var <= 0 or mean <= 0:
            return 0.0

        n_star = 1.0 - (mean ** 2 / var)
        return max(0.0, min(n_star, 2.0))  # Clamp

    def predict_cascade_size(self, current_size: int) -> dict:
        """Predict final cascade size given current n* and observed size."""
        n_star = self.branching_ratio
        if n_star >= 1.0:
            return {"expected_total": float("inf"), "n_star": n_star,
                    "ci_low": current_size, "ci_high": float("inf")}

        expected = current_size / (1.0 - n_star)
        # Rough CI based on parameter uncertainty
        ci_low = current_size / max(1.0 - n_star * 1.2, 0.01)
        ci_high = current_size / max(1.0 - n_star * 0.8, 0.01) if n_star < 0.8 else float("inf")

        return {
            "expected_total": float(expected),
            "n_star": float(n_star),
            "ci_low": float(min(ci_low, ci_high)),
            "ci_high": float(max(ci_low, ci_high)),
        }


class MultivariateHawkes:
    """Cross-platform Hawkes process tracking infectivity between K platforms."""

    def __init__(self, platforms: list[str]):
        self.platforms = platforms
        self.K = len(platforms)
        self.platform_idx = {p: i for i, p in enumerate(platforms)}
        # Infectivity matrix A[i,j] = excitation from platform i to platform j
        self.A = np.zeros((self.K, self.K))
        self._event_counts = np.zeros((self.K, self.K))
        self._total_events = np.zeros(self.K)

    def record_event(self, platform: str, triggered_by: str | None = None):
        """Record an event and its triggering source."""
        if platform not in self.platform_idx:
            return
        j = self.platform_idx[platform]
        self._total_events[j] += 1

        if triggered_by and triggered_by in self.platform_idx:
            i = self.platform_idx[triggered_by]
            self._event_counts[i, j] += 1

    def estimate_infectivity(self):
        """Estimate infectivity matrix from event counts."""
        for j in range(self.K):
            total = self._total_events[j]
            if total > 0:
                self.A[:, j] = self._event_counts[:, j] / total

    @property
    def spectral_radius(self) -> float:
        """Spectral radius of A. Must be < 1 for stationarity."""
        eigenvalues = np.linalg.eigvals(self.A)
        return float(np.max(np.abs(eigenvalues)))

    def get_leader(self) -> str | None:
        """Platform with highest outgoing excitation."""
        if np.sum(self.A) == 0:
            return None
        outgoing = np.sum(self.A, axis=1)
        return self.platforms[int(np.argmax(outgoing))]


class CascadeTracker:
    """Groups events by topic and monitors Hawkes cascade dynamics."""

    def __init__(self, config: dict):
        self.config = config
        self.log = logger.bind(component="cascade_tracker")

        hawkes_cfg = config.get("hawkes", {})
        self.initial_mu = hawkes_cfg.get("initial_mu", 1.0)
        self.initial_alpha = hawkes_cfg.get("initial_alpha", 0.5)
        self.initial_beta = hawkes_cfg.get("initial_beta", 1.0)

        thresholds = config.get("branching_ratio_thresholds", {})
        self.threshold_normal = thresholds.get("normal", 0.5)
        self.threshold_elevated = thresholds.get("elevated", 0.8)
        self.threshold_critical = thresholds.get("critical", 1.0)

        self.refit_events = config.get("refit_interval_events", 100)
        self.refit_minutes = config.get("refit_interval_minutes", 30)
        self.window_events = config.get("window_events", 500)

        # Per-keyword tracking
        self._hawkes: dict[str, UnivariateHawkes] = {}
        self._event_times: dict[str, list[float]] = defaultdict(list)
        self._event_count_since_fit: dict[str, int] = defaultdict(int)
        self._last_fit_time: dict[str, datetime] = {}
        self._n_star_history: dict[str, list[tuple[datetime, float]]] = defaultdict(list)
        self._alerts: list[dict] = []

        # Cross-platform tracking
        self._platforms = ["twitter", "news", "gdelt", "forum"]
        self._mv_hawkes: dict[str, MultivariateHawkes] = {}

    def process(self, events: list[dict[str, Any]]):
        """Process batch of events, tracking cascades per keyword."""
        for event in events:
            text = event.get("text", "")
            platform = event.get("platform", "unknown")
            timestamp_str = event.get("timestamp", "")

            try:
                if isinstance(timestamp_str, str):
                    ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                else:
                    ts = timestamp_str
            except (ValueError, TypeError):
                ts = datetime.now(timezone.utc)

            t_seconds = ts.timestamp()

            # Simple keyword extraction (first significant word)
            keywords = self._extract_keywords(text)
            for kw in keywords:
                self._add_event(kw, t_seconds, ts, platform)

    def _extract_keywords(self, text: str) -> list[str]:
        words = text.lower().split()
        stop = {"the", "a", "an", "is", "was", "are", "in", "on", "at", "to", "for",
                "of", "and", "or", "but", "yang", "dan", "ini", "itu", "di", "ke"}
        significant = [w for w in words if len(w) > 3 and w not in stop]
        return [significant[0]] if significant else ["_general"]

    def add_event(self, keyword: str, t_seconds: float, timestamp: datetime, platform: str = "unknown"):
        """Public interface for adding events directly (used in testing)."""
        self._add_event(keyword, t_seconds, timestamp, platform)

    def _add_event(self, keyword: str, t_seconds: float, timestamp: datetime, platform: str):
        """Add event and check if refit/alert is needed."""
        # Initialize Hawkes if needed
        if keyword not in self._hawkes:
            self._hawkes[keyword] = UnivariateHawkes(
                self.initial_mu, self.initial_alpha, self.initial_beta
            )
            self._mv_hawkes[keyword] = MultivariateHawkes(self._platforms)

        hawkes = self._hawkes[keyword]
        hawkes.add_event(t_seconds)
        self._event_times[keyword].append(t_seconds)
        self._event_count_since_fit[keyword] += 1

        # Track cross-platform
        if platform in self._mv_hawkes[keyword].platform_idx:
            self._mv_hawkes[keyword].record_event(platform)

        # Trim event times
        if len(self._event_times[keyword]) > self.window_events:
            self._event_times[keyword] = self._event_times[keyword][-self.window_events:]

        # Check if refit is needed
        should_refit = (
            self._event_count_since_fit[keyword] >= self.refit_events
            or keyword not in self._last_fit_time
            or (timestamp - self._last_fit_time.get(keyword, timestamp)).total_seconds() > self.refit_minutes * 60
        )

        if should_refit and len(self._event_times[keyword]) >= 10:
            times = np.array(self._event_times[keyword])
            fit_result = hawkes.fit(times)
            self._event_count_since_fit[keyword] = 0
            self._last_fit_time[keyword] = timestamp

            n_star = hawkes.branching_ratio
            cheap_n_star = hawkes.cheap_branching_estimate(times)

            self._n_star_history[keyword].append((timestamp, n_star))
            # Keep last 100 history entries
            if len(self._n_star_history[keyword]) > 100:
                self._n_star_history[keyword] = self._n_star_history[keyword][-100:]

            # Determine alert level
            alert_level = self._get_alert_level(n_star)
            n_star_trend = self._get_trend(keyword)

            # Cross-platform analysis
            self._mv_hawkes[keyword].estimate_infectivity()
            leader = self._mv_hawkes[keyword].get_leader()

            if alert_level in ("elevated", "critical", "supercritical"):
                self._alerts.append({
                    "keyword": keyword,
                    "n_star": float(n_star),
                    "n_star_cheap": float(cheap_n_star),
                    "n_star_trend": n_star_trend,
                    "alert_level": alert_level,
                    "fitted_params": {
                        "mu": float(hawkes.mu),
                        "alpha": float(hawkes.alpha),
                        "beta": float(hawkes.beta),
                    },
                    "cross_platform_leader": leader,
                    "timestamp": timestamp.isoformat(),
                    "cascade_prediction": hawkes.predict_cascade_size(len(self._event_times[keyword])),
                })

    def _get_alert_level(self, n_star: float) -> str:
        if n_star >= self.threshold_critical:
            return "supercritical"
        if n_star >= self.threshold_elevated:
            return "critical"
        if n_star >= self.threshold_normal:
            return "elevated"
        return "normal"

    def _get_trend(self, keyword: str) -> str:
        history = self._n_star_history.get(keyword, [])
        if len(history) < 2:
            return "stable"
        recent = [h[1] for h in history[-5:]]
        if len(recent) < 2:
            return "stable"
        diff = recent[-1] - recent[0]
        if diff > 0.05:
            return "rising"
        if diff < -0.05:
            return "falling"
        return "stable"

    def get_active_alerts(self) -> list[dict]:
        """Return alerts sorted by n_star descending."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        self._alerts = [
            a for a in self._alerts
            if a.get("timestamp", "") >= cutoff.isoformat()
        ]
        return sorted(self._alerts, key=lambda a: a.get("n_star", 0), reverse=True)

    def get_status(self, keyword: str) -> dict | None:
        """Get current status for a keyword."""
        if keyword not in self._hawkes:
            return None
        hawkes = self._hawkes[keyword]
        return {
            "keyword": keyword,
            "n_star": float(hawkes.branching_ratio),
            "alert_level": self._get_alert_level(hawkes.branching_ratio),
            "n_star_trend": self._get_trend(keyword),
            "fitted_params": {"mu": hawkes.mu, "alpha": hawkes.alpha, "beta": hawkes.beta},
            "event_count": len(self._event_times.get(keyword, [])),
        }

    def get_state(self) -> dict:
        """Serialize state for persistence."""
        return {
            "hawkes_params": {
                k: {"mu": h.mu, "alpha": h.alpha, "beta": h.beta}
                for k, h in self._hawkes.items()
            },
            "n_star_history": {
                k: [(t.isoformat(), v) for t, v in hist]
                for k, hist in self._n_star_history.items()
            },
        }
