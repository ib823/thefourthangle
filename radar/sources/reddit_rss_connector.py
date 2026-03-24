"""Reddit RSS connector — zero authentication required.

Fetches posts from Malaysian subreddits via public RSS feeds.
No API key needed.
"""

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser

from .base_connector import BaseConnector


class RedditRSSConnector(BaseConnector):
    """Fetches Malaysian subreddit posts via public RSS. No auth needed."""

    DEFAULT_FEEDS = [
        {"name": "r/malaysia hot", "url": "https://www.reddit.com/r/malaysia/hot/.rss", "subreddit": "malaysia"},
        {"name": "r/malaysia new", "url": "https://www.reddit.com/r/malaysia/new/.rss", "subreddit": "malaysia"},
        {"name": "r/malaysia rising", "url": "https://www.reddit.com/r/malaysia/rising/.rss", "subreddit": "malaysia"},
        {"name": "r/malaysians hot", "url": "https://www.reddit.com/r/malaysians/hot/.rss", "subreddit": "malaysians"},
        {"name": "r/bolehland hot", "url": "https://www.reddit.com/r/bolehland/hot/.rss", "subreddit": "bolehland"},
    ]

    def __init__(self, config: dict):
        super().__init__("reddit", config)
        self.feeds = config.get("feeds", self.DEFAULT_FEEDS)
        self._seen_ids: set[str] = set()
        self._max_seen = 5_000

    def fetch(self) -> list[dict[str, Any]]:
        events = []

        for feed_cfg in self.feeds:
            name = feed_cfg["name"]
            url = feed_cfg["url"]
            subreddit = feed_cfg.get("subreddit", "malaysia")

            try:
                parsed = feedparser.parse(url)
            except Exception as e:
                self.log.warning(f"Failed to parse Reddit feed {name}: {e}")
                continue

            if parsed.bozo and not parsed.entries:
                self.log.warning(f"Reddit feed {name}: bozo={parsed.bozo}")
                continue

            for entry in parsed.entries:
                post_id = entry.get("id", entry.get("link", ""))
                if post_id in self._seen_ids:
                    continue
                self._seen_ids.add(post_id)

                # Parse timestamp
                timestamp = datetime.now(timezone.utc)
                if entry.get("updated"):
                    try:
                        timestamp = datetime.fromisoformat(
                            entry.updated.replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass
                elif entry.get("published"):
                    try:
                        timestamp = parsedate_to_datetime(entry.published)
                        if timestamp.tzinfo is None:
                            timestamp = timestamp.replace(tzinfo=timezone.utc)
                    except (ValueError, TypeError):
                        pass

                title = entry.get("title", "")
                # Reddit RSS puts HTML content in 'content' or 'summary'
                summary = ""
                if entry.get("content"):
                    summary = entry.content[0].get("value", "")
                elif entry.get("summary"):
                    summary = entry.get("summary", "")

                # Strip HTML tags for plain text
                summary_text = re.sub(r"<[^>]+>", " ", summary)
                summary_text = re.sub(r"\s+", " ", summary_text).strip()

                text = f"{title}. {summary_text[:500]}" if summary_text else title

                # Detect language — r/malaysia is predominantly English/Malay mix
                lang = self._detect_lang(text)

                # Extract score and comments from summary HTML if available
                score = 0
                num_comments = 0
                # Reddit RSS sometimes has "submitted by" and comment count
                score_match = re.search(r"(\d+)\s*(?:point|upvote)", summary)
                if score_match:
                    score = int(score_match.group(1))
                comments_match = re.search(r"(\d+)\s*comment", summary)
                if comments_match:
                    num_comments = int(comments_match.group(1))

                events.append(self.make_event(
                    timestamp=timestamp,
                    text=text,
                    lang=lang,
                    platform="reddit",
                    source_name=name,
                    url=entry.get("link", ""),
                    subreddit=subreddit,
                    post_id=post_id,
                    score=score,
                    num_comments=num_comments,
                    user_id=entry.get("author", "anonymous"),
                ))

        # Prune seen IDs
        if len(self._seen_ids) > self._max_seen:
            excess = len(self._seen_ids) - self._max_seen // 2
            for _ in range(excess):
                self._seen_ids.pop()

        return events

    @staticmethod
    def _detect_lang(text: str) -> str:
        """Simple Malay vs English detection for Reddit posts."""
        malay_markers = {"yang", "dan", "ini", "itu", "untuk", "tidak", "dengan",
                         "akan", "dari", "ada", "kerajaan", "rakyat", "nak", "tak",
                         "boleh", "macam", "lah", "je", "pun", "kan", "apa", "kenapa"}
        words = set(text.lower().split())
        malay_count = len(words & malay_markers)
        if malay_count >= 3:
            return "malay"
        return "english"
