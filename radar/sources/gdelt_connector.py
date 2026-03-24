"""GDELT DOC API connector for Malaysia-related events."""

import os
from datetime import datetime, timezone
from typing import Any

import requests

from .base_connector import BaseConnector


class GDELTConnector(BaseConnector):
    """Queries GDELT DOC API for Malaysia-related events and tone data."""

    def __init__(self, config: dict):
        super().__init__("gdelt", config)
        self.api_url = os.environ.get(
            "GDELT_API_URL", "https://api.gdeltproject.org/api/v2/doc/doc"
        )
        self.country_filter = config.get("country_filter", "MY")

    def fetch(self) -> list[dict[str, Any]]:
        """Query GDELT for recent Malaysia-related articles."""
        events = []

        params = {
            "query": f"sourcecountry:{self.country_filter}",
            "mode": "ArtList",
            "maxrecords": 250,
            "format": "json",
            "sort": "DateDesc",
            "timespan": "60min",
        }

        try:
            resp = requests.get(self.api_url, params=params, timeout=15)
            if resp.status_code == 429:
                self.log.warning("GDELT rate limited (429) — skipping this cycle")
                return []
            resp.raise_for_status()
            # GDELT sometimes returns empty or non-JSON on errors
            text = resp.text.strip()
            if not text or text[0] != '{':
                self.log.warning(f"GDELT returned non-JSON: {text[:100]}")
                return []
            data = resp.json()
        except requests.RequestException as e:
            self.log.warning(f"GDELT API request failed: {e}")
            return []
        except ValueError as e:
            self.log.warning(f"GDELT returned invalid JSON: {e}")
            return []

        articles = data.get("articles", [])

        for art in articles:
            # Parse GDELT date format (YYYYMMDDHHMMSS)
            date_str = art.get("seendate", "")
            try:
                timestamp = datetime.strptime(date_str, "%Y%m%dT%H%M%SZ").replace(
                    tzinfo=timezone.utc
                )
            except (ValueError, TypeError):
                timestamp = datetime.now(timezone.utc)

            # Detect language from GDELT sourcelang field
            source_lang = art.get("language", "English").lower()
            if source_lang in ("malay", "bahasa melayu", "indonesian"):
                lang = "malay"
            elif source_lang in ("chinese", "mandarin"):
                lang = "chinese"
            elif source_lang == "tamil":
                lang = "tamil"
            else:
                lang = "english"

            tone = art.get("tone", 0.0)
            # GDELT tone: negative values = negative tone, positive = positive
            # Goldstein scale is in events API, not doc API; use tone as proxy

            events.append(self.make_event(
                timestamp=timestamp,
                text=art.get("title", ""),
                lang=lang,
                platform="gdelt",
                source_name=art.get("domain", "unknown"),
                url=art.get("url", ""),
                tone=tone,
                goldstein_score=None,  # Only in GDELT events API
                socialimage=art.get("socialimage", ""),
            ))

        return events
