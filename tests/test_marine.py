"""Marine (tide/sea-level) router tests. REQ-IS-05 / SCENARIO-IS-05a..b."""
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from boatops.main import app
from boatops.services import marine

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_cache():
    marine._cache.clear()
    yield


def _mock():
    m = MagicMock(spec=httpx.Response)
    m.raise_for_status.return_value = None
    m.json.return_value = {
        "latitude": 63.96, "longitude": -16.21,
        "hourly": {
            "time": [f"2026-10-25T{h:02d}:00" for h in range(24)],
            "sea_level_height_msl": [0.1 * h for h in range(24)],
            "wave_height": [1.5] * 24,
            "sea_surface_temperature": [7.2] * 24,
        },
    }
    return m


@patch("httpx.get", return_value=_mock())
def test_marine_forecast_shape(mock_get):
    resp = client.get("/api/marine/forecast?lat=64.04&lon=-16.18")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["times"]) == len(body["sea_level_m"]) == 24
    assert body["grid_lat"] == 63.96


def test_marine_rejects_bad_coords():
    assert client.get("/api/marine/forecast?lat=95&lon=0").status_code == 422


def test_marine_upstream_502():
    with patch("httpx.get", side_effect=httpx.ConnectError("boom")):
        assert client.get("/api/marine/forecast?lat=64&lon=-16").status_code == 502
