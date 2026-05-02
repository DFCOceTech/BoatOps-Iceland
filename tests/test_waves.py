from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
import xarray as xr
from fastapi.testclient import TestClient

from boatops.main import app
from boatops.services import cmems

client = TestClient(app)

# ── synthetic dataset factory ─────────────────────────────────────────────────

def _make_ds(hs: float = 0.5, vmdr: float = 225.0,
             ny: int = 10, nx: int = 12, land_mask: bool = False) -> xr.Dataset:
    lats = np.linspace(53.5, 56.0, ny)
    lons = np.linspace(9.5, 15.0, nx)
    times = pd.date_range("2026-05-02", periods=4, freq="h")
    hs_data = np.full((4, ny, nx), hs, dtype=float)
    vmdr_data = np.full((4, ny, nx), vmdr, dtype=float)
    if land_mask:
        # mask nearest cell to (54.18, 12.08) — forces wet-cell fallback
        yi = int(np.argmin(np.abs(lats - 54.18)))
        xi = int(np.argmin(np.abs(lons - 12.08)))
        hs_data[:, yi, xi] = np.nan
        vmdr_data[:, yi, xi] = np.nan
    return xr.Dataset(
        {"VHM0": (["time", "latitude", "longitude"], hs_data),
         "VMDR": (["time", "latitude", "longitude"], vmdr_data)},
        coords={"time": times, "latitude": lats, "longitude": lons},
    )


@pytest.fixture(autouse=True)
def clear_cache():
    cmems._cache.clear()
    yield


# ── /api/waves/forecast ───────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_make_ds())
def test_forecast_returns_200(mock_ds):
    resp = client.get("/api/waves/forecast?lat=54.18&lon=12.08")
    assert resp.status_code == 200


@patch("copernicusmarine.open_dataset", return_value=_make_ds())
def test_forecast_schema(mock_ds):
    resp = client.get("/api/waves/forecast?lat=54.18&lon=12.08")
    body = resp.json()
    for key in ("hs_m", "vmdr_deg", "grid_lat", "grid_lon", "timestamp", "last_updated"):
        assert key in body, f"missing key: {key}"


@patch("copernicusmarine.open_dataset", return_value=_make_ds(hs=0.42, vmdr=225.0))
def test_forecast_values(mock_ds):
    resp = client.get("/api/waves/forecast?lat=54.18&lon=12.08")
    body = resp.json()
    assert abs(body["hs_m"] - 0.42) < 0.01
    assert abs(body["vmdr_deg"] - 225.0) < 0.1


@patch("copernicusmarine.open_dataset", return_value=_make_ds(land_mask=True))
def test_forecast_wet_cell_fallback(mock_ds):
    """Nearest cell is NaN — service should find a wet fallback, not error."""
    resp = client.get("/api/waves/forecast?lat=54.18&lon=12.08")
    assert resp.status_code == 200
    body = resp.json()
    # returned grid point should not be NaN
    assert not np.isnan(body["hs_m"])


def test_forecast_upstream_error():
    with patch("copernicusmarine.open_dataset", side_effect=RuntimeError("timeout")):
        resp = client.get("/api/waves/forecast?lat=54.18&lon=12.08")
    assert resp.status_code == 502
    assert "upstream error" in resp.json()["detail"]


# ── /api/waves/overlay ────────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_make_ds())
def test_overlay_returns_png(mock_ds):
    resp = client.get("/api/waves/overlay?west=9.5&south=53.5&east=15.0&north=56.0")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"


@patch("copernicusmarine.open_dataset", return_value=_make_ds())
def test_overlay_has_metadata_headers(mock_ds):
    resp = client.get("/api/waves/overlay?west=9.5&south=53.5&east=15.0&north=56.0")
    assert "x-bbox" in resp.headers
    assert "x-timestamp" in resp.headers
    assert "x-colorscale" in resp.headers


@patch("copernicusmarine.open_dataset", return_value=_make_ds())
def test_overlay_colorscale_header(mock_ds):
    import json
    resp = client.get("/api/waves/overlay?west=9.5&south=53.5&east=15.0&north=56.0")
    cs = json.loads(resp.headers["x-colorscale"])
    assert "vmin" in cs and "vmax" in cs and "cmap" in cs


@patch("copernicusmarine.open_dataset", return_value=_make_ds())
def test_overlay_is_valid_png(mock_ds):
    resp = client.get("/api/waves/overlay?west=9.5&south=53.5&east=15.0&north=56.0")
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic bytes
