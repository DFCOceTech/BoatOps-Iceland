from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from boatops.main import app
from boatops.services import meteoalarm, openmeteo

client = TestClient(app)


# ── fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_caches():
    openmeteo._cache.clear()
    openmeteo._grid_cache.clear()
    meteoalarm._cache.clear()
    yield


def _om_mock():
    times = [f"2026-05-01T{h:02d}:00" for h in range(24)] * 7  # 168 items
    mock = MagicMock(spec=httpx.Response)
    mock.raise_for_status.return_value = None
    mock.json.return_value = {
        "generationtime_ms": 1.23,
        "hourly": {
            "time": times,
            "wind_speed_10m": [5.0] * 168,
            "wind_direction_10m": [270.0] * 168,
            "wind_gusts_10m": [8.0] * 168,
            "temperature_2m": [15.0] * 168,
            "precipitation": [0.0] * 168,
            "cloudcover": [30.0] * 168,
        },
    }
    return mock


_METEOALARM_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Starker Wind an der Ostseeküste</title>
    <updated>2026-05-02T10:00:00Z</updated>
    <info xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <event>Wind</event>
      <urgency>Immediate</urgency>
      <severity>Moderate</severity>
      <onset>2026-05-02T12:00:00Z</onset>
      <expires>2026-05-02T20:00:00Z</expires>
      <areaDesc>Ostseeküste Mecklenburg-Vorpommern</areaDesc>
    </info>
  </entry>
</feed>""".encode("utf-8")


def _ma_mock():
    mock = MagicMock(spec=httpx.Response)
    mock.raise_for_status.return_value = None
    mock.content = _METEOALARM_XML
    return mock


# ── forecast tests ────────────────────────────────────────────────────────────

@patch("httpx.get", return_value=_om_mock())
def test_forecast_returns_200(mock_get):
    resp = client.get("/api/weather/forecast?lat=54.18&lon=12.08")
    assert resp.status_code == 200


@patch("httpx.get", return_value=_om_mock())
def test_forecast_has_required_keys(mock_get):
    resp = client.get("/api/weather/forecast?lat=54.18&lon=12.08")
    body = resp.json()
    for key in ("times", "wind_speed_ms", "wind_speed_kt", "wind_dir_deg",
                "temperature_c", "precipitation_mm", "cloud_cover_pct"):
        assert key in body, f"missing key: {key}"


@patch("httpx.get", return_value=_om_mock())
def test_forecast_168_time_steps(mock_get):
    resp = client.get("/api/weather/forecast?lat=54.18&lon=12.08")
    body = resp.json()
    assert len(body["times"]) == 168
    assert len(body["wind_speed_ms"]) == 168


@patch("httpx.get", return_value=_om_mock())
def test_forecast_kt_conversion(mock_get):
    resp = client.get("/api/weather/forecast?lat=54.18&lon=12.08")
    body = resp.json()
    ms = body["wind_speed_ms"][0]
    kt = body["wind_speed_kt"][0]
    assert abs(kt - ms * 1.94384) < 0.01


def test_forecast_upstream_502():
    err_resp = MagicMock(spec=httpx.Response)
    err_resp.status_code = 503
    exc = httpx.HTTPStatusError("bad gateway", request=MagicMock(), response=err_resp)
    with patch("httpx.get", side_effect=exc):
        resp = client.get("/api/weather/forecast?lat=54.18&lon=12.08")
    assert resp.status_code == 502
    assert "upstream error" in resp.json()["detail"]


# ── advisories tests ──────────────────────────────────────────────────────────

@patch("httpx.get", return_value=_ma_mock())
def test_advisories_returns_geojson(mock_get):
    resp = client.get("/api/weather/advisories?country=DE")
    assert resp.status_code == 200
    body = resp.json()
    assert body["type"] == "FeatureCollection"
    assert "features" in body
    assert "last_updated" in body


@patch("httpx.get", return_value=_ma_mock())
def test_advisories_feature_schema(mock_get):
    resp = client.get("/api/weather/advisories?country=DE")
    feature = resp.json()["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"] is None  # no polygon in Atom feed
    props = feature["properties"]
    for key in ("title", "event", "severity", "urgency", "onset", "expires"):
        assert key in props


@patch("httpx.get", return_value=_ma_mock())
def test_advisories_parses_content(mock_get):
    resp = client.get("/api/weather/advisories?country=DE")
    props = resp.json()["features"][0]["properties"]
    assert props["event"] == "Wind"
    assert props["severity"] == "Moderate"
    assert "Ostseeküste" in props["area_description"]


def test_advisories_empty_feed():
    empty_xml = b"""<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"></feed>"""
    mock = MagicMock(spec=httpx.Response)
    mock.raise_for_status.return_value = None
    mock.content = empty_xml
    with patch("httpx.get", return_value=mock):
        resp = client.get("/api/weather/advisories?country=DE")
    assert resp.status_code == 200
    assert resp.json()["features"] == []


# ── wind-grid tests ───────────────────────────────────────────────────────────

def _wind_grid_mock(n_points: int, n_hours: int = 168):
    """Batch response: list of dicts, one per grid point."""
    times = [f"2026-05-01T{h % 24:02d}:00" for h in range(n_hours)]
    single = {
        "hourly": {
            "time": times,
            "wind_u_component_10m": [3.0] * n_hours,
            "wind_v_component_10m": [4.0] * n_hours,  # speed = 5 m/s
        },
    }
    mock = MagicMock(spec=httpx.Response)
    mock.raise_for_status.return_value = None
    mock.json.return_value = [single] * n_points
    return mock


# Small bbox: west=9.5, south=53.5, east=10.0, north=54.0, step=0.5 → 2×2 = 4 points
_SMALL_GRID_QS = "west=9.5&south=53.5&east=10.0&north=54.0&step=0.5"


@patch("httpx.get", return_value=_wind_grid_mock(n_points=4))
def test_wind_grid_structure(mock_get):
    resp = client.get(f"/api/weather/wind-grid?{_SMALL_GRID_QS}")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("u", "v", "width", "height", "bbox", "timestamp", "vmax_speed"):
        assert key in body, f"missing key: {key}"


@patch("httpx.get", return_value=_wind_grid_mock(n_points=4))
def test_wind_grid_vmax_capped(mock_get):
    """vmax_speed must not exceed 20 m/s regardless of data values."""
    resp = client.get(f"/api/weather/wind-grid?{_SMALL_GRID_QS}")
    assert resp.json()["vmax_speed"] <= 20.0


@patch("httpx.get", return_value=_wind_grid_mock(n_points=4))
def test_wind_grid_hour_param(mock_get):
    """hour param is accepted and returns a valid response."""
    resp = client.get(f"/api/weather/wind-grid?{_SMALL_GRID_QS}&hour=12")
    assert resp.status_code == 200
    assert "timestamp" in resp.json()
