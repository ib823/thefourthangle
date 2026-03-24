"""Bayesian Fusion Layer — Combines all 5 detection streams into controversy scores.

Uses Beta-Binomial conjugate updating to maintain per-topic controversy
probabilities, with weighted evidence from each stream.

Reference: framework §6.1 (Detection Engine), §3.1 (Bayesian Updating)
"""

from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

from loguru import logger


# Political keywords for bias dimension mapping
POLITICAL_KEYWORDS = {"kerajaan", "government", "parlimen", "parliament", "election",
                      "pilihanraya", "menteri", "minister", "opposition", "pembangkang",
                      "umno", "pas", "pkr", "dap", "bersatu"}
ETHNIC_KEYWORDS = {"kaum", "bangsa", "melayu", "cina", "india", "bumiputera",
                   "race", "ethnic", "chinese", "indian", "malay", "discrimination"}
RELIGIOUS_KEYWORDS = {"islam", "agama", "fatwa", "halal", "haram", "syariah",
                      "religion", "mosque", "masjid", "allah", "jakim"}
ECONOMIC_KEYWORDS = {"ekonomi", "economy", "harga", "price", "gst", "subsidi",
                     "subsidy", "ringgit", "inflation", "inflasi", "cost"}


class TopicState:
    """Per-topic Beta posterior and signal history."""

    def __init__(self, topic_id: str, prior_alpha: float = 1.0, prior_beta: float = 9.0):
        self.topic_id = topic_id
        self.alpha = prior_alpha
        self.beta = prior_beta
        self.created_at = datetime.now(timezone.utc)
        self.last_updated = self.created_at
        self.stream_signals: dict[str, dict] = {}
        self._issue_counter = 0

    @property
    def controversy_score(self) -> float:
        """Posterior mean of Beta distribution."""
        return self.alpha / (self.alpha + self.beta)

    @property
    def confidence(self) -> float:
        """Confidence based on total evidence (alpha + beta - prior)."""
        total_evidence = (self.alpha + self.beta) - 10.0  # Subtract prior
        # Map to [0, 1]: more evidence = higher confidence
        return min(1.0, max(0.0, total_evidence / 20.0))

    def update(self, positive_evidence: float, negative_evidence: float):
        """Update Beta posterior with weighted evidence."""
        self.alpha += positive_evidence
        self.beta += negative_evidence
        self.last_updated = datetime.now(timezone.utc)

    def decay(self, hours_since_update: float, decay_rate: float = 0.95):
        """Decay posterior toward prior when no new evidence arrives."""
        if hours_since_update <= 0:
            return
        # Multiply alpha and beta by decay_rate per hour of silence
        factor = decay_rate ** hours_since_update
        # Decay toward prior (alpha=1, beta=9)
        self.alpha = 1.0 + (self.alpha - 1.0) * factor
        self.beta = 9.0 + (self.beta - 9.0) * factor

    def to_dict(self) -> dict:
        return {
            "alpha": self.alpha,
            "beta": self.beta,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "stream_signals": self.stream_signals,
        }

    @classmethod
    def from_dict(cls, topic_id: str, data: dict) -> "TopicState":
        ts = cls(topic_id, data.get("alpha", 1.0), data.get("beta", 9.0))
        ts.stream_signals = data.get("stream_signals", {})
        if "created_at" in data:
            try:
                ts.created_at = datetime.fromisoformat(data["created_at"])
            except (ValueError, TypeError):
                pass
        if "last_updated" in data:
            try:
                ts.last_updated = datetime.fromisoformat(data["last_updated"])
            except (ValueError, TypeError):
                pass
        return ts


class BayesianFusion:
    """Combines 6 detection streams via Beta-Binomial conjugate updating."""

    def __init__(self, config: dict):
        self.log = logger.bind(component="fusion")
        self.config = config

        self.prior_alpha = config.get("prior_alpha", 1)
        self.prior_beta = config.get("prior_beta", 9)
        self.decay_rate = config.get("decay_rate_per_hour", 0.95)
        self.archive_threshold = config.get("archive_threshold", 0.05)

        self.stream_weights = config.get("stream_weights", {
            "volume_monitor": 0.15,
            "cascade_tracker": 0.20,
            "polarization": 0.20,
            "narrative_fragmentation": 0.15,
            "network_bridge": 0.10,
            "silence_detector": 0.20,
        })

        self.evidence_thresholds = config.get("evidence_thresholds", {
            "volume_severity": 0.5,
            "cascade_n_star_strong": 0.8,
            "cascade_n_star_weak": 0.5,
            "polarization_er": 0.6,
            "narrative_jsd": 0.3,
            "bridge_score": 0.5,
            "silence_score": 0.6,
            "silence_importance": 0.5,
        })

        # Topic states
        self._topics: dict[str, TopicState] = {}
        self._issue_counter = 0

    def _get_or_create_topic(self, topic_id: str) -> TopicState:
        if topic_id not in self._topics:
            self._topics[topic_id] = TopicState(
                topic_id, self.prior_alpha, self.prior_beta
            )
        return self._topics[topic_id]

    def update(self, topic_id: str, stream_name: str, evidence: dict):
        """Update a topic's posterior with evidence from a stream.

        Args:
            topic_id: keyword/topic identifier
            stream_name: one of the 5 stream names
            evidence: stream-specific output dict
        """
        topic = self._get_or_create_topic(topic_id)
        weight = self.stream_weights.get(stream_name, 0.1)

        # Convert stream evidence to positive/negative signals
        pos, neg = self._convert_evidence(stream_name, evidence)

        topic.update(pos * weight, neg * weight)
        topic.stream_signals[stream_name] = evidence

    def _convert_evidence(self, stream_name: str, evidence: dict) -> tuple[float, float]:
        """Convert stream output to (positive, negative) evidence."""
        thresholds = self.evidence_thresholds

        if stream_name == "volume_monitor":
            severity = evidence.get("severity", 0)
            if severity > thresholds.get("volume_severity", 0.5):
                return (1.0, 0.0)
            return (0.0, 1.0)

        elif stream_name == "cascade_tracker":
            n_star = evidence.get("n_star", 0)
            if n_star > thresholds.get("cascade_n_star_strong", 0.8):
                return (2.0, 0.0)  # Strong positive (2x weight)
            elif n_star > thresholds.get("cascade_n_star_weak", 0.5):
                return (1.0, 0.0)
            return (0.0, 1.0)

        elif stream_name == "polarization":
            er = evidence.get("er_index", 0)
            trend = evidence.get("divergence_trend", "stable")
            pos = 0.0
            if er > thresholds.get("polarization_er", 0.6):
                pos += 1.0
            if trend == "widening":
                pos += 1.0
            return (pos, 0.0 if pos > 0 else 1.0)

        elif stream_name == "narrative_fragmentation":
            jsd_val = evidence.get("jsd_overall", 0)
            trend = evidence.get("fragmentation_trend", "stable")
            pos = 0.0
            if jsd_val > thresholds.get("narrative_jsd", 0.3):
                pos += 1.0
            if trend == "rising":
                pos += 1.0
            return (pos, 0.0 if pos > 0 else 1.0)

        elif stream_name == "network_bridge":
            bridge = evidence.get("bridge_score", 0)
            velocity = evidence.get("bridge_velocity", 0)
            if bridge > thresholds.get("bridge_score", 0.5) and velocity > 0:
                return (1.0, 0.0)
            return (0.0, 1.0)

        elif stream_name == "silence_detector":
            silence = evidence.get("silence_score", 0)
            importance = evidence.get("structural_importance", 0)
            if (silence > thresholds.get("silence_score", 0.6)
                    and importance > thresholds.get("silence_importance", 0.5)):
                # High silence + high importance = strong controversy signal
                return (2.0, 0.0)
            elif silence > 0.4 and importance > 0.4:
                return (1.0, 0.0)
            return (0.0, 0.5)  # Weak negative (absence of silence is weak info)

        return (0.0, 1.0)

    def decay_all(self, now: datetime | None = None):
        """Apply time-based decay to all topics."""
        now = now or datetime.now(timezone.utc)
        to_archive = []

        for topic_id, topic in self._topics.items():
            hours = (now - topic.last_updated).total_seconds() / 3600
            if hours > 0:
                topic.decay(hours, self.decay_rate)

            if topic.controversy_score < self.archive_threshold:
                to_archive.append(topic_id)

        for topic_id in to_archive:
            del self._topics[topic_id]

        if to_archive:
            self.log.info(f"Archived {len(to_archive)} low-score topics")

    def get_ranked_issues(self) -> list[dict]:
        """Return all active topics ranked by controversy score."""
        issues = []
        for topic_id, topic in sorted(
            self._topics.items(),
            key=lambda x: x[1].controversy_score,
            reverse=True,
        ):
            self._issue_counter += 1
            issue_id = f"TFA-2026-{self._issue_counter:04d}"

            # Determine bias dimensions at risk
            dimensions = self._map_bias_dimensions(topic_id, topic.stream_signals)

            # Priority label
            score = topic.controversy_score
            if score > 0.8:
                priority = "critical"
            elif score > 0.6:
                priority = "high"
            elif score > 0.4:
                priority = "medium"
            else:
                priority = "low"

            # Determine detection type
            has_attention = any(
                k in topic.stream_signals
                for k in ("volume_monitor", "cascade_tracker", "polarization",
                          "narrative_fragmentation", "network_bridge")
            )
            has_silence = "silence_detector" in topic.stream_signals
            if has_attention and has_silence:
                detection_type = "both"
            elif has_silence:
                detection_type = "silence_anomaly"
            else:
                detection_type = "attention_spike"

            issues.append({
                "issue_id": issue_id,
                "title": topic_id,
                "controversy_score": round(score, 4),
                "confidence": round(topic.confidence, 4),
                "stream_signals": self._format_signals(topic.stream_signals),
                "bias_dimensions_at_risk": dimensions,
                "detection_type": detection_type,
                "timestamp": topic.last_updated.isoformat(),
                "priority": priority,
                "priority_rank": len(issues) + 1,
            })

        # Fix priority_rank
        for i, issue in enumerate(issues):
            issue["priority_rank"] = i + 1

        return issues

    def get_issue_detail(self, topic_id: str) -> dict | None:
        """Get full detail for a specific topic."""
        if topic_id not in self._topics:
            return None
        topic = self._topics[topic_id]
        return {
            "topic_id": topic_id,
            "controversy_score": topic.controversy_score,
            "confidence": topic.confidence,
            "alpha": topic.alpha,
            "beta": topic.beta,
            "stream_signals": topic.stream_signals,
            "created_at": topic.created_at.isoformat(),
            "last_updated": topic.last_updated.isoformat(),
            "bias_dimensions_at_risk": self._map_bias_dimensions(topic_id, topic.stream_signals),
        }

    def _format_signals(self, signals: dict) -> dict:
        """Format stream signals for output."""
        formatted = {}

        if "volume_monitor" in signals:
            s = signals["volume_monitor"]
            formatted["volume"] = {
                "alert": s.get("severity", 0) > 0.5,
                "severity": s.get("severity", 0),
                "z_score": s.get("z_score", 0),
            }

        if "cascade_tracker" in signals:
            s = signals["cascade_tracker"]
            formatted["cascade"] = {
                "n_star": s.get("n_star", 0),
                "alert_level": s.get("alert_level", "normal"),
            }

        if "polarization" in signals:
            s = signals["polarization"]
            formatted["polarization"] = {
                "er_index": s.get("er_index", 0),
                "divergence_trend": s.get("divergence_trend", "stable"),
            }

        if "narrative_fragmentation" in signals:
            s = signals["narrative_fragmentation"]
            formatted["narrative"] = {
                "jsd_overall": s.get("jsd_overall", 0),
                "fragmentation_trend": s.get("fragmentation_trend", "stable"),
            }

        if "network_bridge" in signals:
            s = signals["network_bridge"]
            formatted["bridge"] = {
                "bridge_score": s.get("bridge_score", 0),
                "bridge_velocity": s.get("bridge_velocity", 0),
            }

        if "silence_detector" in signals:
            s = signals["silence_detector"]
            formatted["silence"] = {
                "silence_score": s.get("silence_score", 0),
                "structural_importance": s.get("structural_importance", 0),
                "suppression_pattern": s.get("suppression_pattern", "NORMAL"),
                "news_mentions": s.get("news_mentions", 0),
                "social_mentions": s.get("social_mentions", 0),
            }

        return formatted

    def _map_bias_dimensions(self, topic_id: str, signals: dict) -> list[str]:
        """Map stream signals to TFA bias dimensions at risk."""
        dimensions = set()
        topic_lower = topic_id.lower()

        # Keyword-based dimension mapping
        if any(kw in topic_lower for kw in POLITICAL_KEYWORDS):
            dimensions.add("political")
        if any(kw in topic_lower for kw in ETHNIC_KEYWORDS):
            dimensions.add("ethnic")
        if any(kw in topic_lower for kw in RELIGIOUS_KEYWORDS):
            dimensions.add("religious")
        if any(kw in topic_lower for kw in ECONOMIC_KEYWORDS):
            dimensions.add("economic")

        # Signal-based dimension mapping
        pol = signals.get("polarization", {})
        if pol.get("er_index", 0) > 0.4:
            dimensions.add("ethnic")
            dimensions.add("religious")

        bridge = signals.get("network_bridge", {})
        if bridge.get("is_bridging", False):
            dimensions.add("ethnic")

        silence = signals.get("silence_detector", {})
        for dim in silence.get("bias_dimensions_touched", []):
            dimensions.add(dim)

        if not dimensions:
            dimensions.add("general")

        return sorted(dimensions)

    def get_state(self) -> dict:
        """Serialize all topic states for persistence."""
        return {
            "topics": {tid: ts.to_dict() for tid, ts in self._topics.items()},
            "issue_counter": self._issue_counter,
        }

    def load_state(self, state: dict):
        """Restore topic states from persistence."""
        self._issue_counter = state.get("issue_counter", 0)
        for tid, data in state.get("topics", {}).items():
            self._topics[tid] = TopicState.from_dict(tid, data)
        self.log.info(f"Loaded {len(self._topics)} topics from state")
