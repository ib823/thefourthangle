"""Tests for Stream 6: Silence Detector."""

from datetime import datetime, timezone, timedelta

import pytest

from radar.streams.silence_detector import (
    SilenceDetector,
    InstitutionalEvent,
    _extract_fiscal_magnitude,
    _detect_dimensions,
)
from radar.fusion.bayesian_fusion import BayesianFusion


class TestFiscalMagnitude:
    def test_billion(self):
        assert _extract_fiscal_magnitude("RM2.5 billion allocation") == pytest.approx(1.0)

    def test_hundred_million(self):
        score = _extract_fiscal_magnitude("RM500 million budget")
        assert 0.7 <= score <= 1.0

    def test_ten_million(self):
        score = _extract_fiscal_magnitude("RM50 million project")
        assert 0.4 <= score <= 0.7

    def test_no_amount(self):
        assert _extract_fiscal_magnitude("general policy statement") == 0.0


class TestDimensionDetection:
    def test_ethnic_keywords(self):
        dims = _detect_dimensions("bumiputera special rights policy amendment")
        assert "ethnic" in dims

    def test_religious_keywords(self):
        dims = _detect_dimensions("fatwa on halal certification by JAKIM")
        assert "religious" in dims

    def test_multiple_dimensions(self):
        dims = _detect_dimensions("parliament bill on Islamic economy subsidy for bumiputera")
        assert "political" in dims
        assert "religious" in dims
        assert "economic" in dims
        assert "ethnic" in dims


class TestInstitutionalEvent:
    def test_constitutional_amendment_high_importance(self):
        """Constitutional amendment should score importance > 0.8."""
        event = InstitutionalEvent(
            event_id="TEST-001",
            event_type="constitutional_amendment",
            title="Constitutional amendment on bumiputera rights and Islamic law",
            description="Amendment to Article 153 affecting special position of Malays",
            source_institution="Parliament",
            date=datetime.now(timezone.utc),
        )
        importance = event.compute_structural_importance()
        assert importance > 0.8, f"Constitutional amendment importance={importance}, expected >0.8"

    def test_routine_gazette_low_importance(self):
        """Routine gazette should score importance < 0.3."""
        event = InstitutionalEvent(
            event_id="TEST-002",
            event_type="gazette_routine",
            title="Appointment of assistant registrar",
            description="Administrative appointment in Sarawak district court",
            source_institution="Gazette",
            date=datetime.now(timezone.utc),
        )
        importance = event.compute_structural_importance()
        assert importance < 0.3, f"Routine gazette importance={importance}, expected <0.3"

    def test_silence_score_one_when_zero_coverage(self):
        """silence_score should be 1.0 when high-importance event has zero mentions."""
        event = InstitutionalEvent(
            event_id="TEST-003",
            event_type="constitutional_amendment",
            title="Constitutional amendment on parliament dissolution power",
            description="Major constitutional change affecting democratic process",
            source_institution="Parliament",
            date=datetime.now(timezone.utc),
        )
        # No mentions recorded
        assert event.actual_mentions == 0
        assert event.silence_score == 1.0

    def test_silence_score_decreases_with_coverage(self):
        """silence_score should decrease as coverage increases."""
        event = InstitutionalEvent(
            event_id="TEST-004",
            event_type="national_policy",
            title="New education policy reform",
            description="Major reform affecting all schools",
            source_institution="MOE",
            date=datetime.now(timezone.utc),
        )
        score_before = event.silence_score
        # Add some mentions
        for _ in range(500):
            event.record_mention("news", datetime.now(timezone.utc))
        for _ in range(500):
            event.record_mention("twitter", datetime.now(timezone.utc))
        score_after = event.silence_score
        assert score_after < score_before

    def test_pattern_hidden_story(self):
        """Zero news AND zero social = HIDDEN_STORY."""
        event = InstitutionalEvent(
            event_id="TEST-005",
            event_type="federal_court_ruling",
            title="Federal Court ruling on constitutional interpretation",
            description="Landmark ruling",
            source_institution="Federal Court",
            date=datetime.now(timezone.utc),
        )
        assert event.suppression_pattern == "HIDDEN_STORY"

    def test_pattern_media_blackout(self):
        """Zero news BUT social exists = MEDIA_BLACKOUT."""
        event = InstitutionalEvent(
            event_id="TEST-006",
            event_type="national_policy",
            title="Policy announcement",
            description="New policy",
            source_institution="Government",
            date=datetime.now(timezone.utc),
        )
        event.record_mention("twitter", datetime.now(timezone.utc))
        assert event.suppression_pattern == "MEDIA_BLACKOUT"

    def test_pattern_public_blind_spot(self):
        """News exists BUT zero social = PUBLIC_BLIND_SPOT."""
        event = InstitutionalEvent(
            event_id="TEST-007",
            event_type="national_policy",
            title="Policy announcement",
            description="New policy",
            source_institution="Government",
            date=datetime.now(timezone.utc),
        )
        event.record_mention("news", datetime.now(timezone.utc))
        assert event.suppression_pattern == "PUBLIC_BLIND_SPOT"

    def test_dimension_sensitivity_multi(self):
        """Event touching 4+ dimensions should have sensitivity = 1.0."""
        event = InstitutionalEvent(
            event_id="TEST-008",
            event_type="constitutional_amendment",
            title="Parliament bill on Islamic economy subsidy for bumiputera court ruling",
            description="Affects ethnic rights, religious law, economic policy, and legal system",
            source_institution="Parliament",
            date=datetime.now(timezone.utc),
        )
        assert event.dimension_sensitivity == 1.0


class TestSilenceDetector:
    def _make_config(self):
        return {"importance_threshold": 0.4, "silence_threshold": 0.6}

    def test_add_and_evaluate(self):
        sd = SilenceDetector(self._make_config())
        now = datetime.now(timezone.utc)

        event_id = sd.add_institutional_event(
            event_type="constitutional_amendment",
            title="Constitutional amendment on bumiputera Islamic economy court jurisdiction",
            description="Major amendment affecting ethnic rights, religious law, economic policy, legal system",
            source_institution="Parliament",
            date=now,
        )

        results = sd.evaluate_all(now)
        assert len(results) >= 1
        result = results[0]
        assert result["structural_importance"] > 0.8
        assert result["silence_score"] == 1.0
        assert result["suppression_pattern"] == "HIDDEN_STORY"
        assert result["alert_level"] == "critical"

    def test_watchlist_from_calendar(self):
        sd = SilenceDetector(self._make_config())
        calendar = {
            "parliamentary_sessions_2026": {
                "first_session": {"start": "2026-03-09", "end": "2026-04-16"},
            },
            "budget_presentation": "2026-10-23",
            "historical_sensitivity_dates": {},
            "court_sessions_2026": {"federal_court_terms": []},
        }
        sd.load_watchlist_from_calendar(calendar)
        # Should have at least the parliament session
        assert len(sd._events) >= 1

    def test_coverage_reduces_alerts(self):
        sd = SilenceDetector(self._make_config())
        now = datetime.now(timezone.utc)

        event_id = sd.add_institutional_event(
            event_type="national_policy",
            title="National education reform policy",
            description="Major reform",
            source_institution="MOE",
            date=now,
        )

        # Add heavy coverage
        event = sd.get_event(event_id)
        for _ in range(5000):
            event.record_mention("news", now)
            event.record_mention("twitter", now)

        results = sd.evaluate_all(now)
        if results:
            assert results[0]["silence_score"] < 0.3


class TestFusionWith6Streams:
    def test_fusion_has_6_stream_weights(self):
        """Fusion should have weights for all 6 streams."""
        config = {
            "stream_weights": {
                "volume_monitor": 0.15,
                "cascade_tracker": 0.20,
                "polarization": 0.20,
                "narrative_fragmentation": 0.15,
                "network_bridge": 0.10,
                "silence_detector": 0.20,
            }
        }
        fusion = BayesianFusion(config)
        assert len(fusion.stream_weights) == 6
        assert "silence_detector" in fusion.stream_weights
        assert abs(sum(fusion.stream_weights.values()) - 1.0) < 0.01

    def test_silence_evidence_conversion(self):
        """High silence + high importance should give strong positive evidence."""
        fusion = BayesianFusion({})
        pos, neg = fusion._convert_evidence("silence_detector", {
            "silence_score": 0.9,
            "structural_importance": 0.8,
        })
        assert pos == 2.0
        assert neg == 0.0

    def test_silence_low_gives_weak_negative(self):
        """Low silence should give weak negative evidence."""
        fusion = BayesianFusion({})
        pos, neg = fusion._convert_evidence("silence_detector", {
            "silence_score": 0.2,
            "structural_importance": 0.3,
        })
        assert pos == 0.0
        assert neg == 0.5

    def test_detection_type_silence_anomaly(self):
        """Topic with only silence evidence should have detection_type=silence_anomaly."""
        fusion = BayesianFusion({})
        fusion.update("silent_topic", "silence_detector", {
            "silence_score": 0.9,
            "structural_importance": 0.8,
            "bias_dimensions_touched": ["political", "legal"],
        })
        issues = fusion.get_ranked_issues()
        assert len(issues) >= 1
        silent = [i for i in issues if i["title"] == "silent_topic"][0]
        assert silent["detection_type"] == "silence_anomaly"

    def test_detection_type_both(self):
        """Topic with both attention and silence should have detection_type=both."""
        fusion = BayesianFusion({})
        fusion.update("dual_topic", "volume_monitor", {"severity": 0.8})
        fusion.update("dual_topic", "silence_detector", {
            "silence_score": 0.7,
            "structural_importance": 0.6,
        })
        issues = fusion.get_ranked_issues()
        dual = [i for i in issues if i["title"] == "dual_topic"][0]
        assert dual["detection_type"] == "both"
