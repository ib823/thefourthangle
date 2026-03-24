"""Integration tests — end-to-end smoke test with synthetic data."""

from datetime import datetime, timezone, timedelta

import numpy as np
import pytest

from radar.streams.volume_monitor import VolumeMonitor
from radar.streams.cascade_tracker import CascadeTracker
from radar.streams.polarization import PolarizationMonitor
from radar.streams.narrative_frag import NarrativeFragmentationMonitor
from radar.streams.network_bridge import NetworkBridgeMonitor
from radar.fusion.bayesian_fusion import BayesianFusion


def _make_streams_config():
    return {
        "volume_monitor": {
            "cusum": {"k": 0.5, "h": 4.0, "cooldown_hours": 0},
            "bocpd": {"hazard_lambda": 50, "changepoint_threshold": 0.3, "max_run_length": 200},
            "stl": {"daily_period": 96, "weekly_period": 672},
            "baseline_window_days": 7,
            "bucket_minutes": 15,
        },
        "cascade_tracker": {
            "hawkes": {"initial_mu": 1.0, "initial_alpha": 0.5, "initial_beta": 1.0},
            "branching_ratio_thresholds": {"normal": 0.5, "elevated": 0.8, "critical": 1.0},
            "refit_interval_events": 30,
            "refit_interval_minutes": 30,
            "window_events": 500,
        },
        "polarization": {
            "ethnic_weights": {"malay": 0.69, "chinese": 0.23, "indian": 0.07, "other": 0.01},
            "er_alpha": 1.0,
            "alert_threshold": 0.6,
            "bimodality_threshold": 0.555,
            "window_hours": 24,
        },
        "narrative_fragmentation": {
            "jsd_alert_threshold": 0.3,
            "tfidf_top_terms": 20,
            "window_hours": 6,
            "community_weights": {"malay": 0.40, "chinese": 0.25, "english": 0.25, "tamil": 0.10},
        },
        "network_bridge": {
            "bridge_alert_threshold": 0.5,
            "velocity_threshold": 0.01,
            "window_hours": 24,
        },
    }


def _make_fusion_config():
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


def generate_controversy_scenario(seed=42):
    """Generate synthetic events simulating a building controversy.

    Timeline (6 hours, 15-min buckets = 24 buckets):
    - Hours 0-2 (buckets 0-7): Normal baseline, ~10 events per bucket
    - Hours 2-4 (buckets 8-15): Gradual increase, 10→40 events
    - Hours 4-5 (buckets 16-19): Spike, ~60 events per bucket
    - Hours 5-6 (buckets 20-23): Plateau, ~50 events per bucket

    Ethnic divergence injected at hour 3 (bucket 12).
    """
    rng = np.random.default_rng(seed)
    events = []
    now = datetime(2026, 3, 24, tzinfo=timezone.utc)
    topic = "halal_controversy"

    lang_weights = {
        "malay": 0.60,
        "english": 0.25,
        "chinese": 0.10,
        "tamil": 0.05,
    }
    languages = list(lang_weights.keys())
    probs = list(lang_weights.values())

    # Malay negative words, Chinese positive words for divergence
    malay_negative_text = f"{topic} buruk salah rasuah bantah tolak haram"
    malay_positive_text = f"{topic} baik setuju sokong betul adil"
    chinese_positive_text = f"{topic} good support agree positive benefit welcome"
    chinese_negative_text = f"{topic} bad wrong oppose reject terrible"
    english_neutral_text = f"{topic} government policy reform debate discussion"

    for bucket in range(24):
        # Determine event count for this bucket
        if bucket < 8:
            count = int(rng.poisson(10))
        elif bucket < 16:
            count = int(rng.poisson(10 + (bucket - 8) * 4))  # 10→42
        elif bucket < 20:
            count = int(rng.poisson(60))
        else:
            count = int(rng.poisson(50))

        bucket_time = now + timedelta(minutes=15 * bucket)

        for _ in range(count):
            lang = rng.choice(languages, p=probs)
            offset = timedelta(seconds=int(rng.uniform(0, 900)))
            t = bucket_time + offset

            # After bucket 12 (hour 3), inject ethnic divergence
            if bucket >= 12:
                if lang == "malay":
                    text = malay_negative_text
                elif lang == "chinese":
                    text = chinese_positive_text
                elif lang == "tamil":
                    text = malay_negative_text  # Tamil aligns with Malay
                else:
                    text = english_neutral_text
            else:
                text = english_neutral_text

            events.append({
                "timestamp": t.isoformat(),
                "text": text,
                "lang": lang,
                "platform": "twitter",
                "source_name": "twitter",
                "metadata": {
                    "user_id": f"user_{rng.integers(0, 1000)}",
                    "retweet_count": int(rng.poisson(5)),
                },
            })

    return events, topic


class TestEndToEndSmoke:
    def test_controversy_detection(self):
        """Full pipeline: synthetic controversy should be detected and ranked #1."""
        cfg = _make_streams_config()

        vm = VolumeMonitor(cfg["volume_monitor"])
        ct = CascadeTracker(cfg["cascade_tracker"])
        pm = PolarizationMonitor(cfg["polarization"])
        nf = NarrativeFragmentationMonitor(cfg["narrative_fragmentation"])
        nb = NetworkBridgeMonitor(cfg["network_bridge"])
        fusion = BayesianFusion(_make_fusion_config())

        events, topic = generate_controversy_scenario()
        assert len(events) > 200, f"Should generate many events, got {len(events)}"

        # Process through all streams
        vm.process(events)
        ct.process(events)
        pm.process(events)
        nf.process(events)
        nb.process(events)

        # Evaluate topic in polarization and narrative
        now = datetime(2026, 3, 24, 6, 0, tzinfo=timezone.utc)
        pm.evaluate_topic(topic, now)
        nf.evaluate_topic(topic, now)
        nb.evaluate_topic(topic, now)

        # Feed all alerts to fusion
        for stream_name, stream in [
            ("volume_monitor", vm),
            ("cascade_tracker", ct),
            ("polarization", pm),
            ("narrative_fragmentation", nf),
            ("network_bridge", nb),
        ]:
            for alert in stream.get_active_alerts():
                fusion.update(alert.get("keyword", topic), stream_name, alert)

        # Also directly update fusion with evaluated results
        pol_result = pm.evaluate_topic(topic, now)
        nf_result = nf.evaluate_topic(topic, now)
        nb_result = nb.evaluate_topic(topic, now)

        for _ in range(10):  # Multiple rounds to build evidence
            fusion.update(topic, "polarization", pol_result)
            fusion.update(topic, "narrative_fragmentation", nf_result)
            fusion.update(topic, "network_bridge", nb_result)

        issues = fusion.get_ranked_issues()
        assert len(issues) >= 1, "Should have at least one issue"

        # Find our topic
        topic_issues = [i for i in issues if topic in i["title"]]
        assert len(topic_issues) >= 1, f"Topic '{topic}' should be in issue queue"

        # The controversy should be ranked highly
        top_score = issues[0]["controversy_score"]
        assert top_score > 0.15, f"Top score should be above baseline, got {top_score}"

    def test_polarization_detects_divergence(self):
        """Polarization should detect ethnic sentiment divergence at hour 3."""
        cfg = _make_streams_config()
        pm = PolarizationMonitor(cfg["polarization"])

        events, topic = generate_controversy_scenario()

        # Process all events
        pm.process(events)

        # Evaluate
        now = datetime(2026, 3, 24, 6, 0, tzinfo=timezone.utc)
        result = pm.evaluate_topic(topic, now)

        # Should detect divergence between Malay (negative) and Chinese (positive)
        sentiment = result["sentiment_by_community"]
        assert sentiment.get("malay", 0) < sentiment.get("chinese", 0), \
            f"Malay should be more negative than Chinese: {sentiment}"


class TestFalsePositives:
    def test_normal_traffic_no_high_scores(self):
        """Normal daily patterns should not trigger high controversy scores."""
        cfg = _make_streams_config()
        vm = VolumeMonitor(cfg["volume_monitor"])
        fusion = BayesianFusion(_make_fusion_config())

        rng = np.random.default_rng(42)
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # Generate 7 days of normal daily patterns
        key = ("normal_topic", "twitter", "english")
        for day in range(7):
            for bucket in range(96):
                hour = bucket / 4
                # Normal daily pattern: higher during day
                base = 20 if 8 <= hour <= 22 else 5
                count = float(rng.poisson(base))
                t = now + timedelta(days=day, minutes=15 * bucket)
                vm.process_count(key, count, t)

        # After warmup, check alerts
        vm._active_alerts.clear()

        # One more day of same pattern
        for bucket in range(96):
            hour = bucket / 4
            base = 20 if 8 <= hour <= 22 else 5
            count = float(rng.poisson(base))
            t = now + timedelta(days=7, minutes=15 * bucket)
            vm.process_count(key, count, t)

        cusum_alerts = [a for a in vm.get_active_alerts() if a["alert_type"] == "cusum"]
        # Should have very few false positives
        assert len(cusum_alerts) < 10, f"Too many false positives: {len(cusum_alerts)}"


class TestMultiTopic:
    def test_controversial_ranked_first(self):
        """One controversial topic among 4 normal ones should be ranked #1."""
        fusion = BayesianFusion(_make_fusion_config())

        # 4 normal topics — minimal evidence
        for i in range(4):
            topic = f"normal_{i}"
            fusion.update(topic, "volume_monitor", {"severity": 0.2})

        # 1 controversial topic — strong evidence
        hot = "hot_topic"
        for _ in range(10):
            fusion.update(hot, "volume_monitor", {"severity": 0.9, "z_score": 5.0})
            fusion.update(hot, "cascade_tracker", {"n_star": 0.9, "alert_level": "critical"})
            fusion.update(hot, "polarization", {"er_index": 0.8, "divergence_trend": "widening"})

        issues = fusion.get_ranked_issues()
        assert issues[0]["title"] == hot
        assert issues[0]["priority_rank"] == 1
        assert issues[0]["controversy_score"] > 0.5

        # Normal topics should be low
        normal_scores = [i["controversy_score"] for i in issues if i["title"].startswith("normal")]
        assert all(s < 0.3 for s in normal_scores), f"Normal topics too high: {normal_scores}"


class TestPersistence:
    def test_state_continuity(self):
        """State save/load should preserve posteriors across restarts."""
        fusion1 = BayesianFusion(_make_fusion_config())

        for _ in range(10):
            fusion1.update("persist_topic", "volume_monitor", {"severity": 0.9})
            fusion1.update("persist_topic", "cascade_tracker", {"n_star": 0.9})

        score1 = fusion1._topics["persist_topic"].controversy_score
        state = fusion1.get_state()

        # Simulate restart
        fusion2 = BayesianFusion(_make_fusion_config())
        fusion2.load_state(state)

        score2 = fusion2._topics["persist_topic"].controversy_score
        assert score1 == pytest.approx(score2), \
            f"Score should persist: {score1} vs {score2}"

        # Continue updating — should build on existing state, not reset
        fusion2.update("persist_topic", "volume_monitor", {"severity": 0.9})
        score3 = fusion2._topics["persist_topic"].controversy_score
        assert score3 > score2, "Score should continue increasing after state restore"
