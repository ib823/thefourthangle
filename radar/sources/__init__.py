"""Data source connectors for TFA Radar."""

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from .base_connector import BaseConnector
from .twitter_connector import TwitterConnector
from .news_rss_connector import NewsRSSConnector
from .reddit_rss_connector import RedditRSSConnector
from .gdelt_connector import GDELTConnector
from .google_trends_connector import GoogleTrendsConnector
from .parliament_connector import ParliamentConnector
from .court_connector import CourtConnector


class SourceAggregator:
    """Initializes all source connectors and provides unified event stream."""

    def __init__(self, config: dict):
        self.log = logger.bind(component="source_aggregator")
        self.connectors: list[BaseConnector] = []

        # Flatten all keywords across categories and languages
        all_keywords = self._flatten_keywords(config.get("keywords", {}))

        sources_cfg = config.get("sources", {})

        # Initialize Twitter connector (skip if no token)
        twitter_cfg = sources_cfg.get("twitter", {})
        if twitter_cfg.get("enabled", False):
            import os
            token = os.environ.get("TWITTER_BEARER_TOKEN", "")
            if token and token != "your_token_here":
                try:
                    self.connectors.append(
                        TwitterConnector(twitter_cfg, all_keywords)
                    )
                except Exception as e:
                    self.log.warning(f"Failed to initialize Twitter connector: {e}")
            else:
                self.log.warning("TWITTER_BEARER_TOKEN not set — skipping Twitter source")

        # Initialize news RSS connector
        if sources_cfg.get("news_rss", {}).get("enabled", False):
            try:
                self.connectors.append(NewsRSSConnector(sources_cfg["news_rss"]))
            except Exception as e:
                self.log.warning(f"Failed to initialize news RSS connector: {e}")

        # Initialize Reddit RSS connector (no auth needed)
        if sources_cfg.get("reddit_rss", {}).get("enabled", False):
            try:
                self.connectors.append(RedditRSSConnector(sources_cfg["reddit_rss"]))
            except Exception as e:
                self.log.warning(f"Failed to initialize Reddit RSS connector: {e}")

        # Initialize GDELT connector
        if sources_cfg.get("gdelt", {}).get("enabled", False):
            try:
                self.connectors.append(GDELTConnector(sources_cfg["gdelt"]))
            except Exception as e:
                self.log.warning(f"Failed to initialize GDELT connector: {e}")

        # Initialize Google Trends connector
        if sources_cfg.get("google_trends", {}).get("enabled", False):
            try:
                gt_keywords = all_keywords[:15]  # Limit for GT
                self.connectors.append(
                    GoogleTrendsConnector(sources_cfg["google_trends"], gt_keywords)
                )
            except Exception as e:
                self.log.warning(f"Failed to initialize Google Trends connector: {e}")

        # Initialize Parliament connector (always enabled — uses news RSS fallback)
        if sources_cfg.get("parliament", {}).get("enabled", True):
            try:
                self.connectors.append(ParliamentConnector(sources_cfg.get("parliament", {})))
            except Exception as e:
                self.log.warning(f"Failed to initialize Parliament connector: {e}")

        # Initialize Court connector (always enabled — uses news RSS fallback)
        if sources_cfg.get("court", {}).get("enabled", True):
            try:
                self.connectors.append(CourtConnector(sources_cfg.get("court", {})))
            except Exception as e:
                self.log.warning(f"Failed to initialize Court connector: {e}")

        self.log.info(
            f"Initialized {len(self.connectors)} source connectors: "
            f"{[c.name for c in self.connectors]}"
        )

    @staticmethod
    def _flatten_keywords(keywords_config: dict) -> list[str]:
        """Extract unique keywords from all categories and languages."""
        seen = set()
        result = []
        for category_keywords in keywords_config.values():
            if isinstance(category_keywords, dict):
                for lang_keywords in category_keywords.values():
                    if isinstance(lang_keywords, list):
                        for kw in lang_keywords:
                            if kw.lower() not in seen:
                                seen.add(kw.lower())
                                result.append(kw)
        return result

    def fetch_all(self) -> list[dict[str, Any]]:
        """Fetch events from all connectors, sorted by timestamp."""
        all_events = []
        for connector in self.connectors:
            events = connector.safe_fetch()
            all_events.extend(events)

        # Sort by timestamp (most recent first)
        all_events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
        self.log.info(f"Aggregated {len(all_events)} events from {len(self.connectors)} sources")
        return all_events

    def health(self) -> list[dict]:
        """Return health status for all connectors."""
        return [c.health_check() for c in self.connectors]
