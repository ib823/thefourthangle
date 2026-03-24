"""Tests for Stream 3: Polarization Measurement."""

from datetime import datetime, timezone, timedelta

import numpy as np
import pytest

from radar.streams.polarization import (
    PolarizationMonitor,
    simple_sentiment,
    bimodality_coefficient,
)


class TestSentiment:
    def test_positive_english(self):
        assert simple_sentiment("this is great and good progress", "english") > 0

    def test_negative_english(self):
        assert simple_sentiment("terrible corrupt scandal abuse", "english") < 0

    def test_neutral(self):
        assert simple_sentiment("the cat sat on the mat", "english") == 0.0

    def test_malay_negative(self):
        assert simple_sentiment("rasuah salah gagal buruk", "malay") < 0


class TestBimodalityCoefficient:
    def test_unimodal(self):
        rng = np.random.default_rng(42)
        data = rng.normal(0, 1, 200)
        bc = bimodality_coefficient(data)
        assert bc < 0.555, f"Unimodal data should have BC < 0.555, got {bc}"

    def test_bimodal(self):
        rng = np.random.default_rng(42)
        data = np.concatenate([rng.normal(-3, 0.5, 100), rng.normal(3, 0.5, 100)])
        bc = bimodality_coefficient(data)
        assert bc > 0.555, f"Bimodal data should have BC > 0.555, got {bc}"

    def test_too_few_samples(self):
        assert bimodality_coefficient(np.array([1, 2, 3])) == 0.0


class TestPolarizationMonitor:
    def _make_config(self):
        return {
            "ethnic_weights": {"malay": 0.69, "chinese": 0.23, "indian": 0.07, "other": 0.01},
            "er_alpha": 1.0,
            "alert_threshold": 0.6,
            "bimodality_threshold": 0.555,
            "window_hours": 24,
        }

    def test_er_zero_when_same_sentiment(self):
        """ER index should be 0 when all communities have the same sentiment."""
        pm = PolarizationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # All communities positive
        for community in ["malay", "chinese", "english", "tamil"]:
            for _ in range(20):
                pm.add_event("test_topic", community, 0.5, now)

        sentiment = pm.compute_sentiment_by_community("test_topic")
        er = pm.compute_esteban_ray(sentiment)
        assert er == pytest.approx(0.0, abs=0.01), f"ER should be ~0 when sentiments identical, got {er}"

    def test_er_high_when_polarized(self):
        """ER index should be high when Malay sentiment = -0.8 and Chinese = +0.8."""
        pm = PolarizationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        for _ in range(50):
            pm.add_event("polarized_topic", "malay", -0.8, now)
            pm.add_event("polarized_topic", "chinese", 0.8, now)
            pm.add_event("polarized_topic", "tamil", -0.3, now)

        sentiment = pm.compute_sentiment_by_community("polarized_topic")
        er = pm.compute_esteban_ray(sentiment)
        assert er > 0.5, f"ER should be high for polarized sentiments, got {er}"

    def test_bimodality_on_polarized_data(self):
        """Bimodality should be detected when two groups have opposing sentiments."""
        pm = PolarizationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        rng = np.random.default_rng(42)
        # Strongly negative Malay sentiment
        for _ in range(100):
            pm.add_event("bimodal_topic", "malay", -0.8 + rng.normal(0, 0.1), now)
        # Strongly positive Chinese sentiment
        for _ in range(100):
            pm.add_event("bimodal_topic", "chinese", 0.8 + rng.normal(0, 0.1), now)

        bc, is_bimodal = pm.compute_bimodality("bimodal_topic")
        assert is_bimodal, f"Should detect bimodality, BC={bc}"

    def test_divergence_trend_widening(self):
        """Should detect widening divergence over time."""
        pm = PolarizationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # Simulate widening gap over 5 evaluation points
        for step in range(5):
            gap = 0.2 + step * 0.2  # 0.2 → 1.0
            t = now + timedelta(hours=step)

            # Clear and re-add with increasing divergence
            pm._sentiments["trend_topic"]["malay"] = [(t, -gap / 2)]
            pm._sentiments["trend_topic"]["chinese"] = [(t, gap / 2)]
            pm._sentiments["trend_topic"]["tamil"] = [(t, 0.0)]

            pm.evaluate_topic("trend_topic", t)

        trend = pm.compute_divergence_trend("trend_topic")
        assert trend == "widening", f"Should detect widening trend, got {trend}"

    def test_max_divergence(self):
        """Max pairwise divergence should be between most opposed communities."""
        pm = PolarizationMonitor(self._make_config())
        sentiment = {"malay": -0.8, "chinese": 0.7, "english": 0.0, "tamil": -0.2}
        max_div, c1, c2 = pm.compute_max_divergence(sentiment)
        assert max_div == pytest.approx(1.5)
        assert set([c1, c2]) == {"malay", "chinese"}

    def test_evaluate_topic_returns_complete_structure(self):
        """evaluate_topic should return all required fields."""
        pm = PolarizationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        pm.add_event("full_topic", "malay", -0.5, now)
        pm.add_event("full_topic", "chinese", 0.5, now)

        result = pm.evaluate_topic("full_topic", now)
        assert "er_index" in result
        assert "bimodality_coefficient" in result
        assert "sentiment_by_community" in result
        assert "divergence_trend" in result
        assert "alert_level" in result
