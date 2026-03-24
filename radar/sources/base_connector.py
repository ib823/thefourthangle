"""Base connector class for all data source connectors."""

import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from loguru import logger


class BaseConnector(ABC):
    """Abstract base class for data source connectors.

    All connectors return events in the standardized format:
    {
        "timestamp": "2026-03-24T14:30:00Z",
        "text": "content text",
        "lang": "malay"|"english"|"chinese"|"tamil"|"mixed",
        "platform": "twitter"|"news"|"gdelt"|"google_trends",
        "source_name": "specific source name",
        "metadata": {}  # platform-specific fields
    }
    """

    def __init__(self, name: str, config: dict):
        self.name = name
        self.config = config
        self.log = logger.bind(component=f"source.{name}")
        self.last_fetch: datetime | None = None
        self.error_count = 0
        self.success_count = 0

    @abstractmethod
    def fetch(self) -> list[dict[str, Any]]:
        """Fetch new events. Returns list of standardized event dicts."""
        ...

    def health_check(self) -> dict:
        """Return connector health status."""
        total = self.success_count + self.error_count
        return {
            "name": self.name,
            "last_fetch": self.last_fetch.isoformat() if self.last_fetch else None,
            "error_rate": self.error_count / max(total, 1),
            "success_count": self.success_count,
            "error_count": self.error_count,
            "status": "healthy" if self.error_count < 3 else "degraded",
        }

    def safe_fetch(self) -> list[dict[str, Any]]:
        """Fetch with error handling and retry logic."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                events = self.fetch()
                self.last_fetch = datetime.now(timezone.utc)
                self.success_count += 1
                self.log.info(f"Fetched {len(events)} events")
                return events
            except Exception as e:
                self.error_count += 1
                wait = 2 ** attempt
                self.log.warning(
                    f"Fetch attempt {attempt + 1}/{max_retries} failed: {e}. "
                    f"Retrying in {wait}s..."
                )
                if attempt < max_retries - 1:
                    time.sleep(wait)
        self.log.error(f"All {max_retries} fetch attempts failed")
        return []

    @staticmethod
    def make_event(
        timestamp: datetime,
        text: str,
        lang: str,
        platform: str,
        source_name: str,
        **metadata,
    ) -> dict[str, Any]:
        """Create a standardized event dict."""
        return {
            "timestamp": timestamp.isoformat(),
            "text": text,
            "lang": lang,
            "platform": platform,
            "source_name": source_name,
            "metadata": metadata,
        }
