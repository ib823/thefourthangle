"""Google Trends connector for Malaysian search interest signals."""

import os
from datetime import datetime, timezone
from typing import Any

import requests

from .base_connector import BaseConnector


class GoogleTrendsConnector(BaseConnector):
    """Queries Google Trends for Malaysian search term interest.

    Uses the unofficial Google Trends API endpoint since pytrends has
    reliability issues. Falls back gracefully when rate-limited.
    """

    def __init__(self, config: dict, keywords: list[str]):
        super().__init__("google_trends", config)
        self.region = os.environ.get("GOOGLE_TRENDS_REGION", config.get("region", "MY"))
        self.keywords = keywords[:5]  # GT allows max 5 comparison terms

    def fetch(self) -> list[dict[str, Any]]:
        """Fetch interest over time for configured keywords.

        Note: Google Trends doesn't have a stable public API.
        This connector provides the interface; actual implementation
        requires either pytrends or SerpAPI/similar.
        """
        events = []
        now = datetime.now(timezone.utc)

        # Attempt to use pytrends if available
        try:
            from pytrends.request import TrendReq

            import time as _time

            pytrends = TrendReq(hl="en-US", tz=480)  # UTC+8 for Malaysia

            for i in range(0, len(self.keywords), 5):
                if i > 0:
                    _time.sleep(5)  # Rate limit: 5s between batches
                batch = self.keywords[i : i + 5]
                pytrends.build_payload(batch, cat=0, timeframe="now 1-d", geo=self.region)

                interest = pytrends.interest_over_time()
                if interest.empty:
                    continue

                # Get the most recent data point
                latest = interest.iloc[-1]
                for kw in batch:
                    if kw in latest:
                        events.append(self.make_event(
                            timestamp=now,
                            text=kw,
                            lang="mixed",
                            platform="google_trends",
                            source_name="google_trends",
                            keyword=kw,
                            interest_value=int(latest[kw]),
                            is_breakout=int(latest[kw]) > 75,
                        ))

                # Check related queries for breakouts
                try:
                    related = pytrends.related_queries()
                    for kw in batch:
                        if kw in related and related[kw].get("rising") is not None:
                            rising = related[kw]["rising"]
                            for _, row in rising.iterrows():
                                if "Breakout" in str(row.get("value", "")):
                                    events.append(self.make_event(
                                        timestamp=now,
                                        text=row["query"],
                                        lang="mixed",
                                        platform="google_trends",
                                        source_name="google_trends_breakout",
                                        keyword=row["query"],
                                        related_to=kw,
                                        is_breakout=True,
                                    ))
                except Exception:
                    pass  # Related queries often fail

        except ImportError:
            self.log.info("pytrends not installed — Google Trends connector returns empty")
        except Exception as e:
            self.log.warning(f"Google Trends fetch failed: {e}")

        return events
