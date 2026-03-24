"""Stream 6: Silence Detector — Detects important stories nobody is covering.

Identifies structurally significant institutional events (parliamentary bills,
court rulings, gazette notifications, fatwas) that receive unexpectedly LOW
media and social coverage. This is the inverse of the other 5 streams:
instead of detecting what's loud, it detects what's suspiciously quiet.

Suppression patterns:
  HIDDEN_STORY     — zero news AND zero social media
  MEDIA_BLACKOUT   — zero news BUT social media exists
  PUBLIC_BLIND_SPOT — news exists BUT zero social media
  DELAYED_FUSE     — silent 24h+ then rising

Reference: framework §6.1 (Detection Engine architecture), extended with
omission detection for the Malaysian institutional context.
"""

import json
import re
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import numpy as np
from loguru import logger


# TFA bias dimensions
TFA_DIMENSIONS = {
    "ethnic", "religious", "political", "economic", "legal",
    "gender", "urban_rural", "generational", "class", "environmental",
    "institutional", "cultural",
}

# Keywords mapping institutional events to TFA dimensions
DIMENSION_KEYWORDS = {
    "ethnic": {"malay", "melayu", "chinese", "cina", "indian", "india", "bumiputera",
               "race", "kaum", "bangsa", "vernacular", "hak istimewa", "special rights",
               "discrimination", "diskriminasi", "quota"},
    "religious": {"islam", "fatwa", "halal", "haram", "syariah", "sharia", "mosque",
                  "masjid", "church", "temple", "allah", "jakim", "jais", "mufti",
                  "apostasy", "murtad", "conversion", "interfaith"},
    "political": {"parliament", "parlimen", "cabinet", "election", "pilihanraya",
                  "amendment", "pindaan", "bill", "rang undang", "motion", "usul",
                  "opposition", "pembangkang", "government", "kerajaan"},
    "economic": {"budget", "belanjawan", "subsidy", "subsidi", "tax", "cukai",
                 "gst", "sst", "trade", "tariff", "privatization", "procurement",
                 "epf", "kwsp", "minimum wage"},
    "legal": {"court", "mahkamah", "judicial", "appeal", "rayuan", "federal court",
              "verdict", "sentence", "hukuman", "acquittal", "conviction", "bail",
              "habeas corpus", "review", "constitutional"},
    "environmental": {"environment", "alam sekitar", "pollution", "pencemaran",
                      "deforestation", "mining", "dam", "pipeline", "climate"},
    "institutional": {"macc", "sprm", "audit", "accountability", "governance",
                      "transparency", "procurement", "appointment", "pelantikan"},
}

# Event type importance baselines
EVENT_TYPE_IMPORTANCE = {
    # Constitutional / legislative
    "constitutional_amendment": {"population_impact": 1.0, "legal_significance": 1.0, "precedent_status": 0.9},
    "new_act": {"population_impact": 0.8, "legal_significance": 0.85, "precedent_status": 0.8},
    "bill_reading": {"population_impact": 0.7, "legal_significance": 0.7, "precedent_status": 0.5},
    "amendment_act": {"population_impact": 0.6, "legal_significance": 0.7, "precedent_status": 0.4},
    "statutory_instrument": {"population_impact": 0.4, "legal_significance": 0.5, "precedent_status": 0.2},
    # Court
    "federal_court_ruling": {"population_impact": 0.8, "legal_significance": 0.85, "precedent_status": 0.8},
    "court_of_appeal_ruling": {"population_impact": 0.6, "legal_significance": 0.7, "precedent_status": 0.6},
    "high_court_ruling": {"population_impact": 0.5, "legal_significance": 0.5, "precedent_status": 0.4},
    # Government
    "national_policy": {"population_impact": 0.8, "legal_significance": 0.5, "precedent_status": 0.5},
    "sector_policy": {"population_impact": 0.5, "legal_significance": 0.3, "precedent_status": 0.3},
    "budget_allocation": {"population_impact": 0.7, "legal_significance": 0.3, "precedent_status": 0.2},
    "government_appointment": {"population_impact": 0.4, "legal_significance": 0.2, "precedent_status": 0.3},
    # Religious
    "fatwa": {"population_impact": 0.6, "legal_significance": 0.7, "precedent_status": 0.7},
    "gazette_fatwa": {"population_impact": 0.7, "legal_significance": 0.8, "precedent_status": 0.8},
    # Administrative
    "gazette_routine": {"population_impact": 0.2, "legal_significance": 0.2, "precedent_status": 0.1},
    "administrative_order": {"population_impact": 0.2, "legal_significance": 0.2, "precedent_status": 0.1},
}


def _extract_fiscal_magnitude(text: str) -> float:
    """Extract RM amounts from text and score fiscal magnitude."""
    text_lower = text.lower()
    # Match patterns like "RM1.2 billion", "RM500 million", "RM 2.5 bil"
    patterns = [
        (r'rm\s*(\d+(?:\.\d+)?)\s*(?:billion|bil)', 1_000_000_000),
        (r'rm\s*(\d+(?:\.\d+)?)\s*(?:million|mil|juta)', 1_000_000),
        (r'rm\s*(\d+(?:,\d+)*(?:\.\d+)?)', 1),  # Raw RM amounts
    ]
    max_amount = 0.0
    for pattern, multiplier in patterns:
        for match in re.finditer(pattern, text_lower):
            try:
                val = float(match.group(1).replace(",", ""))
                max_amount = max(max_amount, val * multiplier)
            except (ValueError, IndexError):
                continue

    if max_amount >= 1_000_000_000:
        return 1.0
    elif max_amount >= 100_000_000:
        return 0.7 + 0.3 * (max_amount - 100_000_000) / 900_000_000
    elif max_amount >= 10_000_000:
        return 0.4 + 0.3 * (max_amount - 10_000_000) / 90_000_000
    elif max_amount >= 1_000_000:
        return 0.2 + 0.2 * (max_amount - 1_000_000) / 9_000_000
    elif max_amount > 0:
        return 0.1
    return 0.0


def _detect_dimensions(text: str) -> set[str]:
    """Detect which TFA bias dimensions an event touches."""
    text_lower = text.lower()
    dims = set()
    for dim, keywords in DIMENSION_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            dims.add(dim)
    return dims


class InstitutionalEvent:
    """Represents a structural institutional event to monitor for coverage."""

    def __init__(
        self,
        event_id: str,
        event_type: str,
        title: str,
        description: str,
        source_institution: str,
        date: datetime,
        fiscal_text: str = "",
    ):
        self.event_id = event_id
        self.event_type = event_type
        self.title = str(title) if title else ""
        self.description = str(description) if description else ""
        self.source_institution = source_institution
        self.date = date
        self.fiscal_text = fiscal_text or f"{title} {description}"

        # Coverage tracking
        self.news_mentions = 0
        self.social_mentions = 0
        self.first_news_time: datetime | None = None
        self.first_social_time: datetime | None = None

        # Computed scores
        self._importance: float | None = None
        self._dimensions: set[str] | None = None

    @property
    def dimensions(self) -> set[str]:
        if self._dimensions is None:
            self._dimensions = _detect_dimensions(f"{self.title} {self.description}")
        return self._dimensions

    @property
    def dimension_sensitivity(self) -> float:
        n = len(self.dimensions)
        if n >= 4:
            return 1.0
        elif n == 3:
            return 0.7
        elif n == 2:
            return 0.5
        elif n == 1:
            return 0.3
        return 0.1

    def compute_structural_importance(self) -> float:
        """Composite importance score from 5 factors, each [0, 1]."""
        if self._importance is not None:
            return self._importance

        # Base scores from event type
        base = EVENT_TYPE_IMPORTANCE.get(
            self.event_type,
            {"population_impact": 0.3, "legal_significance": 0.3, "precedent_status": 0.2},
        )
        population_impact = base.get("population_impact", 0.3)
        legal_significance = base.get("legal_significance", 0.3)
        precedent_status = base.get("precedent_status", 0.2)
        fiscal_magnitude = _extract_fiscal_magnitude(self.fiscal_text)
        dim_sensitivity = self.dimension_sensitivity

        self._importance = (
            0.25 * population_impact
            + 0.20 * legal_significance
            + 0.15 * fiscal_magnitude
            + 0.15 * precedent_status
            + 0.25 * dim_sensitivity
        )
        return self._importance

    @property
    def expected_mentions(self) -> float:
        """Expected mentions in 24h based on structural importance."""
        imp = self.compute_structural_importance()
        if imp >= 0.8:
            return 5000.0
        elif imp >= 0.6:
            return 1000.0 + (imp - 0.6) / 0.2 * 4000.0
        elif imp >= 0.4:
            return 200.0 + (imp - 0.4) / 0.2 * 800.0
        return 50.0 + imp / 0.4 * 150.0

    @property
    def actual_mentions(self) -> int:
        return self.news_mentions + self.social_mentions

    @property
    def silence_score(self) -> float:
        """How silent is this event relative to expectations? [0, 1]."""
        expected = self.expected_mentions
        if expected <= 0:
            return 0.0
        return max(0.0, min(1.0, 1.0 - self.actual_mentions / expected))

    @property
    def suppression_pattern(self) -> str:
        """Classify the type of silence/suppression."""
        hours_since = (datetime.now(timezone.utc) - self.date).total_seconds() / 3600

        if self.news_mentions == 0 and self.social_mentions == 0:
            return "HIDDEN_STORY"
        elif self.news_mentions == 0 and self.social_mentions > 0:
            return "MEDIA_BLACKOUT"
        elif self.news_mentions > 0 and self.social_mentions == 0:
            return "PUBLIC_BLIND_SPOT"
        elif hours_since > 24 and self.actual_mentions > 0:
            # Had silence initially but now has coverage
            if self.first_news_time and (self.first_news_time - self.date).total_seconds() > 86400:
                return "DELAYED_FUSE"
            if self.first_social_time and (self.first_social_time - self.date).total_seconds() > 86400:
                return "DELAYED_FUSE"
        return "NORMAL"

    def record_mention(self, platform: str, timestamp: datetime):
        """Record a mention from news or social media."""
        if platform in ("news", "gdelt"):
            self.news_mentions += 1
            if self.first_news_time is None:
                self.first_news_time = timestamp
        else:
            self.social_mentions += 1
            if self.first_social_time is None:
                self.first_social_time = timestamp

    def to_alert(self, timestamp: datetime) -> dict:
        """Generate alert dict for fusion layer."""
        importance = self.compute_structural_importance()
        silence = self.silence_score
        pattern = self.suppression_pattern

        if silence > 0.8 and importance > 0.7:
            alert_level = "critical"
        elif silence > 0.6 and importance > 0.5:
            alert_level = "high"
        elif silence > 0.4 and importance > 0.4:
            alert_level = "medium"
        else:
            alert_level = "low"

        return {
            "event_id": self.event_id,
            "keyword": self.title.lower().split()[0] if self.title else self.event_id,
            "title": self.title,
            "structural_importance": round(importance, 4),
            "silence_score": round(silence, 4),
            "suppression_pattern": pattern,
            "news_mentions": self.news_mentions,
            "social_mentions": self.social_mentions,
            "expected_mentions": round(self.expected_mentions, 0),
            "bias_dimensions_touched": sorted(self.dimensions),
            "alert_level": alert_level,
            "detection_type": "silence_anomaly",
            "timestamp": timestamp.isoformat(),
        }


class SilenceDetector:
    """Stream 6: Detects structurally important events with unexpectedly low coverage."""

    def __init__(self, config: dict):
        self.config = config
        self.log = logger.bind(component="silence_detector")

        self.importance_threshold = config.get("importance_threshold", 0.4)
        self.silence_threshold = config.get("silence_threshold", 0.6)

        # Tracked institutional events
        self._events: dict[str, InstitutionalEvent] = {}
        self._alerts: list[dict] = []
        self._event_counter = 0

    def add_institutional_event(
        self,
        event_type: str,
        title: str,
        description: str = "",
        source_institution: str = "unknown",
        date: datetime | None = None,
        fiscal_text: str = "",
    ) -> str:
        """Register an institutional event to monitor for coverage."""
        self._event_counter += 1
        event_id = f"INST-{self._event_counter:04d}"
        date = date or datetime.now(timezone.utc)

        event = InstitutionalEvent(
            event_id=event_id,
            event_type=event_type,
            title=title,
            description=description,
            source_institution=source_institution,
            date=date,
            fiscal_text=fiscal_text,
        )
        self._events[event_id] = event
        self.log.info(
            f"Tracking: {event_id} [{event_type}] \"{title}\" "
            f"importance={event.compute_structural_importance():.2f}"
        )
        return event_id

    def load_watchlist_from_calendar(self, calendar: dict):
        """Pre-populate institutional events from malaysia-calendar.json."""
        now = datetime.now(timezone.utc)

        # Parliamentary sessions as events to watch
        for session_name, dates in calendar.get("parliamentary_sessions_2026", {}).items():
            start = dates.get("start", "")
            if start:
                try:
                    d = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    if d >= now - timedelta(days=7):  # Only upcoming/recent
                        self.add_institutional_event(
                            event_type="bill_reading",
                            title=f"Parliament {session_name.replace('_', ' ')} session opens",
                            description="Parliamentary session opening — bills and motions expected",
                            source_institution="Parliament",
                            date=d,
                        )
                except ValueError:
                    pass

        # Budget presentation
        budget_date = calendar.get("budget_presentation", "")
        if budget_date:
            try:
                d = datetime.strptime(budget_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if d >= now - timedelta(days=7):
                    self.add_institutional_event(
                        event_type="budget_allocation",
                        title="Budget 2027 presentation",
                        description="Annual national budget presentation to Parliament",
                        source_institution="Ministry of Finance",
                        date=d,
                        fiscal_text="National budget allocation RM300 billion total expenditure",
                    )
            except ValueError:
                pass

        # Sensitivity dates
        for name, date_str in calendar.get("historical_sensitivity_dates", {}).items():
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if abs((d - now).days) <= 14:  # Within 2 weeks
                    self.add_institutional_event(
                        event_type="national_policy",
                        title=name.replace("_", " ").title(),
                        description=f"Historically sensitive date: {name}",
                        source_institution="National",
                        date=d,
                    )
            except ValueError:
                pass

        # Court sessions
        for term in calendar.get("court_sessions_2026", {}).get("federal_court_terms", []):
            start = term.get("start", "")
            try:
                d = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if abs((d - now).days) <= 7:
                    self.add_institutional_event(
                        event_type="federal_court_ruling",
                        title=f"Federal Court term begins {start}",
                        description="New Federal Court term — pending cases may be decided",
                        source_institution="Federal Court",
                        date=d,
                    )
            except ValueError:
                pass

    def process(self, events: list[dict[str, Any]]):
        """Match incoming media/social events against tracked institutional events."""
        for event in events:
            text = event.get("text", "").lower()
            platform = event.get("platform", "unknown")
            timestamp_str = event.get("timestamp", "")

            try:
                if isinstance(timestamp_str, str):
                    ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                else:
                    ts = timestamp_str
            except (ValueError, TypeError):
                ts = datetime.now(timezone.utc)

            # Check each tracked event for keyword overlap
            for inst_event in self._events.values():
                # Simple keyword matching against event title words
                title_words = set(inst_event.title.lower().split())
                desc_words = set(inst_event.description.lower().split())
                match_words = (title_words | desc_words) - {
                    "the", "a", "an", "of", "and", "or", "to", "in", "for", "is",
                    "yang", "dan", "di", "ke", "dari", "pada",
                }
                # Require at least 2 significant word matches
                significant_matches = sum(1 for w in match_words if len(w) > 3 and w in text)
                if significant_matches >= 2:
                    inst_event.record_mention(platform, ts)

    def evaluate_all(self, timestamp: datetime) -> list[dict]:
        """Evaluate all tracked events and generate silence alerts."""
        results = []
        for event in self._events.values():
            importance = event.compute_structural_importance()
            if importance < self.importance_threshold:
                continue

            alert = event.to_alert(timestamp)
            results.append(alert)

            if alert["alert_level"] in ("critical", "high", "medium"):
                self._alerts.append(alert)

        return results

    def get_active_alerts(self) -> list[dict]:
        """Return active silence alerts sorted by silence_score descending."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        self._alerts = [
            a for a in self._alerts
            if a.get("timestamp", "") >= cutoff.isoformat()
        ]
        return sorted(
            self._alerts,
            key=lambda a: a.get("silence_score", 0) * a.get("structural_importance", 0),
            reverse=True,
        )

    def get_event(self, event_id: str) -> InstitutionalEvent | None:
        return self._events.get(event_id)

    def get_state(self) -> dict:
        return {
            "events": {
                eid: {
                    "event_type": e.event_type,
                    "title": e.title,
                    "description": e.description,
                    "source_institution": e.source_institution,
                    "date": e.date.isoformat(),
                    "news_mentions": e.news_mentions,
                    "social_mentions": e.social_mentions,
                    "importance": e.compute_structural_importance(),
                    "silence_score": e.silence_score,
                }
                for eid, e in self._events.items()
            },
            "event_counter": self._event_counter,
        }
