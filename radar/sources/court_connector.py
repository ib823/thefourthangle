"""Court connector — monitors judicial activity and high-profile cases.

Primary: Scrape efiling.kehakiman.gov.my for case listings.
Fallback: Filter news RSS for court/trial keywords with focus on
high-profile Malaysian cases.
"""

import re
from datetime import datetime, timezone
from typing import Any

import feedparser
import requests

from .base_connector import BaseConnector


# Court-related keywords
COURT_KEYWORDS = {
    "mahkamah", "court", "trial", "perbicaraan",
    "verdict", "keputusan", "sentence", "hukuman",
    "appeal", "rayuan", "acquit", "dibebaskan",
    "conviction", "sabitan", "bail", "jaminan",
    "judicial review", "semakan kehakiman",
    "federal court", "mahkamah persekutuan",
    "court of appeal", "mahkamah rayuan",
    "high court", "mahkamah tinggi",
    "habeas corpus", "injunction", "injunksi",
    "constitutional challenge", "cabaran perlembagaan",
}

# High-profile cases/persons to specifically monitor
HIGH_PROFILE = {
    "1mdb", "najib", "rosmah", "zahid",
    "azam baki", "macc", "sprm",
    "ltte", "sosma",
    "article 153", "article 10", "article 11",
    "sedition", "hasutan",
    "undi18", "anti-hopping",
}


def _classify_court_level(text: str) -> str:
    """Determine court level from text."""
    t = text.lower()
    if any(kw in t for kw in ("federal court", "mahkamah persekutuan")):
        return "federal_court"
    if any(kw in t for kw in ("court of appeal", "mahkamah rayuan")):
        return "court_of_appeal"
    if any(kw in t for kw in ("high court", "mahkamah tinggi")):
        return "high_court"
    if any(kw in t for kw in ("sessions court", "mahkamah sesyen")):
        return "sessions_court"
    if any(kw in t for kw in ("syariah", "shariah")):
        return "syariah_court"
    return "unknown"


def _classify_event_type(text: str, court_level: str) -> str:
    """Map court activity to silence detector event types."""
    if court_level == "federal_court":
        return "federal_court_ruling"
    if court_level == "court_of_appeal":
        return "court_of_appeal_ruling"
    return "high_court_ruling"


class CourtConnector(BaseConnector):
    """Monitors court activity via news keyword filtering.

    Tries efiling.kehakiman.gov.my first; falls back to filtering news RSS
    for court/judicial keywords with special focus on high-profile cases.
    """

    def __init__(self, config: dict):
        super().__init__("court", config)
        self.news_feeds = config.get("news_feeds", [
            {"name": "FMT", "url": "https://www.freemalaysiatoday.com/feed/", "language": "english"},
            {"name": "Malay Mail", "url": "https://www.malaymail.com/feed/rss/malaysia", "language": "english"},
            {"name": "The Star", "url": "https://www.thestar.com.my/rss/News", "language": "english"},
        ])
        self.efiling_url = config.get("efiling_url", "https://efiling.kehakiman.gov.my/")
        self._seen_urls: set[str] = set()

    def fetch(self) -> list[dict[str, Any]]:
        events = []
        events.extend(self._try_efiling_scrape())
        events.extend(self._filter_news_rss())
        return events

    def _try_efiling_scrape(self) -> list[dict[str, Any]]:
        """Attempt direct scrape of eFiling. Returns [] if unreachable."""
        try:
            resp = requests.get(self.efiling_url, timeout=5,
                                headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                return []

            # Look for case listing data in HTML
            events = []
            # Simple search for case references (e.g., "05-123-2026")
            case_refs = re.findall(
                r'(\d{2}-\d{2,6}-\d{4})',
                resp.text
            )
            for ref in set(list(case_refs)[:10]):
                events.append(self.make_event(
                    timestamp=datetime.now(timezone.utc),
                    text=f"Court case listing: {ref}",
                    lang="english",
                    platform="court",
                    source_name="efiling.kehakiman.gov.my",
                    case_ref=ref,
                    event_type="high_court_ruling",
                    court_level="unknown",
                    source_institution="Judiciary",
                ))

            if events:
                self.log.info(f"Scraped {len(events)} cases from eFiling")
            return events

        except Exception:
            return []

    def _filter_news_rss(self) -> list[dict[str, Any]]:
        """Filter news RSS for court/judicial keywords."""
        events = []
        all_keywords = COURT_KEYWORDS | HIGH_PROFILE

        for feed_cfg in self.news_feeds:
            name = feed_cfg["name"]
            url = feed_cfg["url"]
            lang = feed_cfg.get("language", "english")

            try:
                parsed = feedparser.parse(url)
            except Exception as e:
                self.log.warning(f"Failed to parse {name}: {e}")
                continue

            for entry in parsed.entries:
                link = entry.get("link", "")
                if link in self._seen_urls:
                    continue

                title = entry.get("title", "")
                summary = entry.get("summary", entry.get("description", ""))
                text = f"{title}. {summary}"
                text_lower = text.lower()

                # Check for court keywords
                matched_keywords = [kw for kw in all_keywords if kw in text_lower]
                if not matched_keywords:
                    continue

                self._seen_urls.add(link)
                court_level = _classify_court_level(text)
                event_type = _classify_event_type(text, court_level)

                # Check if high-profile
                is_high_profile = any(hp in text_lower for hp in HIGH_PROFILE)

                # Parse timestamp
                timestamp = datetime.now(timezone.utc)
                if entry.get("published"):
                    try:
                        from email.utils import parsedate_to_datetime
                        timestamp = parsedate_to_datetime(entry.published)
                        if timestamp.tzinfo is None:
                            timestamp = timestamp.replace(tzinfo=timezone.utc)
                    except (ValueError, TypeError):
                        pass

                # Extract case name if possible
                case_name = title
                for hp in HIGH_PROFILE:
                    if hp in text_lower:
                        case_name = f"{hp.upper()} — {title}"
                        break

                events.append(self.make_event(
                    timestamp=timestamp,
                    text=text,
                    lang=lang,
                    platform="court",
                    source_name=f"{name} (court)",
                    url=link,
                    event_type=event_type,
                    court_level=court_level,
                    case_name=case_name,
                    is_high_profile=is_high_profile,
                    matched_keywords=matched_keywords,
                    source_institution="Judiciary",
                ))

        return events
