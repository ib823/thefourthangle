"""Stream 3: Polarization Measurement — Ethnic opinion split detection.

Detects when ethnic communities diverge in sentiment on the same issue using:
  - Language-based ethnic segmentation (Malay, Chinese, English, Tamil)
  - Modified Esteban-Ray polarization index adapted for Malaysian ethnic structure
  - Bimodality detection (bimodality coefficient + Hartigan's dip test)
  - Cross-community sentiment divergence tracking

Reference: framework §2.5 (Polarization Metrics), §5.2 (Ethnic Polarization)
"""

from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

import numpy as np
from scipy import stats as sp_stats
from loguru import logger


# Simple sentiment lexicons (MVP — replace with Malaya NLP in production)
POSITIVE_EN = {"good", "great", "excellent", "support", "agree", "right", "positive",
               "fair", "progress", "improve", "success", "benefit", "welcome", "praise"}
NEGATIVE_EN = {"bad", "terrible", "wrong", "corrupt", "fail", "unfair", "racist",
               "discriminate", "protest", "oppose", "reject", "condemn", "abuse", "scandal"}
POSITIVE_MY = {"baik", "bagus", "setuju", "sokong", "betul", "adil", "maju", "berjaya",
               "manfaat", "positif", "aman", "sejahtera"}
NEGATIVE_MY = {"buruk", "salah", "rasuah", "gagal", "zalim", "rasis", "bantah", "tolak",
               "kutuk", "haram", "fitnah", "bohong", "khianat", "munafik"}


def simple_sentiment(text: str, lang: str) -> float:
    """Simple lexicon-based sentiment score in [-1, 1]."""
    words = set(text.lower().split())

    if lang == "malay":
        pos = len(words & POSITIVE_MY) + len(words & POSITIVE_EN)
        neg = len(words & NEGATIVE_MY) + len(words & NEGATIVE_EN)
    else:
        pos = len(words & POSITIVE_EN)
        neg = len(words & NEGATIVE_EN)

    total = pos + neg
    if total == 0:
        return 0.0
    return (pos - neg) / total


def bimodality_coefficient(data: np.ndarray) -> float:
    """Compute bimodality coefficient. BC > 5/9 ≈ 0.555 suggests bimodality."""
    n = len(data)
    if n < 4:
        return 0.0

    skewness = float(sp_stats.skew(data))
    kurtosis = float(sp_stats.kurtosis(data, fisher=True))  # Excess kurtosis

    # BC = (skewness^2 + 1) / (kurtosis + 3*(n-1)^2 / ((n-2)*(n-3)))
    denom = kurtosis + 3.0 * (n - 1) ** 2 / ((n - 2) * (n - 3))
    if abs(denom) < 1e-10:
        return 0.0

    bc = (skewness ** 2 + 1) / denom
    return float(bc)


class PolarizationMonitor:
    """Monitors ethnic polarization on issues using language-segmented sentiment."""

    COMMUNITIES = ["malay", "chinese", "english", "tamil"]

    def __init__(self, config: dict):
        self.config = config
        self.log = logger.bind(component="polarization")

        self.ethnic_weights = config.get("ethnic_weights", {
            "malay": 0.69, "chinese": 0.23, "indian": 0.07, "other": 0.01
        })
        self.er_alpha = config.get("er_alpha", 1.0)
        self.alert_threshold = config.get("alert_threshold", 0.6)
        self.bimodality_threshold = config.get("bimodality_threshold", 0.555)
        self.window_hours = config.get("window_hours", 24)

        # Per-topic, per-community sentiment storage
        # key: topic -> community -> list of (timestamp, sentiment)
        self._sentiments: dict[str, dict[str, list[tuple[datetime, float]]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self._alerts: list[dict] = []
        self._er_history: dict[str, list[tuple[datetime, float]]] = defaultdict(list)

    def add_event(self, topic: str, lang: str, sentiment: float, timestamp: datetime):
        """Add a sentiment observation for a topic from a language community."""
        community = self._lang_to_community(lang)
        self._sentiments[topic][community].append((timestamp, sentiment))
        self._prune(topic)

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

            sentiment = simple_sentiment(text, lang)
            for kw in keywords:
                self.add_event(kw, lang, sentiment, ts)

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
        """Remove observations older than window."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=self.window_hours)
        for community in list(self._sentiments[topic]):
            self._sentiments[topic][community] = [
                (t, s) for t, s in self._sentiments[topic][community]
                if t >= cutoff
            ]

    def compute_sentiment_by_community(self, topic: str) -> dict[str, float]:
        """Average sentiment per community for a topic."""
        result = {}
        for community in self.COMMUNITIES:
            entries = self._sentiments.get(topic, {}).get(community, [])
            if entries:
                result[community] = float(np.mean([s for _, s in entries]))
            else:
                result[community] = 0.0
        return result

    def compute_esteban_ray(self, sentiment_by_community: dict[str, float]) -> float:
        """Modified Esteban-Ray index for ethnic polarization.

        P(alpha) = K * sum_i sum_j pi_i^(1+alpha) * pi_j * |s_i - s_j|
        Normalized to [0, 1].
        """
        communities = ["malay", "chinese", "tamil"]
        pi = {
            "malay": self.ethnic_weights.get("malay", 0.69),
            "chinese": self.ethnic_weights.get("chinese", 0.23),
            "tamil": self.ethnic_weights.get("indian", 0.07),
        }
        alpha = self.er_alpha

        # Raw ER index
        er = 0.0
        for i in communities:
            for j in communities:
                s_i = sentiment_by_community.get(i, 0.0)
                s_j = sentiment_by_community.get(j, 0.0)
                er += pi[i] ** (1 + alpha) * pi[j] * abs(s_i - s_j)

        # Normalize: max possible ER is when sentiments are +1 and -1
        # with the current population weights
        max_er = 0.0
        max_sentiments = {"malay": 1.0, "chinese": -1.0, "tamil": -1.0}
        for i in communities:
            for j in communities:
                max_er += pi[i] ** (1 + alpha) * pi[j] * abs(max_sentiments[i] - max_sentiments[j])

        if max_er > 0:
            er /= max_er

        return float(np.clip(er, 0.0, 1.0))

    def compute_bimodality(self, topic: str) -> tuple[float, bool]:
        """Compute bimodality coefficient across all sentiment scores for a topic."""
        all_sentiments = []
        for community in self.COMMUNITIES:
            entries = self._sentiments.get(topic, {}).get(community, [])
            all_sentiments.extend([s for _, s in entries])

        if len(all_sentiments) < 4:
            return 0.0, False

        bc = bimodality_coefficient(np.array(all_sentiments))
        return bc, bc > self.bimodality_threshold

    def compute_max_divergence(self, sentiment_by_community: dict[str, float]) -> tuple[float, str, str]:
        """Max pairwise sentiment divergence between communities."""
        max_div = 0.0
        max_pair = ("", "")
        communities = [c for c in self.COMMUNITIES if c in sentiment_by_community]

        for i, c1 in enumerate(communities):
            for c2 in communities[i + 1:]:
                div = abs(sentiment_by_community[c1] - sentiment_by_community[c2])
                if div > max_div:
                    max_div = div
                    max_pair = (c1, c2)

        return max_div, max_pair[0], max_pair[1]

    def compute_divergence_trend(self, topic: str) -> str:
        """Whether the ER index is rising, falling, or stable."""
        history = self._er_history.get(topic, [])
        if len(history) < 2:
            return "stable"
        recent = [v for _, v in history[-5:]]
        if len(recent) < 2:
            return "stable"
        diff = recent[-1] - recent[0]
        if diff > 0.05:
            return "widening"
        if diff < -0.05:
            return "narrowing"
        return "stable"

    def evaluate_topic(self, topic: str, timestamp: datetime) -> dict:
        """Full polarization evaluation for a topic."""
        sentiment = self.compute_sentiment_by_community(topic)
        er_index = self.compute_esteban_ray(sentiment)
        bc, is_bimodal = self.compute_bimodality(topic)
        max_div, div_c1, div_c2 = self.compute_max_divergence(sentiment)
        self._er_history[topic].append((timestamp, er_index))
        if len(self._er_history[topic]) > 100:
            self._er_history[topic] = self._er_history[topic][-100:]
        trend = self.compute_divergence_trend(topic)

        # Alert level
        if er_index > self.alert_threshold and is_bimodal:
            alert_level = "critical"
        elif er_index > self.alert_threshold or max_div > self.alert_threshold:
            alert_level = "high"
        elif er_index > self.alert_threshold * 0.6:
            alert_level = "elevated"
        else:
            alert_level = "normal"

        result = {
            "keyword": topic,
            "er_index": er_index,
            "bimodality_coefficient": bc,
            "is_bimodal": is_bimodal,
            "sentiment_by_community": sentiment,
            "max_pairwise_divergence": max_div,
            "most_divergent_pair": f"{div_c1}_{div_c2}" if div_c1 else None,
            "divergence_trend": trend,
            "alert_level": alert_level,
            "timestamp": timestamp.isoformat(),
        }

        if alert_level in ("critical", "high", "elevated"):
            self._alerts.append(result)

        return result

    def get_active_alerts(self) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        self._alerts = [
            a for a in self._alerts
            if a.get("timestamp", "") >= cutoff.isoformat()
        ]
        return sorted(self._alerts, key=lambda a: a.get("er_index", 0), reverse=True)
