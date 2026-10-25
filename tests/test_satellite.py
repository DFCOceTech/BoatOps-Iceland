"""Satellite router tests.

celestrak.get_overpasses is patched at the service level — mocking skyfield
internals is impractical and belongs in a separate unit-test layer.
sentinel_hub and cdse_auth are tested via httpx/requests mocks.
"""
import io
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from boatops.main import app
from boatops.services import cdse_auth, celestrak, sentinel_hub

client = TestClient(app)

@pytest.fixture(autouse=True)
def _cdse_credentials(monkeypatch):
    """Tests must not depend on a developer's local .env."""
    from boatops.config import settings
    monkeypatch.setattr(settings, "cdse_email", "test@example.com")
    monkeypatch.setattr(settings, "cdse_password", "test-password")


BBOX_QS = "west=-16.30&south=63.98&east=-16.06&north=64.10"

_FAKE_TOKEN = "fake.jwt.token"
_FAKE_PASSES = [
    {
        "platform": "Sentinel-2A",
        "aos_utc": "2026-05-03T06:00:00+00:00",
        "los_utc": "2026-05-03T06:08:00+00:00",
        "max_elevation_deg": 52.3,
        "duration_min": 8.0,
        "track_coords": [[12.0, 53.6], [12.5, 54.2], [13.0, 54.8]],
    },
    {
        "platform": "NOAA-20 (VIIRS)",
        "aos_utc": "2026-05-03T09:30:00+00:00",
        "los_utc": "2026-05-03T09:38:00+00:00",
        "max_elevation_deg": 34.1,
        "duration_min": 8.2,
        "track_coords": [[10.0, 53.5], [11.0, 54.5], [12.0, 55.5]],
    },
]

_FAKE_SCENE = {
    "scene_id": "S2A_MSIL2A_20260501T095031_N0511_R079_T33UUB_20260501T121442",
    "acquisition_time": "2026-05-01T09:50:31+00:00",
    "cloud_cover_pct": 5.2,
    "orbit": "12345",
    "tile_ref": "33UUB",
}


def _make_png_bytes(size=(4, 4)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", size, (0, 128, 255, 200)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def clear_caches():
    cdse_auth._cache.clear()
    celestrak._cache.clear()
    sentinel_hub._cache.clear()
    yield


# ── /api/satellite/overpasses ─────────────────────────────────────────────────

@patch.object(celestrak, "get_overpasses", return_value=_FAKE_PASSES)
def test_overpasses_returns_200(mock_fn):
    resp = client.get(f"/api/satellite/overpasses?{BBOX_QS}")
    assert resp.status_code == 200


@patch.object(celestrak, "get_overpasses", return_value=_FAKE_PASSES)
def test_overpasses_returns_list(mock_fn):
    resp = client.get(f"/api/satellite/overpasses?{BBOX_QS}")
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 2


@patch.object(celestrak, "get_overpasses", return_value=_FAKE_PASSES)
def test_overpasses_schema(mock_fn):
    resp = client.get(f"/api/satellite/overpasses?{BBOX_QS}")
    item = resp.json()[0]
    for key in ("platform", "aos_utc", "los_utc", "max_elevation_deg", "duration_min", "track_coords"):
        assert key in item, f"missing key: {key}"
    assert isinstance(item["track_coords"], list)
    assert len(item["track_coords"]) >= 2
    assert len(item["track_coords"][0]) == 2  # [lon, lat]


@patch.object(celestrak, "get_overpasses", return_value=_FAKE_PASSES)
def test_overpasses_days_param(mock_fn):
    resp = client.get(f"/api/satellite/overpasses?{BBOX_QS}&days=3")
    assert resp.status_code == 200
    mock_fn.assert_called_once_with((-16.30, 63.98, -16.06, 64.10), 3)


@patch.object(celestrak, "get_overpasses", side_effect=RuntimeError("TLE fetch failed"))
def test_overpasses_upstream_error(mock_fn):
    resp = client.get(f"/api/satellite/overpasses?{BBOX_QS}")
    assert resp.status_code == 502


# ── cdse_auth ─────────────────────────────────────────────────────────────────

def _mock_token_response():
    mock = MagicMock(spec=httpx.Response)
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"access_token": _FAKE_TOKEN}
    return mock


@patch("httpx.post", return_value=_mock_token_response())
def test_cdse_auth_returns_token(mock_post):
    token = cdse_auth.get_token("user@example.com", "password")
    assert token == _FAKE_TOKEN


@patch("httpx.post", return_value=_mock_token_response())
def test_cdse_auth_header(mock_post):
    header = cdse_auth.auth_header("user@example.com", "password")
    assert header["Authorization"] == f"Bearer {_FAKE_TOKEN}"


# ── sentinel_hub.find_best_scene ──────────────────────────────────────────────

def _mock_odata_response(items=None):
    mock = MagicMock(spec=httpx.Response)
    mock.raise_for_status.return_value = None
    mock.json.return_value = {"value": items or []}
    return mock


def _odata_item():
    return {
        "Name": _FAKE_SCENE["scene_id"],
        "ContentDate": {"Start": "2026-05-01T09:50:31.000Z"},
        "Attributes": [
            {"Name": "cloudCover", "Value": 5.2},
            {"Name": "orbitNumber", "Value": 12345},
            {"Name": "tileId", "Value": "33UUB"},
        ],
    }


@patch("httpx.get", return_value=_mock_odata_response([_odata_item()]))
def test_find_best_scene_returns_metadata(mock_get):
    scene = sentinel_hub.find_best_scene(_FAKE_TOKEN, (9.5, 53.5, 15.0, 56.0))
    assert scene is not None
    assert scene["cloud_cover_pct"] == 5.2
    assert scene["tile_ref"] == "33UUB"


@patch("httpx.get", return_value=_mock_odata_response([]))
def test_find_best_scene_returns_none_when_empty(mock_get):
    scene = sentinel_hub.find_best_scene(_FAKE_TOKEN, (9.5, 53.5, 15.0, 56.0))
    assert scene is None


# ── /api/satellite/s2-overlay ─────────────────────────────────────────────────

@patch.object(sentinel_hub, "get_s2_overlay", return_value=(_make_png_bytes(), _FAKE_SCENE))
@patch.object(cdse_auth, "get_token", return_value=_FAKE_TOKEN)
def test_s2_overlay_returns_png(mock_token, mock_overlay):
    resp = client.get(f"/api/satellite/s2-overlay?{BBOX_QS}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"


@patch.object(sentinel_hub, "get_s2_overlay", return_value=(_make_png_bytes(), _FAKE_SCENE))
@patch.object(cdse_auth, "get_token", return_value=_FAKE_TOKEN)
def test_s2_overlay_metadata_headers(mock_token, mock_overlay):
    resp = client.get(f"/api/satellite/s2-overlay?{BBOX_QS}")
    assert "x-scene-id" in resp.headers
    assert "x-acquisition-time" in resp.headers
    assert "x-cloud-cover" in resp.headers


@patch.object(sentinel_hub, "get_s2_overlay", return_value=(_make_png_bytes(), _FAKE_SCENE))
@patch.object(cdse_auth, "get_token", return_value=_FAKE_TOKEN)
def test_s2_overlay_valid_png_magic(mock_token, mock_overlay):
    resp = client.get(f"/api/satellite/s2-overlay?{BBOX_QS}")
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"


@patch.object(sentinel_hub, "get_s2_overlay",
              side_effect=RuntimeError("No scene found"))
@patch.object(cdse_auth, "get_token", return_value=_FAKE_TOKEN)
def test_s2_overlay_no_scene_returns_404(mock_token, mock_overlay):
    resp = client.get(f"/api/satellite/s2-overlay?{BBOX_QS}")
    assert resp.status_code == 404


# ── Iceland additions: bbox limits, days_back, Sentinel-1 ────────────────────
# REQ-IS-04 / SCENARIO-IS-04a..c (openspec/capabilities/iceland-site/spec.md)

def test_s2_overlay_rejects_oversized_bbox():
    resp = client.get("/api/satellite/s2-overlay?west=-30&south=60&east=-10&north=70")
    assert resp.status_code == 422


def test_s2_overlay_rejects_inverted_bbox():
    resp = client.get("/api/satellite/s2-overlay?west=-16&south=64&east=-17&north=64.1")
    assert resp.status_code == 422


@patch.object(sentinel_hub, "get_s2_overlay", return_value=(_make_png_bytes(), _FAKE_SCENE))
@patch.object(cdse_auth, "get_token", return_value=_FAKE_TOKEN)
def test_s2_overlay_passes_days_back(mock_token, mock_overlay):
    client.get(f"/api/satellite/s2-overlay?{BBOX_QS}&days_back=7")
    assert mock_overlay.call_args.args[3] == 7


@patch.object(sentinel_hub, "get_s1_overlay",
              return_value=(_make_png_bytes(), {"scene_id": "S1A_IW_GRDH", "acquisition_time": "2026-05-01T07:00:00+00:00"}))
@patch.object(cdse_auth, "get_token", return_value=_FAKE_TOKEN)
def test_s1_overlay_returns_png_with_headers(mock_token, mock_overlay):
    resp = client.get(f"/api/satellite/s1-overlay?{BBOX_QS}&days_back=3")
    assert resp.status_code == 200
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert resp.headers["x-scene-id"] == "S1A_IW_GRDH"
    assert resp.headers["x-bbox"] == "-16.3,63.98,-16.06,64.1"


@patch.object(sentinel_hub, "get_s1_overlay", side_effect=RuntimeError("No Sentinel-1 GRD scene"))
@patch.object(cdse_auth, "get_token", return_value=_FAKE_TOKEN)
def test_s1_overlay_no_scene_404(mock_token, mock_overlay):
    assert client.get(f"/api/satellite/s1-overlay?{BBOX_QS}").status_code == 404


def test_s1_overlay_without_credentials_503(monkeypatch):
    from boatops.config import settings
    monkeypatch.setattr(settings, "cdse_email", "")
    assert client.get(f"/api/satellite/s1-overlay?{BBOX_QS}").status_code == 503


@patch("httpx.get", return_value=_mock_odata_response([
    {"Name": "S1A_IW_GRDH_1SDV_20260501", "ContentDate": {"Start": "2026-05-01T07:00:00.000Z"}}]))
def test_find_best_s1_scene(mock_get):
    scene = sentinel_hub.find_best_s1_scene(_FAKE_TOKEN, (-16.3, 63.98, -16.06, 64.1))
    assert scene["scene_id"].startswith("S1A_IW_GRDH")
    assert "SENTINEL-1" in mock_get.call_args.kwargs["params"]["$filter"]


@patch("httpx.get", return_value=_mock_odata_response([]))
def test_find_best_s1_scene_none(mock_get):
    assert sentinel_hub.find_best_s1_scene(_FAKE_TOKEN, (-16.3, 63.98, -16.06, 64.1)) is None


# ── swath-aware AOI (REQ-IS-03: passes must count when the swath, not the nadir track, reaches the site)

def test_swath_aoi_grows_by_half_swath():
    from boatops.services.celestrak import swath_aoi
    poly = swath_aoi((-16.30, 63.98, -16.06, 64.10), 290)   # S2: ±145 km
    w, s, e, n = poly.bounds
    assert round((n - s - 0.12) / 2 * 111.32) == 145         # lat half-extension ≈ 145 km
    assert (e - w) > 0.24 + 2 * 145 / 111.32                  # lon extension is larger at 64°N (1/cos)


def test_nadir_track_100km_away_intersects_s2_swath_but_not_bare_box():
    from shapely.geometry import LineString, box
    from boatops.services.celestrak import swath_aoi
    bbox = (-16.30, 63.98, -16.06, 64.10)
    track = LineString([(-14.0, 63.0), (-14.0, 65.0)])        # ≈ 100 km east of the site
    assert not track.intersects(box(*bbox))
    assert track.intersects(swath_aoi(bbox, 290))


# ── input hardening (Raze review): REQ-IS-04

@pytest.mark.parametrize("qs", [
    "days=100000", "days=0",
])
def test_overpasses_days_bounded(qs):
    assert client.get(f"/api/satellite/overpasses?{BBOX_QS}&{qs}").status_code == 422


def test_overpasses_rejects_nan_and_oversized_bbox():
    assert client.get("/api/satellite/overpasses?west=nan&south=63&east=-16&north=64").status_code == 422
    assert client.get("/api/satellite/overpasses?west=-30&south=60&east=-10&north=70").status_code == 422


def test_s2_cloud_max_bounded():
    assert client.get(f"/api/satellite/s2-overlay?{BBOX_QS}&cloud_max=1e9").status_code == 422
    assert client.get(f"/api/satellite/s2-overlay?{BBOX_QS}&cloud_max=nan").status_code == 422


def test_wind_grid_rejects_nan():
    from fastapi.testclient import TestClient as _TC  # noqa: F401
    assert client.get("/api/weather/wind-grid?west=nan&south=63&east=-16&north=64").status_code == 422


# ── S2 partial-coverage selection (user report: scene covered 46 % of the work area)

def _poly(w, s, e, n):
    return {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}


def _item(start, name, footprint, cloud=5.0):
    return {"Name": name, "ContentDate": {"Start": start}, "GeoFootprint": footprint,
            "Attributes": [{"Name": "cloudCover", "Value": cloud}]}

_BB = (-16.3, 64.0, -16.1, 64.1)


@patch("httpx.get")
def test_prefers_older_full_coverage_over_newer_partial(mock_get):
    partial = _item("2026-10-16T12:33:00.000Z", "NEW_PARTIAL", _poly(-16.2, 63.9, -16.0, 64.2))   # covers half
    full = _item("2026-10-12T12:53:00.000Z", "OLD_FULL", _poly(-16.5, 63.9, -16.0, 64.2))
    mock_get.return_value = _mock_odata_response([partial, full])
    scene = sentinel_hub.find_best_scene(_FAKE_TOKEN, _BB)
    assert scene["scene_id"] == "OLD_FULL" and scene["coverage_pct"] == 100


@patch("httpx.get")
def test_falls_back_to_highest_coverage_and_reports_it(mock_get):
    a = _item("2026-10-16T12:33:00.000Z", "HALF", _poly(-16.2, 63.9, -16.0, 64.2))
    b = _item("2026-10-12T12:53:00.000Z", "QUARTER", _poly(-16.15, 63.9, -16.0, 64.2))
    mock_get.return_value = _mock_odata_response([b, a])
    scene = sentinel_hub.find_best_scene(_FAKE_TOKEN, _BB)
    assert scene["scene_id"] == "HALF" and scene["coverage_pct"] == 50


@patch("httpx.get")
def test_adjacent_tiles_of_one_pass_are_unioned(mock_get):
    west = _item("2026-10-16T12:33:10.000Z", "TILE_W", _poly(-16.5, 63.9, -16.2, 64.2))
    east = _item("2026-10-16T12:33:12.000Z", "TILE_E", _poly(-16.2, 63.9, -16.0, 64.2))
    mock_get.return_value = _mock_odata_response([east, west])
    scene = sentinel_hub.find_best_scene(_FAKE_TOKEN, _BB)
    assert scene["coverage_pct"] == 100 and scene["tiles"] == 2
