"""Tests for BriefGenerator — format, multi-source context, dimension mapping, quality gate."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from radar.brief_generator import (
    DEFAULT_ACTORS,
    DIMENSIONS,
    DIMENSION_TO_LENS,
    FLAG_THRESHOLDS,
    BriefGenerator,
    _issue_topic_keywords,
    generate_from_queue,
)


# ---- fixtures ------------------------------------------------------------


def _ev(platform, text, source, tone=None, **extra):
    md = {}
    if tone is not None:
        md["tone"] = tone
    md.update(extra)
    return {
        "platform": platform,
        "text": text,
        "source_name": source,
        "timestamp": "2026-04-15T10:00:00+00:00",
        "lang": "english",
        "metadata": md,
    }


def _issue(
    issue_id="T4A-TEST-001",
    title="parliament budget extension",
    score=0.85,
    priority="critical",
    stream_signals=None,
    prediction=None,
    timestamp="2026-04-15T10:00:00+00:00",
):
    return {
        "issue_id": issue_id,
        "title": title,
        "controversy_score": score,
        "priority": priority,
        "confidence": 0.7,
        "timestamp": timestamp,
        "stream_signals": stream_signals or {},
        "prediction": prediction or {},
    }


@pytest.fixture
def tmp_output(tmp_path: Path) -> Path:
    return tmp_path / "briefs"


# ---- score filtering -----------------------------------------------------


class TestScoreFiltering:
    def test_below_threshold_skipped(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        results = gen.generate([_issue(score=0.4)], events=[])
        assert results == []
        assert not tmp_output.exists() or not list(tmp_output.iterdir())

    def test_above_threshold_generated(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        results = gen.generate([_issue(score=0.65)], events=[])
        assert len(results) == 1
        assert Path(results[0]["path"]).exists()

    def test_custom_threshold_from_config(self, tmp_output):
        gen = BriefGenerator(
            config={"brief_generator": {"score_threshold": 0.9}},
            output_dir=tmp_output,
        )
        results = gen.generate([_issue(score=0.85)], events=[])
        assert results == []


# ---- brief format --------------------------------------------------------


class TestBriefFormat:
    def test_required_sections_present(self, tmp_output):
        issue = _issue(stream_signals={
            "polarization": {"er_index": 0.7, "divergence_trend": "widening"},
        })
        gen = BriefGenerator(output_dir=tmp_output)
        results = gen.generate([issue], events=[_ev("news", "MP questions budget extension", "FMT")])
        text = Path(results[0]["path"]).read_text()

        for section in (
            "## PERIOD",
            "## CONTEXT",
            "## ACTORS",
            "## RELEVANT LAW",
            "## 12-DIMENSION AUDIT NOTES",
            "## RECOMMENDED LENSES",
            "## QUALITY GATE",
        ):
            assert section in text, f"missing {section}"

        # Title line begins with ISSUE marker.
        assert text.splitlines()[0].startswith(f"# ISSUE {issue['issue_id']}")

    def test_all_12_dimensions_listed(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        results = gen.generate([_issue()], events=[])
        text = Path(results[0]["path"]).read_text()
        for i, name in enumerate(DIMENSIONS, 1):
            assert f"{i:>2}. {name}" in text

    def test_filename_uses_auto_prefix(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        results = gen.generate([_issue(issue_id="T4A-TEST-042")], events=[])
        assert Path(results[0]["path"]).name == "auto-T4A-TEST-042.txt"


# ---- multi-source context ------------------------------------------------


class TestMultiSourceContext:
    def test_rss_gdelt_reddit_all_captured(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(title="parliament budget")
        events = [
            _ev("news", "Parliament passes budget amendment on Wednesday", "FMT"),
            _ev("news", "Budget extension raises concerns among opposition MPs", "Malay Mail"),
            _ev("news", "Rafizi questions budget vote timing and procedure", "Malaysiakini"),
            _ev("gdelt", "Parliament budget vote draws criticism", "thestar.com.my", tone=-3.2),
            _ev("gdelt", "Parliament considers budget", "bloomberg.com", tone=-2.5),
            _ev("reddit", "Why is parliament rushing the budget again?", "r/malaysia hot"),
        ]
        text, quality = gen.build_brief(issue, events)
        assert "[rss]" in text
        assert "[gdelt_tone]" in text
        assert "[reddit]" in text
        assert quality["context_points"] >= 3

    def test_gdelt_tone_averaged_and_labeled(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        events = [
            _ev("gdelt", "a", "d1", tone=-5.0),
            _ev("gdelt", "b", "d2", tone=-4.0),
        ]
        text, _ = gen.build_brief(_issue(), events)
        assert "negative" in text
        assert "-4.50" in text or "-4.5" in text

    def test_fallback_context_when_no_events(self, tmp_output):
        """Signal-derived context keeps the brief useful even without raw events."""
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(stream_signals={
            "volume": {"alert": True, "severity": 0.9, "z_score": 3.2},
            "polarization": {"er_index": 0.65, "divergence_trend": "widening"},
        }, prediction={"regime": "PRE_CONTROVERSY", "eruption_hours": 22.0})
        text, quality = gen.build_brief(issue, events=[])
        assert "radar.volume_monitor" in text
        assert "radar.polarization" in text
        assert quality["context_points"] >= 2


# ---- actor extraction ----------------------------------------------------


class TestActorExtraction:
    def test_politician_matched(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(title="Rafizi Ramli criticizes budget process")
        text, quality = gen.build_brief(issue, events=[])
        assert "Rafizi Ramli" in text
        assert quality["actors"] >= 1

    def test_party_word_boundary(self, tmp_output):
        """PAS must match the party, not 'passenger'."""
        gen = BriefGenerator(output_dir=tmp_output)
        text1, q1 = gen.build_brief(
            _issue(title="Passenger rail policy expands"), events=[])
        text2, q2 = gen.build_brief(
            _issue(title="PAS challenges new policy"), events=[])
        assert "PAS" not in text1.split("## ACTORS", 1)[1].split("## ", 1)[0]
        # PAS should appear under ACTORS in text2.
        actors_section_2 = text2.split("## ACTORS", 1)[1].split("## ", 1)[0]
        assert "PAS" in actors_section_2

    def test_institution_matched(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        text, q = gen.build_brief(_issue(title="MACC opens probe into procurement"),
                                  events=[])
        assert "MACC" in text
        assert q["actors"] >= 1

    def test_operator_can_add_actors_via_config(self, tmp_output):
        gen = BriefGenerator(
            config={"brief_generator": {"actors": {
                "politicians": ["Datuk Newcomer"],
            }}},
            output_dir=tmp_output,
        )
        text, _ = gen.build_brief(_issue(title="Datuk Newcomer speaks at rally"),
                                  events=[])
        assert "Datuk Newcomer" in text
        # Defaults are preserved too.
        assert "Anwar Ibrahim" in DEFAULT_ACTORS["politicians"]


# ---- dimension mapping ---------------------------------------------------


class TestDimensionMapping:
    def test_polarization_flags_dims_2_3_4(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(stream_signals={
            "polarization": {"er_index": 0.7, "divergence_trend": "widening"},
        })
        _, q = gen.build_brief(issue, events=[])
        # The quality dict exposes count, but we re-run to inspect flags.
        dims = gen._map_dimensions(issue)
        assert set(dims["flagged"]) >= {2, 3, 4}

    def test_narrative_flags_dim_5(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(stream_signals={
            "narrative": {"jsd_overall": 0.5, "fragmentation_trend": "rising"},
        })
        dims = gen._map_dimensions(issue)
        assert 5 in dims["flagged"]

    def test_silence_flags_dim_6(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(stream_signals={
            "silence": {"silence_score": 0.7, "suppression_pattern": "SUPPRESSION"},
        })
        dims = gen._map_dimensions(issue)
        assert 6 in dims["flagged"]

    def test_bridge_flags_dims_3_and_11(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(stream_signals={
            "bridge": {"bridge_score": 0.8, "bridge_velocity": 0.05},
        })
        dims = gen._map_dimensions(issue)
        assert {3, 11}.issubset(dims["flagged"])

    def test_cox_ramadan_flags_dim_4(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(prediction={
            "risk_factors": [
                {"name": "ramadan", "contribution": 0.3, "hazard_ratio": 1.4},
            ],
        })
        dims = gen._map_dimensions(issue)
        assert 4 in dims["flagged"]

    def test_cox_days_to_budget_flags_dim_11(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(prediction={
            "risk_factors": [
                {"name": "days_to_budget", "contribution": -0.2, "hazard_ratio": 0.9},
            ],
        })
        dims = gen._map_dimensions(issue)
        assert 11 in dims["flagged"]

    def test_weak_signal_does_not_flag(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(stream_signals={
            "polarization": {"er_index": 0.2, "divergence_trend": "stable"},
        })
        dims = gen._map_dimensions(issue)
        # ER below threshold and no widening trend → no flag.
        assert 2 not in dims["flagged"]

    def test_dimension_to_lens_mapping(self):
        # Ensures flagged dims translate to recommended lenses.
        gen = BriefGenerator()
        dims = {"flagged": [2, 4, 11], "notes": {}}
        lenses = gen._recommend_lenses(dims)
        assert set(lenses) == {DIMENSION_TO_LENS[2], DIMENSION_TO_LENS[4], DIMENSION_TO_LENS[11]}


# ---- quality gate --------------------------------------------------------


class TestQualityGate:
    def test_ready_requires_all_three(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(
            title="MACC probes Rafizi Ramli budget claim",
            stream_signals={
                "polarization": {"er_index": 0.7, "divergence_trend": "widening"},
                "narrative": {"jsd_overall": 0.5, "fragmentation_trend": "rising"},
            },
        )
        events = [
            _ev("news", "MACC investigates budget allegations", "FMT"),
            _ev("gdelt", "Rafizi budget claim", "x.com", tone=-3.0),
            _ev("reddit", "MACC confirms budget probe", "r/malaysia hot"),
        ]
        _, q = gen.build_brief(issue, events)
        assert q["status"] == "READY"
        assert q["pass_context"] and q["pass_actors"] and q["pass_dimensions"]

    def test_draft_when_actor_missing(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(
            title="water shortages continue",
            stream_signals={
                "polarization": {"er_index": 0.7, "divergence_trend": "widening"},
            },
        )
        events = [
            _ev("news", "Water shortages continue in rural areas", "FMT"),
            _ev("gdelt", "Water access worsens", "x.com", tone=-3.0),
            _ev("reddit", "My tap ran dry", "r/malaysia"),
        ]
        _, q = gen.build_brief(issue, events)
        assert q["status"] == "DRAFT"
        assert q["pass_actors"] is False

    def test_draft_when_dimensions_insufficient(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(title="Anwar Ibrahim speech", stream_signals={})
        events = [
            _ev("news", "Anwar Ibrahim speech draws crowd", "FMT"),
            _ev("news", "Anwar's speech highlights reform", "Malay Mail"),
            _ev("reddit", "Thoughts on Anwar's speech", "r/malaysia"),
        ]
        _, q = gen.build_brief(issue, events)
        assert q["status"] == "DRAFT"
        assert q["pass_dimensions"] is False

    def test_draft_when_context_insufficient(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue = _issue(
            title="Rafizi comment on MACC investigation",
            stream_signals={
                "polarization": {"er_index": 0.7, "divergence_trend": "widening"},
                "narrative": {"jsd_overall": 0.4, "fragmentation_trend": "rising"},
            },
        )
        events = [_ev("news", "Rafizi comments on MACC", "FMT")]  # only 1 point
        _, q = gen.build_brief(issue, events)
        assert q["pass_context"] is False
        assert q["status"] == "DRAFT"


# ---- auto-trigger --------------------------------------------------------


class TestAutoTrigger:
    def _full_ready_fixture(self):
        issue = _issue(
            score=0.9,
            title="MACC probes Rafizi Ramli budget claim",
            stream_signals={
                "polarization": {"er_index": 0.7, "divergence_trend": "widening"},
                "narrative": {"jsd_overall": 0.5, "fragmentation_trend": "rising"},
            },
        )
        events = [
            _ev("news", "MACC opens probe", "FMT"),
            _ev("gdelt", "MACC Rafizi budget", "x.com", tone=-3.0),
            _ev("reddit", "MACC probe details", "r/malaysia"),
        ]
        return issue, events

    def test_disabled_by_default(self, tmp_output):
        gen = BriefGenerator(output_dir=tmp_output)
        issue, events = self._full_ready_fixture()
        results = gen.generate([issue], events=events)
        assert results[0]["auto_triggered"] is False
        assert not (tmp_output / "auto-trigger.log").exists()

    def test_fires_when_enabled_and_ready_and_high_score(self, tmp_output):
        gen = BriefGenerator(
            config={"brief_generator": {
                "auto_trigger": True,
                "auto_trigger_threshold": 0.8,
            }},
            output_dir=tmp_output,
        )
        issue, events = self._full_ready_fixture()
        results = gen.generate([issue], events=events)
        assert results[0]["auto_triggered"] is True
        log_path = tmp_output / "auto-trigger.log"
        assert log_path.exists()
        entry = json.loads(log_path.read_text().strip().splitlines()[0])
        assert entry["issue_id"] == issue["issue_id"]

    def test_does_not_fire_for_draft_brief(self, tmp_output):
        gen = BriefGenerator(
            config={"brief_generator": {
                "auto_trigger": True,
                "auto_trigger_threshold": 0.8,
            }},
            output_dir=tmp_output,
        )
        issue = _issue(score=0.95, title="generic weather update",
                       stream_signals={})
        results = gen.generate([issue], events=[])
        assert results[0]["status"] == "DRAFT"
        assert results[0]["auto_triggered"] is False

    def test_does_not_fire_below_auto_threshold(self, tmp_output):
        gen = BriefGenerator(
            config={"brief_generator": {
                "auto_trigger": True,
                "auto_trigger_threshold": 0.9,
            }},
            output_dir=tmp_output,
        )
        issue, events = self._full_ready_fixture()
        issue["controversy_score"] = 0.75  # above 0.6 brief threshold, below 0.9 auto
        results = gen.generate([issue], events=events)
        assert results[0]["auto_triggered"] is False


# ---- integration / helpers ----------------------------------------------


class TestHelpers:
    def test_topic_keywords_strips_urls_and_stopwords(self):
        kws = _issue_topic_keywords(
            "Parliament passes the budget amendment https://example.com/x"
        )
        assert "https" not in kws
        assert "the" not in kws
        assert any("budget" in k.lower() for k in kws)

    def test_generate_from_queue_wrapper(self, tmp_output, tmp_path: Path):
        queue = [
            {
                "issue_id": "T4A-TEST-ABC",
                "title": "MACC probes Rafizi budget",
                "controversy_score": 0.85,
                "priority": "critical",
                "confidence": 0.7,
                "timestamp": "2026-04-15T10:00:00+00:00",
                "stream_signals": {
                    "polarization": {"er_index": 0.7, "divergence_trend": "widening"},
                    "narrative": {"jsd_overall": 0.5, "fragmentation_trend": "rising"},
                },
            }
        ]
        queue_path = tmp_path / "q.json"
        queue_path.write_text(json.dumps(queue))
        results = generate_from_queue(
            queue_path=queue_path,
            config={},
            calendar={},
            events=[
                _ev("news", "MACC opens probe into budget", "FMT"),
                _ev("gdelt", "Rafizi budget probe MACC", "x.com", tone=-3.0),
                _ev("reddit", "MACC moves on Rafizi", "r/malaysia"),
            ],
            output_dir=tmp_output,
        )
        assert len(results) == 1
        assert Path(results[0]["path"]).exists()
        assert results[0]["status"] == "READY"
