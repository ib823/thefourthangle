"""Parliament & Gazette connector — monitors legislative/regulatory activity.

Primary: Scrape parlimen.gov.my for order papers, bill listings, Hansard.
Fallback: Filter news RSS for parliamentary keywords (parlimen.gov.my is
unreachable from most cloud environments due to geo/firewall restrictions).

Also monitors AG Chambers (agc.gov.my) for new legislation/gazette notices.
"""

import re
from datetime import datetime, timezone
from typing import Any

import feedparser
import requests

from .base_connector import BaseConnector


# Keywords that indicate parliamentary/legislative institutional events
PARLIAMENT_KEYWORDS = {
    "parliament", "parlimen", "dewan rakyat", "dewan negara",
    "bill", "rang undang", "rang undang-undang",
    "tabled", "dibentang", "reading", "bacaan",
    "hansard", "order paper", "atur mesyuarat",
    "amendment", "pindaan", "act", "akta",
    "passed", "lulus", "gazetted", "diwartakan",
    "statutory", "gazette", "warta",
    "committee", "jawatankuasa", "select committee",
    "motion", "usul", "ministerial statement",
}

# Keywords for gazette/regulatory events
GAZETTE_KEYWORDS = {
    "gazette", "warta", "gazetted", "diwartakan",
    "regulation", "peraturan", "statutory instrument",
    "proclamation", "perisytiharan",
    "order", "perintah", "notification", "pemberitahuan",
    "ag chambers", "attorney general", "peguam negara",
}


def _classify_event_type(text: str) -> str:
    """Classify the institutional event type from text content."""
    t = text.lower()
    if any(kw in t for kw in ("constitutional amendment", "pindaan perlembagaan", "article 153",
                               "article 10", "article 11", "article 121")):
        return "constitutional_amendment"
    if any(kw in t for kw in ("new act", "akta baru", "new legislation", "passed into law", "lulus")):
        return "new_act"
    if any(kw in t for kw in ("bill", "rang undang", "first reading", "second reading",
                               "third reading", "bacaan pertama", "bacaan kedua")):
        return "bill_reading"
    if any(kw in t for kw in ("amendment", "pindaan", "amend")):
        return "amendment_act"
    if any(kw in t for kw in ("gazette", "warta", "gazetted", "statutory")):
        return "statutory_instrument"
    if any(kw in t for kw in ("fatwa",)):
        return "gazette_fatwa"
    if any(kw in t for kw in ("national policy", "dasar negara", "policy reform")):
        return "national_policy"
    if any(kw in t for kw in ("budget", "belanjawan", "allocation", "peruntukan")):
        return "budget_allocation"
    if any(kw in t for kw in ("appointment", "pelantikan")):
        return "government_appointment"
    return "bill_reading"  # Default for parliamentary items


class ParliamentConnector(BaseConnector):
    """Monitors parliamentary and gazette activity via news keyword filtering.

    Tries parlimen.gov.my first; falls back to filtering existing news RSS
    feeds for parliamentary/legislative keywords.
    """

    def __init__(self, config: dict):
        super().__init__("parliament", config)
        self.news_feeds = config.get("news_feeds", [
            {"name": "FMT", "url": "https://www.freemalaysiatoday.com/feed/", "language": "english"},
            {"name": "Malay Mail", "url": "https://www.malaymail.com/feed/rss/malaysia", "language": "english"},
            {"name": "The Star", "url": "https://www.thestar.com.my/rss/News", "language": "english"},
        ])
        self.parlimen_url = config.get("parlimen_url", "https://www.parlimen.gov.my/")
        self.agc_url = config.get("agc_url", "https://www.agc.gov.my/")
        self._seen_urls: set[str] = set()

    def fetch(self) -> list[dict[str, Any]]:
        events = []

        # Try direct parliament scrape (usually fails from cloud)
        events.extend(self._try_parlimen_scrape())

        # Fallback: filter news RSS for parliamentary keywords
        events.extend(self._filter_news_rss())

        return events

    def _try_parlimen_scrape(self) -> list[dict[str, Any]]:
        """Attempt direct scrape of parlimen.gov.my. Returns [] if unreachable."""
        try:
            resp = requests.get(self.parlimen_url, timeout=5,
                                headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                return []

            # Look for bill/order paper links in HTML
            events = []
            # Simple regex for links containing bill/order keywords
            links = re.findall(r'href="([^"]*(?:bill|rang-undang|atur-mesyuarat|hansard)[^"]*)"',
                               resp.text, re.IGNORECASE)
            for link in links[:20]:
                if link in self._seen_urls:
                    continue
                self._seen_urls.add(link)
                url = link if link.startswith("http") else f"{self.parlimen_url.rstrip('/')}/{link.lstrip('/')}"
                events.append(self.make_event(
                    timestamp=datetime.now(timezone.utc),
                    text=f"Parliamentary document: {link.split('/')[-1]}",
                    lang="malay",
                    platform="parliament",
                    source_name="parlimen.gov.my",
                    url=url,
                    event_type=_classify_event_type(link),
                    source_institution="Parliament",
                ))

            if events:
                self.log.info(f"Scraped {len(events)} items from parlimen.gov.my")
            return events

        except Exception:
            # Expected to fail from cloud — silent fallback
            return []

    def _filter_news_rss(self) -> list[dict[str, Any]]:
        """Filter news RSS feeds for parliamentary/gazette keywords."""
        events = []
        all_keywords = PARLIAMENT_KEYWORDS | GAZETTE_KEYWORDS

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

                # Check if this article is about parliamentary/gazette activity
                matched_keywords = [kw for kw in all_keywords if kw in text_lower]
                if not matched_keywords:
                    continue

                self._seen_urls.add(link)
                event_type = _classify_event_type(text)

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

                events.append(self.make_event(
                    timestamp=timestamp,
                    text=text,
                    lang=lang,
                    platform="parliament",
                    source_name=f"{name} (parliamentary)",
                    url=link,
                    event_type=event_type,
                    source_institution="Parliament" if any(
                        kw in text_lower for kw in PARLIAMENT_KEYWORDS
                    ) else "AG Chambers",
                    matched_keywords=matched_keywords,
                ))

        return events
