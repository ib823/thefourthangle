"""Stream 4: Narrative Fragmentation — JSD across language communities.

Measures whether ethnic communities frame the same issue differently using:
  - TF-IDF term distributions per community per topic
  - Jensen-Shannon Divergence (pairwise and generalized multi-community)
  - Shannon entropy for narrative coherence tracking

Reference: framework §2.8 (Information-Theoretic Measures), §5.1 (Four-Language NLP)
"""

from collections import defaultdict, Counter
from datetime import datetime, timezone, timedelta
from typing import Any

import numpy as np
from loguru import logger


def shannon_entropy(p: np.ndarray) -> float:
    """Shannon entropy H(P) = -sum P(x) * log2(P(x)). Handles zeros."""
    p = p[p > 0]
    if len(p) == 0:
        return 0.0
    return float(-np.sum(p * np.log2(p)))


def kl_divergence(p: np.ndarray, q: np.ndarray, epsilon: float = 1e-10) -> float:
    """KL(P || Q) with Laplace smoothing."""
    p = np.maximum(p, epsilon)
    q = np.maximum(q, epsilon)
    p = p / np.sum(p)
    q = q / np.sum(q)
    return float(np.sum(p * np.log(p / q)))


def jsd(p: np.ndarray, q: np.ndarray, epsilon: float = 1e-10) -> float:
    """Jensen-Shannon Divergence, normalized to [0, 1]."""
    p = np.maximum(p, epsilon)
    q = np.maximum(q, epsilon)
    p = p / np.sum(p)
    q = q / np.sum(q)
    m = 0.5 * (p + q)
    jsd_val = 0.5 * kl_divergence(p, m, epsilon) + 0.5 * kl_divergence(q, m, epsilon)
    # Normalize by log(2) to get [0, 1]
    return float(jsd_val / np.log(2))


def generalized_jsd(distributions: list[np.ndarray], weights: list[float],
                    epsilon: float = 1e-10) -> float:
    """Generalized JSD for multiple distributions with weights.

    JS_alpha(P_1, ..., P_n) = H(sum_i alpha_i * P_i) - sum_i alpha_i * H(P_i)
    Normalized to [0, 1].
    """
    if not distributions or not weights:
        return 0.0

    # Normalize weights
    w = np.array(weights)
    w = w / np.sum(w)

    # Ensure all distributions are over the same vocabulary
    max_len = max(len(d) for d in distributions)
    padded = []
    for d in distributions:
        p = np.zeros(max_len)
        p[:len(d)] = d
        p = np.maximum(p, epsilon)
        p = p / np.sum(p)
        padded.append(p)

    # Mixture distribution
    mixture = np.zeros(max_len)
    for i, p in enumerate(padded):
        mixture += w[i] * p

    # Generalized JSD = H(mixture) - sum_i w_i * H(P_i)
    h_mixture = shannon_entropy(mixture)
    weighted_entropies = sum(w[i] * shannon_entropy(p) for i, p in enumerate(padded))

    jsd_val = h_mixture - weighted_entropies
    # Normalize by log2(n_communities) for [0, 1] range
    max_jsd = np.log2(len(distributions))
    if max_jsd > 0:
        jsd_val /= max_jsd

    return float(np.clip(jsd_val, 0.0, 1.0))


class NarrativeFragmentationMonitor:
    """Monitors narrative fragmentation across language communities."""

    COMMUNITIES = ["malay", "chinese", "english", "tamil"]

    def __init__(self, config: dict):
        self.config = config
        self.log = logger.bind(component="narrative_frag")

        self.jsd_threshold = config.get("jsd_alert_threshold", 0.3)
        self.top_terms = config.get("tfidf_top_terms", 20)
        self.window_hours = config.get("window_hours", 6)
        self.community_weights = config.get("community_weights", {
            "malay": 0.40, "chinese": 0.25, "english": 0.25, "tamil": 0.10
        })

        # Per-topic, per-community term counts
        # topic -> community -> Counter of terms
        self._term_counts: dict[str, dict[str, Counter]] = defaultdict(
            lambda: defaultdict(Counter)
        )
        self._event_timestamps: dict[str, list[datetime]] = defaultdict(list)
        self._alerts: list[dict] = []
        self._jsd_history: dict[str, list[tuple[datetime, float]]] = defaultdict(list)

    def add_event(self, topic: str, lang: str, text: str, timestamp: datetime):
        """Add text from a language community for a topic."""
        community = self._lang_to_community(lang)
        terms = self._tokenize(text)
        self._term_counts[topic][community].update(terms)
        self._event_timestamps[topic].append(timestamp)

    def process(self, events: list[dict[str, Any]]):
        """Process batch of events."""
        for event in events:
            text = event.get("text", "")
            lang = event.get("lang", "english")
            keywords = self._extract_keywords(text)

            try:
                ts_str = event.get("timestamp", "")
                if isinstance(ts_str, str):
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                else:
                    ts = ts_str
            except (ValueError, TypeError):
                ts = datetime.now(timezone.utc)

            for kw in keywords:
                self.add_event(kw, lang, text, ts)

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

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Simple whitespace tokenizer with stopword removal."""
        stop = {"the", "a", "an", "is", "was", "are", "in", "on", "at", "to", "for",
                "of", "and", "or", "but", "it", "this", "that", "with", "from", "by",
                "yang", "dan", "ini", "itu", "di", "ke", "pada", "untuk", "dengan"}
        words = text.lower().split()
        return [w for w in words if len(w) > 2 and w not in stop]

    def get_term_distribution(self, topic: str, community: str) -> np.ndarray:
        """Get normalized term frequency distribution for a community on a topic."""
        counter = self._term_counts.get(topic, {}).get(community, Counter())
        if not counter:
            return np.array([])

        # Get top terms
        top = counter.most_common(self.top_terms)
        counts = np.array([c for _, c in top], dtype=float)
        total = np.sum(counts)
        if total > 0:
            counts /= total
        return counts

    def get_unified_distribution(self, topic: str, community: str,
                                 vocabulary: list[str]) -> np.ndarray:
        """Get distribution over a shared vocabulary."""
        counter = self._term_counts.get(topic, {}).get(community, Counter())
        counts = np.array([counter.get(term, 0) for term in vocabulary], dtype=float)
        total = np.sum(counts)
        if total > 0:
            counts /= total
        return counts

    def evaluate_topic(self, topic: str, timestamp: datetime) -> dict:
        """Full fragmentation evaluation for a topic."""
        # Build shared vocabulary from all communities
        all_terms = Counter()
        active_communities = []
        for community in self.COMMUNITIES:
            counter = self._term_counts.get(topic, {}).get(community, Counter())
            if counter:
                all_terms.update(counter)
                active_communities.append(community)

        if len(active_communities) < 2:
            return {
                "keyword": topic, "jsd_overall": 0.0, "jsd_pairwise": {},
                "entropy_by_community": {}, "fragmentation_trend": "stable",
                "alert_level": "normal", "timestamp": timestamp.isoformat(),
            }

        # Shared vocabulary (top terms across all communities)
        vocabulary = [term for term, _ in all_terms.most_common(self.top_terms * 2)]

        # Get distributions over shared vocabulary
        dists = {}
        for community in active_communities:
            dists[community] = self.get_unified_distribution(topic, community, vocabulary)

        # Pairwise JSD
        jsd_pairwise = {}
        for i, c1 in enumerate(active_communities):
            for c2 in active_communities[i + 1:]:
                key = f"{c1}_{c2}"
                jsd_pairwise[key] = jsd(dists[c1], dists[c2])

        # Generalized JSD
        dist_list = [dists[c] for c in active_communities]
        weight_list = [self.community_weights.get(c, 0.1) for c in active_communities]
        jsd_overall = generalized_jsd(dist_list, weight_list)

        # Per-community entropy
        entropy_by_community = {}
        for community in active_communities:
            entropy_by_community[community] = shannon_entropy(dists[community])

        # Track JSD history
        self._jsd_history[topic].append((timestamp, jsd_overall))
        if len(self._jsd_history[topic]) > 100:
            self._jsd_history[topic] = self._jsd_history[topic][-100:]

        # Trend
        trend = self._compute_trend(topic)

        # Alert level
        if jsd_overall > self.jsd_threshold and trend == "rising":
            alert_level = "critical"
        elif jsd_overall > self.jsd_threshold:
            alert_level = "high"
        elif jsd_overall > self.jsd_threshold * 0.7:
            alert_level = "elevated"
        else:
            alert_level = "normal"

        result = {
            "keyword": topic,
            "jsd_overall": jsd_overall,
            "jsd_pairwise": jsd_pairwise,
            "entropy_by_community": entropy_by_community,
            "fragmentation_trend": trend,
            "alert_level": alert_level,
            "timestamp": timestamp.isoformat(),
        }

        if alert_level in ("critical", "high", "elevated"):
            self._alerts.append(result)

        return result

    def _compute_trend(self, topic: str) -> str:
        history = self._jsd_history.get(topic, [])
        if len(history) < 3:
            return "stable"
        recent = [v for _, v in history[-5:]]
        if len(recent) < 3:
            return "stable"
        # Check if last 3 are monotonically increasing
        if all(recent[i] < recent[i + 1] for i in range(len(recent) - 1)):
            return "rising"
        if all(recent[i] > recent[i + 1] for i in range(len(recent) - 1)):
            return "falling"
        return "stable"

    def get_active_alerts(self) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        self._alerts = [
            a for a in self._alerts
            if a.get("timestamp", "") >= cutoff.isoformat()
        ]
        return sorted(self._alerts, key=lambda a: a.get("jsd_overall", 0), reverse=True)
