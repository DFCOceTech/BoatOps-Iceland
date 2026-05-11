import json
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
import xarray as xr
from fastapi.testclient import TestClient

from boatops.main import app
from boatops.services import cmems

client = TestClient(app)
BBOX_QS = "west=9.5&south=53.5&east=15.0&north=56.0"


# ── synthetic dataset factories ───────────────────────────────────────────────

def _static_ds(ny=8, nx=10) -> xr.Dataset:
    """Mimics cmems_mod_bal_phy_anfc_static (no time dim)."""
    lats = np.linspace(53.5, 56.0, ny)
    lons = np.linspace(9.5, 15.0, nx)
    deptho = np.full((ny, nx), 25.0)
    deptho[ny // 2, nx // 2] = np.nan   # one land cell
    return xr.Dataset(
        {"deptho": (["latitude", "longitude"], deptho)},
        coords={"latitude": lats, "longitude": lons},
    )


def _isobath_ds(ny=12, nx=15) -> xr.Dataset:
    """Static dataset with depth varying 0–200 m (crosses 10, 25, 100 m contours)."""
    lats = np.linspace(53.5, 56.0, ny)
    lons = np.linspace(9.5, 15.0, nx)
    # Ramp from 0 (top-left) to 200 (bottom-right)
    LON, LAT = np.meshgrid(np.linspace(0, 1, nx), np.linspace(0, 1, ny))
    deptho = (LON * LAT * 200.0).astype(float)
    deptho[0, 0] = np.nan   # one land cell
    return xr.Dataset(
        {"deptho": (["latitude", "longitude"], deptho)},
        coords={"latitude": lats, "longitude": lons},
    )


def _timed_ds(var_spec: dict, ny=8, nx=10, n_times=4) -> xr.Dataset:
    """Generic timed dataset — var_spec: {name: (dims, fill_value)}."""
    lats = np.linspace(53.5, 56.0, ny)
    lons = np.linspace(9.5, 15.0, nx)
    times = pd.date_range("2026-05-02", periods=n_times, freq="h")
    data_vars = {}
    for name, (dims, val) in var_spec.items():
        shape = tuple(
            n_times if d == "time" else ny if d == "latitude" else
            nx if d == "longitude" else 2 for d in dims
        )
        data_vars[name] = (dims, np.full(shape, val, dtype=float))
    coords = {"time": times, "latitude": lats, "longitude": lons}
    if any("depth" in spec[0] for spec in var_spec.values()):
        coords["depth"] = [0.5, 1.5]
    return xr.Dataset(data_vars, coords=coords)


def _phy_ds():
    return _timed_ds({
        "so": (["time", "depth", "latitude", "longitude"], 8.0),
        "uo": (["time", "depth", "latitude", "longitude"], 0.1),
        "vo": (["time", "depth", "latitude", "longitude"], 0.05),
    })


def _sst_ds():
    return _timed_ds({"analysed_sst": (["time", "latitude", "longitude"], 283.15)})


def _bgc_ds():
    return _timed_ds({
        "chl":  (["time", "depth", "latitude", "longitude"], 2.0),
        "o2b":  (["time", "latitude", "longitude"], 150.0),
    })


@pytest.fixture(autouse=True)
def clear_caches():
    cmems._cache.clear()
    cmems._bathy_cache.clear()
    if hasattr(cmems, '_grid_cache'):
        cmems._grid_cache.clear()
    yield


# ── shared assertions ─────────────────────────────────────────────────────────

def _assert_png_response(resp):
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert "x-bbox" in resp.headers
    assert "x-colorscale" in resp.headers
    cs = json.loads(resp.headers["x-colorscale"])
    assert "vmin" in cs and "vmax" in cs and "cmap" in cs


# ── /api/map/isobaths ────────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_isobath_ds())
def test_isobaths_returns_feature_collection(mock_ds):
    resp = client.get(f"/api/map/isobaths?{BBOX_QS}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["type"] == "FeatureCollection"
    assert "features" in body


@patch("copernicusmarine.open_dataset", return_value=_isobath_ds())
def test_isobaths_feature_structure(mock_ds):
    resp = client.get(f"/api/map/isobaths?{BBOX_QS}")
    body = resp.json()
    # dataset spans 0–200 m → all three isobaths (10, 25, 100 m) must be present
    depth_values = {f["properties"]["depth_m"] for f in body["features"]}
    assert 10  in depth_values
    assert 25  in depth_values
    assert 100 in depth_values
    for f in body["features"]:
        assert f["geometry"]["type"] == "LineString"
        assert len(f["geometry"]["coordinates"]) >= 2


@patch("copernicusmarine.open_dataset", side_effect=RuntimeError("auth failed"))
def test_isobaths_502(mock_ds):
    resp = client.get(f"/api/map/isobaths?{BBOX_QS}")
    assert resp.status_code == 502


# ── /api/map/bathymetry ───────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_static_ds())
def test_bathymetry_png(mock_ds):
    _assert_png_response(client.get(f"/api/map/bathymetry?{BBOX_QS}"))


@patch("copernicusmarine.open_dataset", return_value=_static_ds())
def test_bathymetry_colorscale(mock_ds):
    resp = client.get(f"/api/map/bathymetry?{BBOX_QS}")
    cs = json.loads(resp.headers["x-colorscale"])
    assert cs["cmap"] == "cmocean.deep"
    assert cs["vmin"] == 0.0


@patch("copernicusmarine.open_dataset", side_effect=RuntimeError("auth failed"))
def test_bathymetry_502(mock_ds):
    resp = client.get(f"/api/map/bathymetry?{BBOX_QS}")
    assert resp.status_code == 502


# ── /api/map/sst ──────────────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_sst_ds())
def test_sst_png(mock_ds):
    _assert_png_response(client.get(f"/api/map/sst?{BBOX_QS}"))


@patch("copernicusmarine.open_dataset", return_value=_sst_ds())
def test_sst_colorscale(mock_ds):
    resp = client.get(f"/api/map/sst?{BBOX_QS}")
    cs = json.loads(resp.headers["x-colorscale"])
    assert cs["cmap"] == "cmocean.thermal"
    assert "vmin" in cs and "vmax" in cs
    assert cs["vmax"] > cs["vmin"]


# ── /api/map/salinity ─────────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_phy_ds())
def test_salinity_png(mock_ds):
    _assert_png_response(client.get(f"/api/map/salinity?{BBOX_QS}"))


@patch("copernicusmarine.open_dataset", return_value=_phy_ds())
def test_salinity_colorscale(mock_ds):
    resp = client.get(f"/api/map/salinity?{BBOX_QS}")
    cs = json.loads(resp.headers["x-colorscale"])
    assert cs["cmap"] == "cmocean.haline"


# ── /api/map/currents ─────────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_phy_ds())
def test_currents_png(mock_ds):
    _assert_png_response(client.get(f"/api/map/currents?{BBOX_QS}"))


@patch("copernicusmarine.open_dataset", return_value=_phy_ds())
def test_currents_colorscale(mock_ds):
    resp = client.get(f"/api/map/currents?{BBOX_QS}")
    cs = json.loads(resp.headers["x-colorscale"])
    assert cs["cmap"] == "cmocean.speed"
    assert cs["vmax"] > 0  # autoscaled; any positive cap is valid


# ── /api/map/chlorophyll ──────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_bgc_ds())
def test_chlorophyll_png(mock_ds):
    _assert_png_response(client.get(f"/api/map/chlorophyll?{BBOX_QS}"))


@patch("copernicusmarine.open_dataset", return_value=_bgc_ds())
def test_chlorophyll_log_scale(mock_ds):
    resp = client.get(f"/api/map/chlorophyll?{BBOX_QS}")
    cs = json.loads(resp.headers["x-colorscale"])
    assert cs.get("scale") == "log"
    assert cs["cmap"] == "cmocean.algae"


# ── /api/map/oxygen ───────────────────────────────────────────────────────────

@patch("copernicusmarine.open_dataset", return_value=_bgc_ds())
def test_oxygen_png(mock_ds):
    _assert_png_response(client.get(f"/api/map/oxygen?{BBOX_QS}"))


@patch("copernicusmarine.open_dataset", return_value=_bgc_ds())
def test_oxygen_hypoxia_threshold(mock_ds):
    resp = client.get(f"/api/map/oxygen?{BBOX_QS}")
    cs = json.loads(resp.headers["x-colorscale"])
    assert cs["cmap"] == "cmocean.oxy"
    assert cs["hypoxia_threshold_mmol_m3"] == 63
