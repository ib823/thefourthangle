"""Tests for Bayesian Fusion Layer."""

from datetime import datetime, timezone, timedelta

import pytest

from radar.fusion.bayesian_fusion import BayesianFusion, TopicState


class TestTopicState:
    def test_prior_score(self):
        """Prior (no evidence) should give score ≈ 0.1."""
        ts = TopicState("test", prior_alpha=1, prior_beta=9)
        assert ts.controversy_score == pytest.approx(0.1)

    def test_update_increases_score(self):
        ts = TopicState("test", prior_alpha=1, prior_beta=9)
        ts.update(5.0, 0.0)  # Strong positive evidence
        assert ts.controversy_score > 0.1

    def test_decay_toward_prior(self):
        ts = TopicState("test", prior_alpha=1, prior_beta=9)
        ts.update(10.0, 0.0)  # Push score high
        score_before = ts.controversy_score
        ts.decay(48.0, 0.95)  # 48 hours of decay
        assert ts.controversy_score < score_before
        # Should decay toward prior (0.1)
        assert ts.controversy_score < 0.5

    def test_serialization(self):
        ts = TopicState("test", prior_alpha=3, prior_beta=7)
        ts.stream_signals = {"volume_monitor": {"severity": 0.8}}
        data = ts.to_dict()
        ts2 = TopicState.from_dict("test", data)
        assert ts2.alpha == 3
        assert ts2.beta == 7


class TestBayesianFusion:
    def _make_config(self):
        return {
            "prior_alpha": 1,
            "prior_beta": 9,
            "decay_rate_per_hour": 0.95,
            "archive_threshold": 0.05,
            "stream_weights": {
                "volume_monitor": 0.20,
                "cascade_tracker": 0.25,
                "polarization": 0.25,
                "narrative_fragmentation": 0.15,
                "network_bridge": 0.15,
            },
            "evidence_thresholds": {
                "volume_severity": 0.5,
                "cascade_n_star_strong": 0.8,
                "cascade_n_star_weak": 0.5,
                "polarization_er": 0.6,
                "narrative_jsd": 0.3,
                "bridge_score": 0.5,
            },
        }

    def test_prior_no_evidence(self):
        """With no evidence, controversy score should be ≈ 0.1."""
        fusion = BayesianFusion(self._make_config())
        fusion._get_or_create_topic("test")
        issues = fusion.get_ranked_issues()
        assert len(issues) == 1
        assert issues[0]["controversy_score"] == pytest.approx(0.1)

    def test_all_streams_positive_high_score(self):
        """All 5 streams positive should give score > 0.8."""
        fusion = BayesianFusion(self._make_config())
        topic = "crisis_topic"

        # Feed strong positive evidence from all 5 streams, multiple rounds
        for _ in range(25):
            fusion.update(topic, "volume_monitor", {"severity": 0.9, "z_score": 5.0})
            fusion.update(topic, "cascade_tracker", {"n_star": 0.95, "alert_level": "critical"})
            fusion.update(topic, "polarization", {"er_index": 0.8, "divergence_trend": "widening"})
            fusion.update(topic, "narrative_fragmentation", {"jsd_overall": 0.5, "fragmentation_trend": "rising"})
            fusion.update(topic, "network_bridge", {"bridge_score": 0.7, "bridge_velocity": 0.05})

        issues = fusion.get_ranked_issues()
        assert issues[0]["controversy_score"] > 0.8, \
            f"All streams positive should give >0.8, got {issues[0]['controversy_score']}"

    def test_single_stream_moderate_score(self):
        """Single stream alert should give moderate score."""
        fusion = BayesianFusion(self._make_config())
        topic = "single_stream"

        # Only volume alert
        for _ in range(3):
            fusion.update(topic, "volume_monitor", {"severity": 0.8, "z_score": 4.0})

        issues = fusion.get_ranked_issues()
        score = issues[0]["controversy_score"]
        assert 0.1 < score < 0.8, f"Single stream should give moderate score, got {score}"

    def test_decay_reduces_score(self):
        """Score should decrease after decay with no new evidence."""
        fusion = BayesianFusion(self._make_config())
        topic = "decaying_topic"

        for _ in range(5):
            fusion.update(topic, "volume_monitor", {"severity": 0.9})
            fusion.update(topic, "cascade_tracker", {"n_star": 0.9})

        score_before = fusion._topics[topic].controversy_score

        # Simulate 24 hours of decay
        future = datetime.now(timezone.utc) + timedelta(hours=24)
        fusion._topics[topic].decay(24.0, 0.95)

        score_after = fusion._topics[topic].controversy_score
        assert score_after < score_before, "Score should decrease after decay"

    def test_ranking_correct(self):
        """Highest score should be rank 1."""
        fusion = BayesianFusion(self._make_config())

        # Create 3 topics with different scores
        for _ in range(5):
            fusion.update("low_topic", "volume_monitor", {"severity": 0.3})
        for _ in range(5):
            fusion.update("high_topic", "volume_monitor", {"severity": 0.9})
            fusion.update("high_topic", "cascade_tracker", {"n_star": 0.95})
            fusion.update("high_topic", "polarization", {"er_index": 0.8, "divergence_trend": "widening"})
        for _ in range(5):
            fusion.update("mid_topic", "volume_monitor", {"severity": 0.7})

        issues = fusion.get_ranked_issues()
        assert issues[0]["title"] == "high_topic"
        assert issues[0]["priority_rank"] == 1
        assert issues[-1]["priority_rank"] == 3

    def test_bias_dimensions_political(self):
        """Political keyword should flag political dimension."""
        fusion = BayesianFusion(self._make_config())
        fusion.update("parliament_debate", "volume_monitor", {"severity": 0.8})
        issues = fusion.get_ranked_issues()
        assert "political" in issues[0]["bias_dimensions_at_risk"]

    def test_bias_dimensions_ethnic_from_polarization(self):
        """High polarization should flag ethnic dimension."""
        fusion = BayesianFusion(self._make_config())
        fusion.update("some_issue", "polarization", {"er_index": 0.7, "divergence_trend": "widening"})
        detail = fusion.get_issue_detail("some_issue")
        assert "ethnic" in detail["bias_dimensions_at_risk"]

    def test_state_persistence(self):
        """State save/load should preserve posteriors."""
        fusion1 = BayesianFusion(self._make_config())
        for _ in range(5):
            fusion1.update("persist_topic", "volume_monitor", {"severity": 0.9})

        state = fusion1.get_state()
        score1 = fusion1._topics["persist_topic"].controversy_score

        fusion2 = BayesianFusion(self._make_config())
        fusion2.load_state(state)
        score2 = fusion2._topics["persist_topic"].controversy_score

        assert score1 == pytest.approx(score2)

    def test_evidence_conversion_cascade_strong(self):
        """Cascade n* > 0.8 should give 2x positive evidence."""
        fusion = BayesianFusion(self._make_config())
        pos, neg = fusion._convert_evidence("cascade_tracker", {"n_star": 0.9})
        assert pos == 2.0
        assert neg == 0.0

    def test_evidence_conversion_negative(self):
        """Low signals should give negative evidence."""
        fusion = BayesianFusion(self._make_config())
        pos, neg = fusion._convert_evidence("volume_monitor", {"severity": 0.2})
        assert pos == 0.0
        assert neg == 1.0
