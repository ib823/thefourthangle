#!/usr/bin/env python3
"""T4A Radar — Controversy Detection & Prediction Engine.

Main entry point. Orchestrates data source connectors, detection streams,
and Bayesian fusion to produce a ranked issue queue.

Usage:
    python run-radar.py              # Run continuously (default: every 30 min)
    python run-radar.py --once       # Run single cycle and exit
    python run-radar.py --status     # Print current issue queue
    python run-radar.py --history    # Print 24-hour alert history
    python run-radar.py --topic X    # Print full detail for topic X
"""

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

import yaml
from dotenv import load_dotenv
from loguru import logger

# Resolve paths and ensure radar package is importable
RADAR_DIR = Path(__file__).parent
sys.path.insert(0, str(RADAR_DIR.parent))
CONFIG_PATH = RADAR_DIR / "config" / "config.yaml"
CALENDAR_PATH = RADAR_DIR / "config" / "malaysia-calendar.json"
OUTPUT_DIR = RADAR_DIR / "output"
STATE_PATH = OUTPUT_DIR / "state.json"
QUEUE_PATH = OUTPUT_DIR / "issue-queue.json"
LOG_DIR = OUTPUT_DIR / "logs"
MODELS_DIR = OUTPUT_DIR / "models"


def load_config():
    """Load YAML config and calendar."""
    with open(CONFIG_PATH) as f:
        config = yaml.safe_load(f)
    with open(CALENDAR_PATH) as f:
        calendar = json.load(f)
    config["calendar"] = calendar
    return config


def setup_logging(config):
    """Configure loguru logging."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger.remove()
    log_cfg = config.get("logging", {})
    logger.add(
        sys.stderr,
        level=log_cfg.get("level", "INFO"),
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level:<8}</level> | <cyan>{extra[component]:<20}</cyan> | {message}",
    )
    logger.add(
        str(LOG_DIR / "radar_{time}.log"),
        level=log_cfg.get("level", "INFO"),
        rotation=log_cfg.get("rotation", "10 MB"),
        retention=log_cfg.get("retention", "7 days"),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {extra[component]:<20} | {message}",
    )
    return logger.bind(component="main")


def init_sources(config):
    """Initialize data source connectors."""
    from radar.sources import SourceAggregator
    try:
        return SourceAggregator(config)
    except Exception as e:
        log = logger.bind(component="sources")
        log.warning(f"Failed to initialize sources: {e}. Continuing without live data.")
        return None


def init_streams(config):
    """Initialize the 6 detection streams."""
    from radar.streams.volume_monitor import VolumeMonitor
    from radar.streams.cascade_tracker import CascadeTracker
    from radar.streams.polarization import PolarizationMonitor
    from radar.streams.narrative_frag import NarrativeFragmentationMonitor
    from radar.streams.network_bridge import NetworkBridgeMonitor
    from radar.streams.silence_detector import SilenceDetector

    streams_cfg = config.get("streams", {})
    streams = {}

    try:
        streams["volume_monitor"] = VolumeMonitor(streams_cfg.get("volume_monitor", {}))
    except Exception as e:
        logger.bind(component="streams").error(f"Volume monitor init failed: {e}")
        streams["volume_monitor"] = None

    try:
        streams["cascade_tracker"] = CascadeTracker(streams_cfg.get("cascade_tracker", {}))
    except Exception as e:
        logger.bind(component="streams").error(f"Cascade tracker init failed: {e}")
        streams["cascade_tracker"] = None

    try:
        streams["polarization"] = PolarizationMonitor(streams_cfg.get("polarization", {}))
    except Exception as e:
        logger.bind(component="streams").error(f"Polarization monitor init failed: {e}")
        streams["polarization"] = None

    try:
        streams["narrative_fragmentation"] = NarrativeFragmentationMonitor(
            streams_cfg.get("narrative_fragmentation", {})
        )
    except Exception as e:
        logger.bind(component="streams").error(f"Narrative frag init failed: {e}")
        streams["narrative_fragmentation"] = None

    try:
        streams["network_bridge"] = NetworkBridgeMonitor(streams_cfg.get("network_bridge", {}))
    except Exception as e:
        logger.bind(component="streams").error(f"Network bridge init failed: {e}")
        streams["network_bridge"] = None

    try:
        sd = SilenceDetector(streams_cfg.get("silence_detector", {}))
        # Pre-populate watchlist from calendar
        calendar = config.get("calendar", {})
        if calendar:
            sd.load_watchlist_from_calendar(calendar)
        streams["silence_detector"] = sd
    except Exception as e:
        logger.bind(component="streams").error(f"Silence detector init failed: {e}")
        streams["silence_detector"] = None

    active = [k for k, v in streams.items() if v is not None]
    logger.bind(component="streams").info(f"Initialized {len(active)}/6 streams: {active}")
    return streams


def init_fusion(config):
    """Initialize Bayesian fusion layer."""
    from radar.fusion.bayesian_fusion import BayesianFusion
    return BayesianFusion(config.get("fusion", {}))


def load_state():
    """Load persisted state from previous run. Handles missing/corrupt files."""
    if not STATE_PATH.exists():
        return None
    try:
        with open(STATE_PATH) as f:
            state = json.load(f)
        logger.bind(component="state").info(f"Loaded state from {STATE_PATH}")
        return state
    except (json.JSONDecodeError, ValueError, OSError) as e:
        logger.bind(component="state").error(f"Corrupt state.json — starting fresh: {e}")
        return None


def save_state(state):
    """Persist state for next run."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2, default=str)


HEALTH_PATH = OUTPUT_DIR / "health.json"
ARCHIVE_DIR = OUTPUT_DIR / "archive"
PRUNE_DAYS = 7


def write_issue_queue(new_issues):
    """Append new issues to queue, prune entries older than 7 days."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log = logger.bind(component="output")

    # Load existing queue
    existing = []
    if QUEUE_PATH.exists():
        try:
            with open(QUEUE_PATH) as f:
                existing = json.load(f)
                if not isinstance(existing, list):
                    existing = []
        except (json.JSONDecodeError, ValueError):
            existing = []

    # Merge: update existing issues by title, add new ones
    by_title = {i["title"]: i for i in existing}
    new_count = 0
    for issue in new_issues:
        title = issue.get("title", "")
        if title in by_title:
            # Update existing — keep higher score, update signals
            old = by_title[title]
            if issue.get("controversy_score", 0) >= old.get("controversy_score", 0):
                by_title[title] = issue
        else:
            by_title[title] = issue
            new_count += 1

    # Prune issues older than PRUNE_DAYS
    cutoff = (datetime.now(timezone.utc) - timedelta(days=PRUNE_DAYS)).isoformat()
    before_prune = len(by_title)
    by_title = {
        t: i for t, i in by_title.items()
        if i.get("timestamp", "") >= cutoff or i.get("controversy_score", 0) > 0.3
    }
    pruned = before_prune - len(by_title)

    # Sort by score descending, re-rank
    merged = sorted(by_title.values(), key=lambda x: x.get("controversy_score", 0), reverse=True)
    for i, issue in enumerate(merged):
        issue["priority_rank"] = i + 1

    # Write
    with open(QUEUE_PATH, "w") as f:
        json.dump(merged, f, indent=2, default=str)

    # Archive pruned issues (not committed to git)
    if pruned > 0:
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
        archive_file = ARCHIVE_DIR / f"pruned-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
        try:
            with open(archive_file, "w") as f:
                json.dump({"pruned_at": datetime.now(timezone.utc).isoformat(), "count": pruned}, f)
        except OSError:
            pass

    log.info(f"{len(merged)} active issues, {new_count} new, {pruned} pruned")


def write_health(sources, streams, events_count, issues_count):
    """Write health.json for monitoring."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    health = {
        "last_scan": datetime.now(timezone.utc).isoformat(),
        "events_fetched": events_count,
        "issues_tracked": issues_count,
        "sources": {},
        "streams": {},
    }

    if sources:
        for h in sources.health():
            health["sources"][h["name"]] = {
                "status": h.get("status", "unknown"),
                "last_fetch": h.get("last_fetch"),
                "error_rate": h.get("error_rate", 0),
            }

    for name, stream in streams.items():
        health["streams"][name] = "ok" if stream is not None else "disabled"

    with open(HEALTH_PATH, "w") as f:
        json.dump(health, f, indent=2, default=str)


def _process_stream(name, stream, events):
    """Process events through a single stream. Used in thread pool."""
    try:
        stream.process(events)
        return name, "ok", None
    except Exception as e:
        return name, "error", str(e)


_PIPELINE_SINGLETON = None


def _get_prediction_pipeline(config):
    """Lazy-build the PredictionPipeline and reuse across cycles."""
    global _PIPELINE_SINGLETON
    if _PIPELINE_SINGLETON is not None:
        return _PIPELINE_SINGLETON
    from radar.prediction.pipeline import PredictionPipeline
    calendar = config.get("calendar", {})
    issues_dir = Path(__file__).parent.parent / "src" / "data" / "issues"
    _PIPELINE_SINGLETON = PredictionPipeline(
        calendar=calendar,
        models_dir=MODELS_DIR,
        issues_dir=issues_dir,
    )
    return _PIPELINE_SINGLETON


def _log_prediction_status(log, result):
    """Emit a concise one-line summary of each predictor's outcome."""
    days = result.get("days_of_data", 0)
    parts = [f"days_of_data={days}"]
    for key in ("hmm", "cox", "sarima"):
        st = result.get(key) or {}
        if st.get("cold_start"):
            parts.append(f"{key}=COLD({st.get('days_needed', '?')}d)")
        elif st.get("error"):
            parts.append(f"{key}=ERR")
        else:
            tag = "RT" if st.get("retrained") else "OK"
            parts.append(f"{key}={tag}/{st.get('applied', 0)}")
    log.info("Predictions: " + "  ".join(parts))


def run_cycle(sources, streams, fusion, config):
    """Execute one full radar scan cycle."""
    log = logger.bind(component="cycle")
    cycle_start = datetime.now(timezone.utc)
    log.info(f"Cycle started at {cycle_start.isoformat()}")

    # Step 1: Fetch new events
    events = []
    if sources is not None:
        try:
            events = sources.fetch_all()
        except Exception as e:
            log.error(f"Source fetch failed: {e}")
    log.info(f"Fetched {len(events)} events")

    # Step 1b: Register institutional events with silence detector
    sd = streams.get("silence_detector")
    if sd and events:
        for event in events:
            platform = event.get("platform", "")
            if platform in ("parliament", "court"):
                meta = event.get("metadata", {})
                event_type = meta.get("event_type", "bill_reading")
                title = event.get("text", "")[:200]
                try:
                    ts_str = event.get("timestamp", "")
                    if isinstance(ts_str, str):
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    else:
                        ts = ts_str
                except (ValueError, TypeError):
                    ts = now
                sd.add_institutional_event(
                    event_type=event_type,
                    title=title,
                    description=", ".join(meta.get("matched_keywords", [])) if isinstance(meta.get("matched_keywords"), list) else str(meta.get("matched_keywords", "")),
                    source_institution=meta.get("source_institution", platform),
                    date=ts,
                )

    # Step 2: Feed events to all 6 streams in parallel
    active_streams = {k: v for k, v in streams.items() if v is not None}
    stream_health = {}

    if events and active_streams:
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {
                executor.submit(_process_stream, name, stream, events): name
                for name, stream in active_streams.items()
            }
            for future in as_completed(futures):
                name, status, error = future.result()
                stream_health[name] = status
                if error:
                    log.error(f"Stream {name} failed: {error}")
    log.info(f"Streams processed: {stream_health}")

    # Step 3: Collect alerts and feed to fusion
    now = datetime.now(timezone.utc)

    # Extract topics by matching config keywords against event text
    keywords_cfg = config.get("keywords", {})
    all_keywords = set()
    for category in keywords_cfg.values():
        if isinstance(category, dict):
            for lang_kws in category.values():
                if isinstance(lang_kws, list):
                    for kw in lang_kws:
                        all_keywords.add(kw.lower())

    # Count keyword matches across events
    from collections import Counter
    topic_counts = Counter()
    for event in events:
        text = event.get("text", "").lower()
        for kw in all_keywords:
            if kw in text:
                topic_counts[kw] += 1

    # Top topics by mention count
    topics_seen = {kw for kw, count in topic_counts.most_common(30) if count >= 2}
    log.info(f"Matched {len(topics_seen)} config keywords in events. Top: {topic_counts.most_common(10)}")

    # Evaluate topics in polarization, narrative_frag, and network_bridge
    for topic in topics_seen:
        for sname in ["polarization", "narrative_fragmentation", "network_bridge"]:
            stream = active_streams.get(sname)
            if stream and hasattr(stream, "evaluate_topic"):
                try:
                    result = stream.evaluate_topic(topic, now)
                    if result.get("alert_level", "normal") != "normal":
                        fusion.update(topic, sname, result)
                except Exception:
                    pass

    # Also feed volume/cascade evidence for matched topics
    for topic in topics_seen:
        count = topic_counts[topic]
        # Volume signal: treat count as severity proxy
        severity = min(1.0, count / 20.0)
        fusion.update(topic, "volume_monitor", {"severity": severity, "z_score": count / 5.0})
        # Cascade signal: more mentions = higher n_star proxy
        fusion.update(topic, "cascade_tracker", {"n_star": min(0.9, count / 30.0), "alert_level": "normal"})

    # Evaluate silence detector
    sd = active_streams.get("silence_detector")
    if sd and hasattr(sd, "evaluate_all"):
        silence_alerts = sd.evaluate_all(now)
        for alert in silence_alerts:
            if alert.get("alert_level", "low") != "low":
                topic = alert.get("title", alert.get("keyword", "unknown")).lower()
                fusion.update(topic, "silence_detector", alert)
        if silence_alerts:
            log.info(f"Silence detector: {len(silence_alerts)} events monitored, "
                     f"{sum(1 for a in silence_alerts if a['alert_level'] != 'low')} flagged")

    # Collect alerts from all streams
    for name, stream in active_streams.items():
        try:
            alerts = stream.get_active_alerts()
            for alert in alerts:
                topic = alert.get("keyword", "unknown")
                fusion.update(topic, name, alert)
        except Exception as e:
            log.error(f"Alert collection from {name} failed: {e}")

    # Step 4: Apply time-based decay
    fusion.decay_all(now)

    # Step 5: Get ranked issue queue
    issues = fusion.get_ranked_issues()
    log.info(f"Issue queue: {len(issues)} active topics")

    # Step 6: Write output
    write_issue_queue(issues)
    write_health(sources, active_streams, len(events), len(issues))

    # Step 7: Predictions — HMM regime, Cox eruption timing, SARIMA windows.
    # Each predictor has its own cold-start gate (7 / 14 / 30 days) and
    # retrain cadence (weekly / monthly / weekly). The pipeline mutates
    # `prediction_state` (persisted alongside the cycle state) and writes
    # back the enriched queue in-place.
    prior_state = load_state() or {}
    prediction_state = prior_state.get("prediction_state", {})
    try:
        pipeline = _get_prediction_pipeline(config)
        pipeline_result = pipeline.run(
            queue_path=QUEUE_PATH,
            state=prediction_state,
            events_count=len(events),
            now=cycle_start,
        )
        _log_prediction_status(log, pipeline_result)
    except Exception as e:
        log.error(f"Prediction pipeline failed: {e}")
        pipeline_result = {"error": str(e)}

    # Step 7b: Optional in-cycle brief generation with live events.
    # Runs only when config.brief_generator.auto_trigger is enabled. Uses the
    # fresh events fetched this cycle so context is multi-source. Off by
    # default — operators flip it on once they trust the score thresholds.
    bg_cfg = config.get("brief_generator", {}) or {}
    if bg_cfg.get("auto_trigger"):
        try:
            from radar.brief_generator import BriefGenerator
            with open(QUEUE_PATH) as f:
                queue_now = json.load(f)
            gen = BriefGenerator(config=config, calendar=config.get("calendar", {}))
            brief_results = gen.generate(queue_now, events=events)
            auto_n = sum(1 for r in brief_results if r.get("auto_triggered"))
            log.info(f"Briefs: {len(brief_results)} generated, {auto_n} auto-triggered")
        except Exception as e:
            log.error(f"Brief generation failed: {e}")

    # Step 8: Save state
    state = {
        "last_cycle": cycle_start.isoformat(),
        "events_processed": len(events),
        "active_topics": len(issues),
        "stream_health": stream_health,
        "fusion": fusion.get_state(),
        "volume_monitor": streams.get("volume_monitor").get_state()
            if streams.get("volume_monitor") else {},
        "cascade_tracker": streams.get("cascade_tracker").get_state()
            if streams.get("cascade_tracker") else {},
        "prediction_state": prediction_state,
        "last_pipeline_result": pipeline_result,
    }
    save_state(state)

    # Step 8: Log summary
    if issues:
        top = issues[0]
        log.info(
            f"Cycle complete. {len(issues)} active topics. "
            f"Top: {top['title']} (score: {top['controversy_score']:.2f})"
        )
    else:
        log.info("Cycle complete. No active topics.")

    return issues


def print_status():
    """Print current issue queue + prediction summary from last saved state."""
    if not QUEUE_PATH.exists():
        print("No issue queue found. Run a cycle first.")
        return
    with open(QUEUE_PATH) as f:
        issues = json.load(f)
    if not issues:
        print("Issue queue is empty.")
        return

    print(f"\n{'='*72}")
    print(f"T4A RADAR — Issue Queue ({len(issues)} active topics)")
    print(f"{'='*72}")
    for issue in issues[:20]:
        priority = issue.get("priority", "low").upper()
        pred = issue.get("prediction") or {}
        regime = pred.get("regime") or "-"
        eh = pred.get("eruption_hours")
        eh_str = f"{eh:>5.1f}h" if isinstance(eh, (int, float)) else "    -"
        print(f"  [{priority:>8}] {issue.get('title', 'unknown'):<32} "
              f"score={issue.get('controversy_score', 0):.2f}  "
              f"regime={regime:<16} eta={eh_str}")
    if len(issues) > 20:
        print(f"  ... and {len(issues) - 20} more")

    try:
        from radar.prediction.pipeline import summarize_predictions
    except ImportError:
        print(f"{'='*72}\n")
        return

    summary = summarize_predictions(issues)

    regime_counts = summary["regime_counts"]
    if regime_counts:
        print(f"\nRegimes: " + "  ".join(
            f"{k}={v}" for k, v in sorted(
                regime_counts.items(), key=lambda kv: -kv[1])
        ))

    escalations = summary["escalations"][:5]
    if escalations:
        print(f"\nEscalation warnings (top {len(escalations)}):")
        for e in escalations:
            p = (e.get("probabilities") or {}).get("PRE_CONTROVERSY", 0)
            print(f"  {e['title']:<40} P(PRE)={p:.2f}  [{e.get('priority', '?')}]")

    imminent = summary["imminent"][:5]
    if imminent:
        print(f"\nImminent eruptions (<72h, top {len(imminent)}):")
        for m in imminent:
            print(f"  {m['title']:<40} ETA={m['eruption_hours']:.1f}h  "
                  f"P(72h)={m.get('p_eruption_within_72h', 0):.2f}")

    windows = summary["upcoming_controversy_windows"]
    if windows:
        print("\nUpcoming controversy windows:")
        for h in ("7", "14", "30", "90", "180"):
            ws = windows.get(h) or []
            if ws:
                preview = ", ".join(
                    f"{w.get('start')}→{w.get('end')}" for w in ws[:3]
                )
                extra = "" if len(ws) <= 3 else f" (+{len(ws) - 3} more)"
                print(f"  {h:>4}d: {preview}{extra}")

    print(f"{'='*72}\n")


def print_topic_detail(topic_id):
    """Print full detail for a specific topic."""
    if not QUEUE_PATH.exists():
        print("No issue queue found.")
        return
    with open(QUEUE_PATH) as f:
        issues = json.load(f)
    for issue in issues:
        if issue.get("issue_id") == topic_id or issue.get("title") == topic_id:
            print(json.dumps(issue, indent=2))
            return
    print(f"Topic '{topic_id}' not found in issue queue.")


def generate_briefs_cli(config):
    """Generate pipeline-v3 research briefs from the current issue queue.

    Invoked via `python run-radar.py --generate-briefs`. Operates off the
    persisted issue queue — no live events, so briefs fall back to
    signal-derived context. Briefs meeting the quality gate are tagged READY;
    others are tagged DRAFT.
    """
    from radar.brief_generator import generate_from_queue
    log = logger.bind(component="brief_gen")
    results = generate_from_queue(
        queue_path=QUEUE_PATH,
        config=config,
        calendar=config.get("calendar", {}),
    )
    if not results:
        log.info("No qualifying issues (score >= threshold) in queue.")
        return
    ready = sum(1 for r in results if r["status"] == "READY")
    draft = len(results) - ready
    log.info(f"Generated {len(results)} briefs — READY={ready} DRAFT={draft}")
    for r in results[:10]:
        auto = " [auto-triggered]" if r.get("auto_triggered") else ""
        log.info(f"  [{r['status']}] {r['title'][:50]}{auto}  → {r['path']}")


def main():
    parser = argparse.ArgumentParser(description="T4A Radar — Controversy Detection Engine")
    parser.add_argument("--once", action="store_true", help="Run single cycle and exit")
    parser.add_argument("--status", action="store_true", help="Print current issue queue")
    parser.add_argument("--history", action="store_true", help="Print 24-hour alert history")
    parser.add_argument("--topic", type=str, help="Print full detail for topic")
    parser.add_argument("--generate-briefs", action="store_true",
                        help="Generate pipeline-v3 briefs for score>threshold issues")
    args = parser.parse_args()

    load_dotenv()
    config = load_config()
    log = setup_logging(config)
    log.info("T4A Radar starting")

    # Query-only modes
    if args.status:
        print_status()
        return
    if args.history:
        print("Alert history: check radar/output/logs/ for full history.")
        return
    if args.topic:
        print_topic_detail(args.topic)
        return
    if args.generate_briefs:
        generate_briefs_cli(config)
        return

    # Initialize components
    sources = init_sources(config)
    streams = init_streams(config)
    fusion = init_fusion(config)

    # Load previous state
    state = load_state()
    if state and "fusion" in state:
        fusion.load_state(state["fusion"])

    if args.once:
        log.info("Running single cycle (--once)")
        run_cycle(sources, streams, fusion, config)
    else:
        interval = config.get("cycle_interval_minutes", 30)
        log.info(f"Running continuously every {interval} minutes. Ctrl+C to stop.")
        try:
            while True:
                run_cycle(sources, streams, fusion, config)
                log.info(f"Sleeping {interval} minutes until next cycle...")
                time.sleep(interval * 60)
        except KeyboardInterrupt:
            log.info("Keyboard interrupt — saving state and exiting")
            save_state({
                "last_cycle": datetime.now(timezone.utc).isoformat(),
                "shutdown": "graceful",
                "fusion": fusion.get_state(),
            })
            sys.exit(0)


if __name__ == "__main__":
    main()
