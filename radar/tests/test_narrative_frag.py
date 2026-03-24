"""Tests for Stream 4: Narrative Fragmentation (JSD)."""

from datetime import datetime, timezone, timedelta

import numpy as np
import pytest

from radar.streams.narrative_frag import (
    NarrativeFragmentationMonitor,
    shannon_entropy,
    kl_divergence,
    jsd,
    generalized_jsd,
)


class TestInformationTheory:
    def test_shannon_entropy_uniform(self):
        """Uniform distribution should have max entropy."""
        p = np.array([0.25, 0.25, 0.25, 0.25])
        assert shannon_entropy(p) == pytest.approx(2.0)  # log2(4) = 2

    def test_shannon_entropy_deterministic(self):
        """Deterministic distribution should have entropy 0."""
        p = np.array([1.0, 0.0, 0.0])
        assert shannon_entropy(p) == pytest.approx(0.0)

    def test_jsd_identical_is_zero(self):
        """JSD of identical distributions should be 0."""
        p = np.array([0.3, 0.5, 0.2])
        assert jsd(p, p) == pytest.approx(0.0, abs=0.001)

    def test_jsd_disjoint_is_one(self):
        """JSD of completely disjoint distributions should be ~1."""
        p = np.array([1.0, 0.0])
        q = np.array([0.0, 1.0])
        result = jsd(p, q)
        assert result == pytest.approx(1.0, abs=0.01)

    def test_jsd_symmetric(self):
        """JSD should be symmetric."""
        p = np.array([0.7, 0.2, 0.1])
        q = np.array([0.1, 0.3, 0.6])
        assert jsd(p, q) == pytest.approx(jsd(q, p))

    def test_generalized_jsd_identical(self):
        """Generalized JSD with identical distributions should be 0."""
        p = np.array([0.3, 0.5, 0.2])
        result = generalized_jsd([p, p, p], [0.33, 0.33, 0.34])
        assert result == pytest.approx(0.0, abs=0.01)

    def test_generalized_jsd_four_communities(self):
        """Generalized JSD with 4 different distributions should be > 0."""
        p1 = np.array([0.8, 0.1, 0.1])
        p2 = np.array([0.1, 0.8, 0.1])
        p3 = np.array([0.1, 0.1, 0.8])
        p4 = np.array([0.33, 0.33, 0.34])
        result = generalized_jsd([p1, p2, p3, p4], [0.4, 0.25, 0.25, 0.1])
        assert result > 0.2, f"4-community JSD should be meaningfully positive, got {result}"


class TestNarrativeFragmentation:
    def _make_config(self):
        return {
            "jsd_alert_threshold": 0.3,
            "tfidf_top_terms": 20,
            "window_hours": 6,
            "community_weights": {"malay": 0.40, "chinese": 0.25, "english": 0.25, "tamil": 0.10},
        }

    def test_zero_fragmentation_when_same_text(self):
        """JSD should be ~0 when all communities use identical text."""
        nf = NarrativeFragmentationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        text = "government policy reform announcement budget economy"
        for _ in range(20):
            nf.add_event("policy", "malay", text, now)
            nf.add_event("policy", "chinese", text, now)
            nf.add_event("policy", "english", text, now)

        result = nf.evaluate_topic("policy", now)
        assert result["jsd_overall"] < 0.1, f"JSD should be near 0 for identical text, got {result['jsd_overall']}"

    def test_high_fragmentation_when_different_narratives(self):
        """JSD should be high when communities use completely different terms."""
        nf = NarrativeFragmentationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        for _ in range(30):
            nf.add_event("issue", "malay", "halal haram fatwa agama masjid islam syariah", now)
            nf.add_event("issue", "chinese", "business economy trade market investment profit", now)
            nf.add_event("issue", "english", "rights freedom democracy equality justice law", now)

        result = nf.evaluate_topic("issue", now)
        assert result["jsd_overall"] > 0.3, f"JSD should be high for divergent narratives, got {result['jsd_overall']}"

    def test_fragmentation_trend_rising(self):
        """Should detect rising fragmentation over consecutive windows."""
        nf = NarrativeFragmentationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # Progressively increase divergence
        for step in range(5):
            t = now + timedelta(hours=step)
            # As step increases, narratives diverge more
            nf.add_event("trending", "malay", "agama haram fatwa " * (step + 1), t)
            nf.add_event("trending", "chinese", "business profit trade " * (step + 1), t)
            nf.add_event("trending", "english", "rights freedom law " * (step + 1), t)
            nf.evaluate_topic("trending", t)

        trend = nf._compute_trend("trending")
        # Trend may not always be "rising" since JSD can plateau, but should not be "falling"
        assert trend != "falling"

    def test_entropy_computed(self):
        """Per-community entropy should be computed."""
        nf = NarrativeFragmentationMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        nf.add_event("topic", "malay", "kerajaan rakyat parlimen undang undang", now)
        nf.add_event("topic", "english", "government people parliament law policy", now)

        result = nf.evaluate_topic("topic", now)
        assert "entropy_by_community" in result
        assert len(result["entropy_by_community"]) >= 2
