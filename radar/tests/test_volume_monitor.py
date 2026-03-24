"""Tests for Stream 1: Volume Monitor (CUSUM + STL + BOCPD)."""

from datetime import datetime, timezone, timedelta

import numpy as np
import pytest

from radar.streams.volume_monitor import (
    CUSUMDetector,
    BOCPDDetector,
    STLDeseasonalizer,
    VolumeMonitor,
)


class TestCUSUM:
    def test_detects_step_change(self):
        """CUSUM should detect an abrupt increase in mean."""
        cusum = CUSUMDetector(k=0.5, h=4.0, cooldown_steps=0)
        alerts = []

        # 50 observations at baseline (z=0)
        for _ in range(50):
            result = cusum.update(0.0)
            if result:
                alerts.append(result)

        # 20 observations with z=2.0 (clear shift)
        for _ in range(20):
            result = cusum.update(2.0)
            if result:
                alerts.append(result)

        assert len(alerts) >= 1, "CUSUM should detect the step change"
        assert alerts[0]["direction"] == "up"

    def test_no_alert_on_stationary(self):
        """CUSUM should NOT alert on zero-mean stationary data."""
        cusum = CUSUMDetector(k=0.5, h=4.0, cooldown_steps=0)
        rng = np.random.default_rng(42)
        alerts = []

        for _ in range(500):
            z = rng.normal(0, 1)
            result = cusum.update(z)
            if result:
                alerts.append(result)

        # Allow very low false positive rate (< 5%)
        assert len(alerts) < 25, f"Too many false positives: {len(alerts)}/500"

    def test_cooldown_prevents_rapid_alerts(self):
        """After an alert, CUSUM should not re-alert during cooldown."""
        cusum = CUSUMDetector(k=0.5, h=4.0, cooldown_steps=5)
        alerts = []

        # Strong signal for 20 steps
        for i in range(20):
            result = cusum.update(3.0)
            if result:
                alerts.append(i)

        # Cooldown of 5 steps means at most ~3-4 alerts in 20 steps
        assert len(alerts) <= 4

    def test_state_persistence(self):
        cusum = CUSUMDetector(k=0.5, h=4.0)
        cusum.update(1.0)
        cusum.update(1.0)
        state = cusum.get_state()

        cusum2 = CUSUMDetector(k=0.5, h=4.0)
        cusum2.load_state(state)
        assert cusum2.s_plus == cusum.s_plus
        assert cusum2.s_minus == cusum.s_minus


class TestSTLDeseasonalizer:
    def test_deseasonalizes_periodic_signal(self):
        """STL should remove a known daily pattern, leaving small residual variance."""
        stl = STLDeseasonalizer(daily_period=24)  # Use small period for testing

        # Generate 3 "days" of sinusoidal data
        residuals = []
        raw_values = []
        for i in range(24 * 3):
            # Seasonal pattern: sin wave with period 24
            value = 10.0 + 5.0 * np.sin(2 * np.pi * i / 24)
            r = stl.add_and_deseasonalize(value)
            if i >= 24 * 2:  # Only check after 2 full periods
                residuals.append(r)
                raw_values.append(value)

        # The variance of residuals should be much smaller than raw variance
        raw_std = np.std(raw_values)
        residual_std = np.std(residuals)
        assert residual_std < raw_std * 0.5, (
            f"Deseasonalization should reduce variance. Raw std={raw_std:.2f}, Residual std={residual_std:.2f}"
        )

    def test_baseline_stats(self):
        stl = STLDeseasonalizer(daily_period=24)
        for i in range(100):
            stl.add_and_deseasonalize(float(i % 10))
        mean, std = stl.get_baseline_stats(1)
        assert mean > 0
        assert std > 0


class TestBOCPD:
    def test_detects_changepoint(self):
        """BOCPD should detect a clear mean shift."""
        bocpd = BOCPDDetector(hazard_lambda=50, threshold=0.2, max_run_length=200)
        rng = np.random.default_rng(42)
        alerts = []

        # 100 observations from N(0, 0.5) — low noise
        for i in range(100):
            x = rng.normal(0, 0.5)
            result = bocpd.update(x)
            if result:
                alerts.append(("phase1", i, result))

        # Clear shift to N(8, 0.5) — large jump
        for i in range(50):
            x = rng.normal(8, 0.5)
            result = bocpd.update(x)
            if result:
                alerts.append(("phase2", 100 + i, result))

        # Should detect changepoint near observation 100
        phase2_alerts = [a for a in alerts if a[0] == "phase2"]
        assert len(phase2_alerts) >= 1, "BOCPD should detect the mean shift"

    def test_no_alert_on_stationary(self):
        """BOCPD should have low false positive rate on stationary data."""
        bocpd = BOCPDDetector(hazard_lambda=200, threshold=0.5, max_run_length=200)
        rng = np.random.default_rng(123)
        alerts = []

        for _ in range(300):
            x = rng.normal(0, 1)
            result = bocpd.update(x)
            if result:
                alerts.append(result)

        # Very few false alarms expected
        assert len(alerts) < 15, f"Too many false positives: {len(alerts)}/300"

    def test_state_persistence(self):
        bocpd = BOCPDDetector(hazard_lambda=100, max_run_length=50)
        for _ in range(10):
            bocpd.update(1.0)
        state = bocpd.get_state()
        assert "log_R" in state
        assert len(state["log_R"]) > 1


class TestVolumeMonitor:
    def _make_config(self):
        return {
            "cusum": {"k": 0.5, "h": 4.0, "cooldown_hours": 0},
            "bocpd": {"hazard_lambda": 50, "changepoint_threshold": 0.3, "max_run_length": 200},
            "stl": {"daily_period": 96, "weekly_period": 672},
            "baseline_window_days": 7,
            "bucket_minutes": 15,
        }

    def test_detects_spike_in_counts(self):
        """VolumeMonitor should detect a clear spike in mention counts."""
        vm = VolumeMonitor(self._make_config())
        key = ("corruption", "twitter", "english")
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # Baseline: 100 observations at count=10
        for i in range(100):
            t = now + timedelta(minutes=15 * i)
            vm.process_count(key, 10.0, t)

        # Spike: 20 observations at count=50
        for i in range(20):
            t = now + timedelta(minutes=15 * (100 + i))
            vm.process_count(key, 50.0, t)

        alerts = vm.get_active_alerts()
        assert len(alerts) >= 1, "Should detect the volume spike"
        assert alerts[0]["keyword"] == "corruption"

    def test_no_false_positives_on_flat_data(self):
        """VolumeMonitor should have very few alerts on constant data after warmup."""
        vm = VolumeMonitor(self._make_config())
        key = ("test", "twitter", "english")
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # Warmup phase (first 50 observations)
        for i in range(50):
            t = now + timedelta(minutes=15 * i)
            vm.process_count(key, 10.0, t)

        # Clear alerts from warmup
        vm._active_alerts.clear()

        # Steady state — should have no alerts
        for i in range(200):
            t = now + timedelta(minutes=15 * (50 + i))
            vm.process_count(key, 10.0, t)

        alerts = [a for a in vm.get_active_alerts() if a["alert_type"] == "cusum"]
        assert len(alerts) == 0, f"Should not alert on flat data after warmup, got {len(alerts)}"

    def test_cusum_no_alert_after_stl_on_seasonal(self):
        """After STL learns the pattern, CUSUM should not fire on purely seasonal data."""
        vm = VolumeMonitor(self._make_config())
        key = ("test_seasonal", "twitter", "english")
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # Warmup: 3 days of seasonal pattern for STL to learn
        for i in range(96 * 3):
            hour_of_day = (i % 96) / 4
            count = 50.0 if 8 <= hour_of_day <= 20 else 10.0
            t = now + timedelta(minutes=15 * i)
            vm.process_count(key, count, t)

        # Clear alerts from learning phase
        vm._active_alerts.clear()

        # Test: 4 more days of the SAME pattern — should trigger very few CUSUM alerts
        for i in range(96 * 4):
            hour_of_day = (i % 96) / 4
            count = 50.0 if 8 <= hour_of_day <= 20 else 10.0
            t = now + timedelta(minutes=15 * (96 * 3 + i))
            vm.process_count(key, count, t)

        cusum_alerts = [a for a in vm.get_active_alerts() if a["alert_type"] == "cusum"]
        assert len(cusum_alerts) < 30, f"Too many CUSUM alerts on learned seasonal data: {len(cusum_alerts)}"
