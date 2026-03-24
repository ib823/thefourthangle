"""Stream 5: Network Bridge Detection — Cross-community topic bridging.

Identifies topics that spread across ethnic community boundaries using:
  - Bipartite user-topic graph (lightweight dict-based)
  - Community assignment by primary language
  - Bridge score via inverse HHI (Herfindahl-Hirschman Index)
  - Bridge velocity tracking for escalation detection

Reference: framework §2.6 (Graph Theory)
"""

from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

import numpy as np
from loguru import logger


class NetworkBridgeMonitor:
    """Monitors cross-community topic bridging."""

    COMMUNITIES = ["malay", "chinese", "english", "tamil"]

    def __init__(self, config: dict):
        self.config = config
        self.log = logger.bind(component="network_bridge")

        self.bridge_threshold = config.get("bridge_alert_threshold", 0.5)
        self.velocity_threshold = config.get("velocity_threshold", 0.01)
        self.window_hours = config.get("window_hours", 24)

        # topic -> user_id -> {community, engagement, timestamp}
        self._topic_users: dict[str, dict[str, dict]] = defaultdict(dict)
        self._alerts: list[dict] = []
        self._bridge_history: dict[str, list[tuple[datetime, float]]] = defaultdict(list)

    def add_event(self, topic: str, user_id: str, lang: str,
                  timestamp: datetime, engagement: float = 1.0):
        """Record a user engaging with a topic."""
        community = self._lang_to_community(lang)
        self._topic_users[topic][user_id] = {
            "community": community,
            "engagement": engagement,
            "timestamp": timestamp,
        }

    def process(self, events: list[dict[str, Any]]):
        """Process batch of events."""
        for event in events:
            text = event.get("text", "")
            lang = event.get("lang", "english")
            user_id = event.get("metadata", {}).get("user_id", f"anon_{id(event)}")
            keywords = self._extract_keywords(text)

            try:
                ts_str = event.get("timestamp", "")
                if isinstance(ts_str, str):
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                else:
                    ts = ts_str
            except (ValueError, TypeError):
                ts = datetime.now(timezone.utc)

            engagement = event.get("metadata", {}).get("retweet_count", 0) + 1
            for kw in keywords:
                self.add_event(kw, user_id, lang, ts, float(engagement))

    def _extract_keywords(self, text: str) -> list[str]:
        words = text.lower().split()
        stop = {"the", "a", "an", "is", "was", "are", "in", "on", "at", "to", "for",
                "of", "and", "or", "but", "yang", "dan", "ini", "itu", "di", "ke"}
        significant = [w for w in words if len(w) > 3 and w not in stop]
        return [significant[0]] if significant else []

    @staticmethod
    def _lang_to_community(lang: str) -> str:
        mapping = {"malay": "malay", "chinese": "chinese", "tamil": "tamil",
                   "english": "english", "mixed": "english"}
        return mapping.get(lang, "english")

    def _prune(self, topic: str):
        """Remove users older than window."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=self.window_hours)
        users = self._topic_users.get(topic, {})
        to_remove = [uid for uid, info in users.items() if info["timestamp"] < cutoff]
        for uid in to_remove:
            del users[uid]

    def compute_community_shares(self, topic: str) -> dict[str, float]:
        """Compute engagement share per community for a topic."""
        users = self._topic_users.get(topic, {})
        if not users:
            return {}

        totals = defaultdict(float)
        for info in users.values():
            totals[info["community"]] += info["engagement"]

        grand_total = sum(totals.values())
        if grand_total == 0:
            return {}

        return {c: totals[c] / grand_total for c in self.COMMUNITIES if totals[c] > 0}

    @staticmethod
    def compute_bridge_score(shares: dict[str, float]) -> float:
        """Bridge score = 1 - HHI. Range [0, 0.75] for 4 communities.

        HHI = sum(share_i^2).
        All in one community: HHI=1, bridge=0.
        Even 4-way split: HHI=0.25, bridge=0.75.
        """
        if not shares:
            return 0.0
        hhi = sum(s ** 2 for s in shares.values())
        return 1.0 - hhi

    def compute_bridge_velocity(self, topic: str) -> float:
        """Rate of change of bridge score."""
        history = self._bridge_history.get(topic, [])
        if len(history) < 2:
            return 0.0

        recent = history[-5:]
        if len(recent) < 2:
            return 0.0

        # Simple linear slope
        times = [(t - recent[0][0]).total_seconds() for t, _ in recent]
        values = [v for _, v in recent]

        if times[-1] - times[0] <= 0:
            return 0.0

        # Linear regression slope
        slope = (values[-1] - values[0]) / max(times[-1] - times[0], 1.0)
        return float(slope)

    def evaluate_topic(self, topic: str, timestamp: datetime) -> dict:
        """Full bridge evaluation for a topic."""
        self._prune(topic)
        shares = self.compute_community_shares(topic)
        bridge_score = self.compute_bridge_score(shares)

        self._bridge_history[topic].append((timestamp, bridge_score))
        if len(self._bridge_history[topic]) > 100:
            self._bridge_history[topic] = self._bridge_history[topic][-100:]

        velocity = self.compute_bridge_velocity(topic)
        n_communities = len([s for s in shares.values() if s > 0.05])
        is_bridging = bridge_score > self.bridge_threshold and n_communities >= 2

        result = {
            "keyword": topic,
            "bridge_score": bridge_score,
            "bridge_velocity": velocity,
            "community_shares": shares,
            "is_bridging": is_bridging,
            "n_active_communities": n_communities,
            "timestamp": timestamp.isoformat(),
        }

        if is_bridging and velocity > self.velocity_threshold:
            self._alerts.append(result)

        return result

    def get_active_alerts(self) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        self._alerts = [
            a for a in self._alerts
            if a.get("timestamp", "") >= cutoff.isoformat()
        ]
        return sorted(self._alerts, key=lambda a: a.get("bridge_score", 0), reverse=True)
