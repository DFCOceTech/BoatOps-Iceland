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

BBOX_QS = "west=9.5&south=53.5&east=15.0&north=56.0"

_FAKE_TOKEN = "fake.jwt.token"
_FAKE_PASSES = [
    {
        "platform": "Sentinel-2A",
        "aos_utc": "2026-05-03T06:00:00+00:00",
        "los_utc": "2026-05-03T06:08:00+00:00",
        "max_elevation_deg": 52.3,
        "duration_min": 8.0,
    },
    {
        "platform": "NOAA-20 (VIIRS)",
        "aos_utc": "2026-05-03T09:30:00+00:00",
        "los_utc": "2026-05-03T09:38:00+00:00",
        "max_elevation_deg": 34.1,
        "duration_min": 8.2,
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
    for key in ("platform", "aos_utc", "los_utc", "max_elevation_deg", "duration_min"):
        assert key in item, f"missing key: {key}"


@patch.object(celestrak, "get_overpasses", return_value=_FAKE_PASSES)
def test_overpasses_days_param(mock_fn):
    resp = client.get(f"/api/satellite/overpasses?{BBOX_QS}&days=3")
    assert resp.status_code == 200
    mock_fn.assert_called_once_with((9.5, 53.5, 15.0, 56.0), 3)


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
