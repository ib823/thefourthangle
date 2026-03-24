"""Twitter/X API v2 connector for Malaysian controversy monitoring."""

import os
from datetime import datetime, timezone, timedelta
from typing import Any

import tweepy

from .base_connector import BaseConnector


# Simple language detection heuristics for Malaysian context
MALAY_MARKERS = {"yang", "dan", "ini", "itu", "untuk", "tidak", "dengan", "akan", "dari", "ada", "telah", "mereka", "kita", "sudah", "juga", "kerajaan", "rakyat"}
CHINESE_MARKERS = set()  # Romanized detection is unreliable; rely on Twitter lang field
TAMIL_MARKERS = set()


def detect_language(text: str, twitter_lang: str | None = None) -> str:
    """Detect language from text and Twitter's lang field."""
    if twitter_lang == "ms" or twitter_lang == "in":
        return "malay"
    if twitter_lang == "zh":
        return "chinese"
    if twitter_lang == "ta":
        return "tamil"
    if twitter_lang == "en":
        # Check for Malay content misclassified as English
        words = set(text.lower().split())
        if len(words & MALAY_MARKERS) >= 3:
            return "malay"
        return "english"

    # Fallback: check for Malay markers
    words = set(text.lower().split())
    if len(words & MALAY_MARKERS) >= 3:
        return "malay"
    return "english"


class TwitterConnector(BaseConnector):
    """Connects to Twitter/X API v2 for Malaysian controversy keywords."""

    def __init__(self, config: dict, keywords: list[str]):
        super().__init__("twitter", config)
        self.keywords = keywords
        self.max_results = config.get("max_results_per_query", 100)
        self.client: tweepy.Client | None = None
        self._init_client()

    def _init_client(self):
        """Initialize tweepy client from environment."""
        bearer = os.environ.get("TWITTER_BEARER_TOKEN")
        if not bearer or bearer == "your_token_here":
            self.log.warning("TWITTER_BEARER_TOKEN not set — Twitter connector disabled")
            return
        self.client = tweepy.Client(bearer_token=bearer, wait_on_rate_limit=True)
        self.log.info("Twitter client initialized")

    def fetch(self) -> list[dict[str, Any]]:
        """Search recent tweets for controversy keywords."""
        if self.client is None:
            return []

        events = []
        # Build query from keywords (batch into groups to stay under query length limit)
        query_parts = []
        current_query = ""
        for kw in self.keywords:
            candidate = f'"{kw}" OR ' if " " in kw else f"{kw} OR "
            if len(current_query + candidate) > 900:  # Twitter query limit ~1024
                query_parts.append(current_query.rstrip(" OR "))
                current_query = candidate
            else:
                current_query += candidate
        if current_query:
            query_parts.append(current_query.rstrip(" OR "))

        since = datetime.now(timezone.utc) - timedelta(hours=1)

        for query_str in query_parts:
            # Add Malaysia geo or language filter
            full_query = f"({query_str}) (lang:ms OR lang:en OR lang:zh OR lang:ta) -is:retweet"
            if len(full_query) > 1024:
                full_query = full_query[:1020] + "..."

            try:
                response = self.client.search_recent_tweets(
                    query=full_query,
                    max_results=min(self.max_results, 100),
                    start_time=since,
                    tweet_fields=["created_at", "lang", "public_metrics", "author_id"],
                    user_fields=["public_metrics"],
                    expansions=["author_id"],
                )
            except tweepy.errors.TweepyException as e:
                self.log.warning(f"Twitter search failed for query batch: {e}")
                continue

            if not response.data:
                continue

            # Build user lookup
            users = {}
            if response.includes and "users" in response.includes:
                for user in response.includes["users"]:
                    users[user.id] = user

            for tweet in response.data:
                user = users.get(tweet.author_id)
                followers = user.public_metrics["followers_count"] if user else 0
                metrics = tweet.public_metrics or {}

                lang = detect_language(tweet.text, tweet.lang)
                events.append(self.make_event(
                    timestamp=tweet.created_at or datetime.now(timezone.utc),
                    text=tweet.text,
                    lang=lang,
                    platform="twitter",
                    source_name="twitter",
                    user_id=str(tweet.author_id),
                    user_followers=followers,
                    retweet_count=metrics.get("retweet_count", 0),
                    like_count=metrics.get("like_count", 0),
                    reply_count=metrics.get("reply_count", 0),
                    tweet_id=str(tweet.id),
                ))

        return events
