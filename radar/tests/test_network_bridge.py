"""Tests for Stream 5: Network Bridge Detection."""

from datetime import datetime, timezone, timedelta

import numpy as np
import pytest

from radar.streams.network_bridge import NetworkBridgeMonitor


class TestNetworkBridge:
    def _make_config(self):
        return {
            "bridge_alert_threshold": 0.5,
            "velocity_threshold": 0.01,
            "window_hours": 24,
        }

    def test_bridge_score_zero_single_community(self):
        """Bridge score should be 0 when all users are from one community."""
        nb = NetworkBridgeMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        for i in range(20):
            nb.add_event("topic", f"user_{i}", "malay", now)

        result = nb.evaluate_topic("topic", now)
        assert result["bridge_score"] == 0.0
        assert not result["is_bridging"]

    def test_bridge_score_even_four_way(self):
        """Bridge score should be 0.75 with even 4-way split."""
        nb = NetworkBridgeMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        for i in range(25):
            nb.add_event("topic", f"malay_{i}", "malay", now)
            nb.add_event("topic", f"chinese_{i}", "chinese", now)
            nb.add_event("topic", f"english_{i}", "english", now)
            nb.add_event("topic", f"tamil_{i}", "tamil", now)

        result = nb.evaluate_topic("topic", now)
        assert result["bridge_score"] == pytest.approx(0.75, abs=0.01)
        assert result["is_bridging"]

    def test_bridge_velocity_detects_spreading(self):
        """Should detect a topic spreading from Malay-only to cross-community."""
        nb = NetworkBridgeMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # Initially Malay-only
        for i in range(20):
            nb.add_event("spreading", f"malay_{i}", "malay", now)
        nb.evaluate_topic("spreading", now)

        # Add Chinese users over time
        for step in range(5):
            t = now + timedelta(hours=step + 1)
            for i in range(5 * (step + 1)):
                nb.add_event("spreading", f"chinese_{step}_{i}", "chinese", t)
            nb.evaluate_topic("spreading", t)

        velocity = nb.compute_bridge_velocity("spreading")
        assert velocity > 0, f"Bridge velocity should be positive, got {velocity}"

    def test_community_shares(self):
        """Community shares should reflect engagement distribution."""
        nb = NetworkBridgeMonitor(self._make_config())
        now = datetime(2026, 3, 24, tzinfo=timezone.utc)

        # 60 Malay, 30 Chinese, 10 English
        for i in range(60):
            nb.add_event("topic", f"malay_{i}", "malay", now)
        for i in range(30):
            nb.add_event("topic", f"chinese_{i}", "chinese", now)
        for i in range(10):
            nb.add_event("topic", f"english_{i}", "english", now)

        shares = nb.compute_community_shares("topic")
        assert shares["malay"] == pytest.approx(0.6, abs=0.01)
        assert shares["chinese"] == pytest.approx(0.3, abs=0.01)
        assert shares["english"] == pytest.approx(0.1, abs=0.01)

    def test_bridge_score_static_method(self):
        """Test bridge score computation directly."""
        assert NetworkBridgeMonitor.compute_bridge_score({"malay": 1.0}) == 0.0
        assert NetworkBridgeMonitor.compute_bridge_score(
            {"malay": 0.25, "chinese": 0.25, "english": 0.25, "tamil": 0.25}
        ) == pytest.approx(0.75)
        assert NetworkBridgeMonitor.compute_bridge_score(
            {"malay": 0.5, "chinese": 0.5}
        ) == pytest.approx(0.5)
