"""Tests for data source connectors."""

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from radar.sources.base_connector import BaseConnector
from radar.sources.twitter_connector import TwitterConnector, detect_language
from radar.sources.news_rss_connector import NewsRSSConnector
from radar.sources.gdelt_connector import GDELTConnector
from radar.sources.google_trends_connector import GoogleTrendsConnector
from radar.sources import SourceAggregator


# --- Base Connector ---


class DummyConnector(BaseConnector):
    def __init__(self):
        super().__init__("dummy", {})
        self._events = []

    def fetch(self):
        return self._events


class FailingConnector(BaseConnector):
    def __init__(self):
        super().__init__("failing", {})

    def fetch(self):
        raise ConnectionError("test failure")


class TestBaseConnector:
    def test_make_event_format(self):
        event = BaseConnector.make_event(
            timestamp=datetime(2026, 3, 24, tzinfo=timezone.utc),
            text="test text",
            lang="english",
            platform="test",
            source_name="test_source",
            extra_field="extra",
        )
        assert event["text"] == "test text"
        assert event["lang"] == "english"
        assert event["platform"] == "test"
        assert event["metadata"]["extra_field"] == "extra"

    def test_health_check_initial(self):
        c = DummyConnector()
        health = c.health_check()
        assert health["status"] == "healthy"
        assert health["error_count"] == 0

    def test_safe_fetch_success(self):
        c = DummyConnector()
        c._events = [{"text": "hello"}]
        result = c.safe_fetch()
        assert len(result) == 1
        assert c.success_count == 1

    def test_safe_fetch_retries_on_failure(self):
        c = FailingConnector()
        result = c.safe_fetch()
        assert result == []
        assert c.error_count == 3  # 3 retries


# --- Twitter Connector ---


class TestLanguageDetection:
    def test_malay_from_twitter_lang(self):
        assert detect_language("any text", "ms") == "malay"

    def test_english_from_twitter_lang(self):
        assert detect_language("any text", "en") == "english"

    def test_malay_from_content(self):
        text = "kerajaan yang tidak akan bertindak dengan rakyat ini dan mereka"
        assert detect_language(text, None) == "malay"

    def test_chinese_from_twitter_lang(self):
        assert detect_language("any text", "zh") == "chinese"

    def test_tamil_from_twitter_lang(self):
        assert detect_language("any text", "ta") == "tamil"


class TestTwitterConnector:
    def test_init_without_token(self):
        with patch.dict("os.environ", {"TWITTER_BEARER_TOKEN": ""}, clear=False):
            tc = TwitterConnector({"max_results_per_query": 10}, ["test"])
            assert tc.client is None

    def test_fetch_returns_empty_without_client(self):
        with patch.dict("os.environ", {"TWITTER_BEARER_TOKEN": ""}, clear=False):
            tc = TwitterConnector({}, ["test"])
            assert tc.fetch() == []


# --- News RSS Connector ---


MOCK_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Article</title>
      <link>https://example.com/article1</link>
      <description>Test description</description>
      <pubDate>Mon, 24 Mar 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Article</title>
      <link>https://example.com/article2</link>
      <description>Another description</description>
      <pubDate>Mon, 24 Mar 2026 11:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"""


class TestNewsRSSConnector:
    def test_fetch_parses_entries(self):
        import feedparser as fp
        config = {
            "feeds": [
                {"name": "Test", "url": "https://example.com/rss", "language": "english"}
            ]
        }
        connector = NewsRSSConnector(config)
        parsed = fp.parse(MOCK_RSS)

        with patch("radar.sources.news_rss_connector.feedparser") as mock_fp:
            mock_fp.parse.return_value = parsed
            events = connector.fetch()

        assert len(events) == 2
        assert events[0]["platform"] == "news"
        assert events[0]["lang"] == "english"
        assert "Test Article" in events[0]["text"]

    def test_deduplication(self):
        import feedparser as fp
        config = {
            "feeds": [
                {"name": "Test", "url": "https://example.com/rss", "language": "english"}
            ]
        }
        connector = NewsRSSConnector(config)
        parsed = fp.parse(MOCK_RSS)

        with patch("radar.sources.news_rss_connector.feedparser") as mock_fp:
            mock_fp.parse.return_value = parsed
            events1 = connector.fetch()
            events2 = connector.fetch()

        assert len(events1) == 2
        assert len(events2) == 0  # All URLs already seen


# --- GDELT Connector ---


class TestGDELTConnector:
    def _make_mock_response(self, json_data):
        """Create a mock response that passes the text/status checks."""
        import json
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = json.dumps(json_data)
        mock_response.json.return_value = json_data
        mock_response.raise_for_status = MagicMock()
        return mock_response

    def test_fetch_parses_response(self):
        config = {"country_filter": "MY"}
        connector = GDELTConnector(config)

        data = {
            "articles": [
                {
                    "title": "Malaysia political controversy",
                    "url": "https://example.com/article",
                    "seendate": "20260324T100000Z",
                    "language": "English",
                    "domain": "example.com",
                    "tone": -3.5,
                }
            ]
        }

        with patch("requests.get", return_value=self._make_mock_response(data)):
            events = connector.fetch()

        assert len(events) == 1
        assert events[0]["lang"] == "english"
        assert events[0]["metadata"]["tone"] == -3.5

    def test_fetch_handles_malay_language(self):
        config = {"country_filter": "MY"}
        connector = GDELTConnector(config)

        data = {
            "articles": [
                {
                    "title": "Berita Malaysia",
                    "seendate": "20260324T100000Z",
                    "language": "Malay",
                    "domain": "utusan.com.my",
                    "tone": -1.0,
                }
            ]
        }

        with patch("requests.get", return_value=self._make_mock_response(data)):
            events = connector.fetch()

        assert events[0]["lang"] == "malay"


# --- Google Trends Connector ---


class TestGoogleTrendsConnector:
    def test_fetch_returns_list(self):
        config = {"region": "MY"}
        connector = GoogleTrendsConnector(config, ["kerajaan", "corruption"])
        # Should return a list regardless of API availability (may be empty due to rate limits)
        events = connector.fetch()
        assert isinstance(events, list)


# --- Source Aggregator ---


class TestSourceAggregator:
    def test_flatten_keywords(self):
        keywords = {
            "politics": {
                "malay": ["kerajaan", "parlimen"],
                "english": ["government", "parliament"],
            },
            "race": {
                "malay": ["kaum"],
                "english": ["race"],
            },
        }
        result = SourceAggregator._flatten_keywords(keywords)
        assert "kerajaan" in result
        assert "government" in result
        assert "kaum" in result
        assert len(result) == 6

    def test_init_with_disabled_sources(self):
        config = {
            "keywords": {},
            "sources": {
                "twitter": {"enabled": False},
                "news_rss": {"enabled": False},
                "gdelt": {"enabled": False},
                "google_trends": {"enabled": False},
                "parliament": {"enabled": False},
                "court": {"enabled": False},
            },
        }
        agg = SourceAggregator(config)
        assert len(agg.connectors) == 0
