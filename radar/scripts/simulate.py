#!/usr/bin/env python3
"""Simulate a Malaysian controversy scenario and run through the full radar.

Generates synthetic events, processes through all 5 streams and fusion,
and prints a visual timeline of alerts and scores.

Usage:
    python radar/scripts/simulate.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from datetime import datetime, timezone, timedelta

import numpy as np

from radar.streams.volume_monitor import VolumeMonitor
from radar.streams.cascade_tracker import CascadeTracker
from radar.streams.polarization import PolarizationMonitor
from radar.streams.narrative_frag import NarrativeFragmentationMonitor
from radar.streams.network_bridge import NetworkBridgeMonitor
from radar.fusion.bayesian_fusion import BayesianFusion


def generate_scenario():
    """Generate a realistic Malaysian controversy scenario.

    Scenario: A halal certification controversy erupts after a viral
    social media post about a popular restaurant chain. Malay community
    reacts negatively (haram claims), Chinese community defends
    (economic freedom), English media tries to stay neutral.
    """
    rng = np.random.default_rng(2026)
    events = []
    now = datetime(2026, 3, 24, 8, 0, tzinfo=timezone.utc)  # 8 AM MYT start
    topic = "halal_controversy"

    print("Generating synthetic controversy scenario...")
    print(f"  Topic: {topic}")
    print(f"  Start: {now.isoformat()}")
    print()

    templates = {
        "malay_negative": [
            f"{topic} ini haram salah buruk kutuk bantah",
            f"{topic} tidak halal bohong fitnah tolak",
            f"{topic} zalim rasuah gagal munafik khianat",
        ],
        "malay_positive": [
            f"{topic} baik setuju betul adil sokong",
        ],
        "chinese_positive": [
            f"{topic} good support agree business freedom",
            f"{topic} positive fair economy benefit progress",
        ],
        "tamil_negative": [
            f"{topic} bad wrong unfair discriminate oppose",
        ],
        "english_neutral": [
            f"{topic} government policy reform investigation report",
            f"{topic} statement official response review assessment",
        ],
    }

    # 24 buckets (6 hours at 15-min intervals)
    for bucket in range(24):
        # Volume pattern
        if bucket < 8:
            n = int(rng.poisson(8))
            phase = "baseline"
        elif bucket < 12:
            n = int(rng.poisson(8 + (bucket - 8) * 5))
            phase = "building"
        elif bucket < 16:
            n = int(rng.poisson(45))
            phase = "spike"
        elif bucket < 20:
            n = int(rng.poisson(60))
            phase = "peak"
        else:
            n = int(rng.poisson(40))
            phase = "plateau"

        t_base = now + timedelta(minutes=15 * bucket)

        for i in range(n):
            # Language distribution
            r = rng.random()
            if r < 0.55:
                lang = "malay"
            elif r < 0.80:
                lang = "english"
            elif r < 0.92:
                lang = "chinese"
            else:
                lang = "tamil"

            t = t_base + timedelta(seconds=int(rng.uniform(0, 900)))

            # After bucket 10 (hour 2.5), inject ethnic divergence
            if bucket >= 10:
                if lang == "malay":
                    text = rng.choice(templates["malay_negative"])
                elif lang == "chinese":
                    text = rng.choice(templates["chinese_positive"])
                elif lang == "tamil":
                    text = rng.choice(templates["tamil_negative"])
                else:
                    text = rng.choice(templates["english_neutral"])
            else:
                text = rng.choice(templates["english_neutral"])

            events.append({
                "timestamp": t.isoformat(),
                "text": text,
                "lang": lang,
                "platform": "twitter",
                "source_name": "twitter",
                "metadata": {
                    "user_id": f"user_{rng.integers(0, 2000)}",
                    "retweet_count": int(rng.poisson(3 + bucket)),
                },
            })

    return events, topic, now


def run_simulation():
    """Run the full radar pipeline on synthetic data."""
    events, topic, start_time = generate_scenario()
    print(f"Generated {len(events)} events over 6 hours")
    print()

    # Initialize all components
    cfg_vm = {
        "cusum": {"k": 0.5, "h": 4.0, "cooldown_hours": 0},
        "bocpd": {"hazard_lambda": 50, "changepoint_threshold": 0.3, "max_run_length": 200},
        "stl": {"daily_period": 96, "weekly_period": 672},
        "baseline_window_days": 7, "bucket_minutes": 15,
    }
    cfg_ct = {
        "hawkes": {"initial_mu": 1.0, "initial_alpha": 0.5, "initial_beta": 1.0},
        "branching_ratio_thresholds": {"normal": 0.5, "elevated": 0.8, "critical": 1.0},
        "refit_interval_events": 30, "refit_interval_minutes": 30, "window_events": 500,
    }
    cfg_pm = {
        "ethnic_weights": {"malay": 0.69, "chinese": 0.23, "indian": 0.07},
        "er_alpha": 1.0, "alert_threshold": 0.6, "bimodality_threshold": 0.555, "window_hours": 24,
    }
    cfg_nf = {
        "jsd_alert_threshold": 0.3, "tfidf_top_terms": 20, "window_hours": 6,
        "community_weights": {"malay": 0.40, "chinese": 0.25, "english": 0.25, "tamil": 0.10},
    }
    cfg_nb = {"bridge_alert_threshold": 0.5, "velocity_threshold": 0.01, "window_hours": 24}
    cfg_fusion = {
        "prior_alpha": 1, "prior_beta": 9, "decay_rate_per_hour": 0.95,
        "archive_threshold": 0.05,
        "stream_weights": {
            "volume_monitor": 0.20, "cascade_tracker": 0.25, "polarization": 0.25,
            "narrative_fragmentation": 0.15, "network_bridge": 0.15,
        },
        "evidence_thresholds": {
            "volume_severity": 0.5, "cascade_n_star_strong": 0.8, "cascade_n_star_weak": 0.5,
            "polarization_er": 0.6, "narrative_jsd": 0.3, "bridge_score": 0.5,
        },
    }

    vm = VolumeMonitor(cfg_vm)
    ct = CascadeTracker(cfg_ct)
    pm = PolarizationMonitor(cfg_pm)
    nf = NarrativeFragmentationMonitor(cfg_nf)
    nb = NetworkBridgeMonitor(cfg_nb)
    fusion = BayesianFusion(cfg_fusion)

    # Process events in hourly batches and print timeline
    print("=" * 70)
    print("SIMULATION TIMELINE")
    print("=" * 70)
    print(f"{'Hour':>6} | {'Events':>7} | {'Vol Alert':>10} | {'ER Index':>9} | {'JSD':>6} | {'Bridge':>7} | {'Score':>7}")
    print("-" * 70)

    for hour in range(7):
        t_start = start_time + timedelta(hours=hour)
        t_end = t_start + timedelta(hours=1)

        # Filter events for this hour
        hour_events = [
            e for e in events
            if t_start.isoformat() <= e["timestamp"] < t_end.isoformat()
        ]

        # Process through streams
        vm.process(hour_events)
        ct.process(hour_events)
        pm.process(hour_events)
        nf.process(hour_events)
        nb.process(hour_events)

        # Evaluate topic
        eval_time = t_end
        pol_result = pm.evaluate_topic(topic, eval_time)
        nf_result = nf.evaluate_topic(topic, eval_time)
        nb_result = nb.evaluate_topic(topic, eval_time)

        # Feed to fusion
        vm_alerts = [a for a in vm.get_active_alerts() if topic in a.get("keyword", "")]
        ct_status = ct.get_status(topic)

        if vm_alerts:
            fusion.update(topic, "volume_monitor", vm_alerts[0])
        if ct_status:
            fusion.update(topic, "cascade_tracker", ct_status)
        fusion.update(topic, "polarization", pol_result)
        fusion.update(topic, "narrative_fragmentation", nf_result)
        fusion.update(topic, "network_bridge", nb_result)

        # Get current score
        issues = fusion.get_ranked_issues()
        topic_issue = next((i for i in issues if topic in i["title"]), None)
        score = topic_issue["controversy_score"] if topic_issue else 0.1

        # Print timeline row
        vol_alert = "YES" if vm_alerts else "no"
        er = pol_result.get("er_index", 0)
        jsd_val = nf_result.get("jsd_overall", 0)
        bridge = nb_result.get("bridge_score", 0)

        print(f"  {hour:>4}h | {len(hour_events):>7} | {vol_alert:>10} | {er:>9.3f} | {jsd_val:>6.3f} | {bridge:>7.3f} | {score:>7.3f}")

    print("-" * 70)
    print()

    # Final summary
    issues = fusion.get_ranked_issues()
    print("FINAL ISSUE QUEUE")
    print("=" * 70)
    for issue in issues[:5]:
        priority = issue.get("priority", "low").upper()
        dims = ", ".join(issue.get("bias_dimensions_at_risk", []))
        print(f"  [{priority:>8}] {issue['title']:<30} score={issue['controversy_score']:.3f}  dims=[{dims}]")
    print("=" * 70)

    # Polarization detail
    final_pol = pm.evaluate_topic(topic, start_time + timedelta(hours=6))
    print(f"\nPolarization detail for '{topic}':")
    print(f"  ER Index:      {final_pol['er_index']:.3f}")
    print(f"  Bimodal:       {final_pol['is_bimodal']}")
    print(f"  Sentiment:     {final_pol['sentiment_by_community']}")
    print(f"  Max divergence:{final_pol['max_pairwise_divergence']:.3f}")
    print(f"  Trend:         {final_pol['divergence_trend']}")


if __name__ == "__main__":
    run_simulation()
