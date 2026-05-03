"""CMEMS data services — wave forecast, raster overlays.

All ``open_dataset`` calls are synchronous (copernicusmarine is not async-native).
Route handlers should call these from sync endpoints or via run_in_threadpool.
"""
from datetime import datetime, timezone

import cachetools
import cmocean
import copernicusmarine
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LogNorm

from boatops.cache import make_cache
from boatops.utils.raster import to_png_bytes, to_quiver_png_bytes

_cache, _lock = make_cache(ttl_seconds=3600)        # 1 h  — oceanographic layers
_bathy_cache, _bathy_lock = make_cache(ttl_seconds=86400)  # 24 h — static bathymetry

WAVE_DATASET   = "cmems_mod_bal_wav_anfc_PT1H-i"
STATIC_DATASET = "cmems_mod_bal_phy_anfc_static"
PHY_DATASET    = "cmems_mod_bal_phy_anfc_P1D-m"
SST_DATASET    = "DMI-BALTIC-SST-L4-NRT-OBS_FULL_TIME_SERIE"
BGC_DATASET    = "cmems_mod_bal_bgc_anfc_P1D-m"


# ── internal helpers ──────────────────────────────────────────────────────────

def _now_naive() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(timezone.utc)).tz_localize(None)


def _t_idx(ds) -> int:
    return int(np.argmin(np.abs(pd.to_datetime(ds.time.values) - _now_naive())))


def _nearest_wet_cell(ds, lat: float, lon: float, var: str) -> tuple[float, float]:
    """Return (lat, lon) of the nearest non-NaN grid cell for the given variable."""
    arr = ds[var]
    if "time" in arr.dims:
        arr = arr.mean(dim="time")
    if "depth" in arr.dims:
        arr = arr.isel(depth=0)
    wet = ~np.isnan(arr.values)
    lats2d, lons2d = np.meshgrid(ds.latitude.values, ds.longitude.values, indexing="ij")
    dist = (lats2d - lat) ** 2 + (lons2d - lon) ** 2
    dist[~wet] = np.inf
    flat = int(np.argmin(dist))
    return (
        float(ds.latitude.values[flat // len(ds.longitude)]),
        float(ds.longitude.values[flat % len(ds.longitude)]),
    )


# ── public API ────────────────────────────────────────────────────────────────

@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_wave_point(lat: float, lon: float) -> dict:
    """Current Hs and wave direction at (lat, lon) with nearest-wet-cell fallback."""
    pad = 0.6
    ds = copernicusmarine.open_dataset(
        dataset_id=WAVE_DATASET,
        variables=["VHM0", "VMDR"],
        minimum_longitude=lon - pad,
        maximum_longitude=lon + pad,
        minimum_latitude=lat - pad,
        maximum_latitude=lat + pad,
    )
    hs_test = ds["VHM0"].sel(latitude=lat, longitude=lon, method="nearest")
    if float(np.isnan(hs_test.values).mean()) > 0.5:
        glat, glon = _nearest_wet_cell(ds, lat, lon, var="VHM0")
    else:
        glat = float(hs_test.latitude)
        glon = float(hs_test.longitude)

    ti = _t_idx(ds)
    hs_pt = ds["VHM0"].sel(latitude=glat, longitude=glon, method="nearest")
    vmdr_pt = ds["VMDR"].sel(latitude=glat, longitude=glon, method="nearest")

    return {
        "hs_m": round(float(hs_pt.values[ti]), 3),
        "vmdr_deg": round(float(vmdr_pt.values[ti]), 1),
        "grid_lat": glat,
        "grid_lon": glon,
        "timestamp": str(ds.time.values[ti])[:16],
        "last_updated": str(pd.to_datetime(ds.time.values[-1]))[:16],
    }


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_wave_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Current Hs field as RGBA PNG bytes + metadata dict."""
    west, south, east, north = bbox
    ds = copernicusmarine.open_dataset(
        dataset_id=WAVE_DATASET,
        variables=["VHM0"],
        minimum_longitude=west,
        maximum_longitude=east,
        minimum_latitude=south,
        maximum_latitude=north,
    )
    ti = _t_idx(ds)
    hs = ds["VHM0"].isel(time=ti).values.astype(float)
    lats = ds.latitude.values
    timestamp = str(ds.time.values[ti])[:16]

    png = to_png_bytes(hs, lats, cmocean.cm.amp, plt.Normalize(vmin=0, vmax=2.5))
    meta = {
        "bbox": list(bbox),
        "timestamp": timestamp,
        "colorscale": {"vmin": 0.0, "vmax": 2.5, "cmap": "cmocean.amp"},
    }
    return png, meta


# ── map layer overlays ────────────────────────────────────────────────────────

@cachetools.cached(cache=_bathy_cache, lock=_bathy_lock, key=cachetools.keys.hashkey)
def get_bathymetry_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Marine-only bathymetry (deptho, m) — land cells are NaN → transparent."""
    west, south, east, north = bbox
    ds = copernicusmarine.open_dataset(
        dataset_id=STATIC_DATASET, variables=["deptho"],
        minimum_longitude=west, maximum_longitude=east,
        minimum_latitude=south, maximum_latitude=north,
    )
    deptho = ds["deptho"].values.astype(float)
    lats = ds.latitude.values
    vmax = float(np.nanmax(deptho))
    png = to_png_bytes(deptho, lats, cmocean.cm.deep, plt.Normalize(vmin=0, vmax=vmax))
    return png, {"bbox": list(bbox), "timestamp": None,
                 "colorscale": {"vmin": 0.0, "vmax": round(vmax, 1), "cmap": "cmocean.deep"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_sst_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """SST L4 (°C) — DMI NRT product, cmocean.thermal 4–20 °C."""
    west, south, east, north = bbox
    ds = copernicusmarine.open_dataset(
        dataset_id=SST_DATASET, variables=["analysed_sst"],
        minimum_longitude=west, maximum_longitude=east,
        minimum_latitude=south, maximum_latitude=north,
    )
    ti = _t_idx(ds)
    sst = ds["analysed_sst"].isel(time=ti).values.astype(float) - 273.15
    lats = ds.latitude.values
    timestamp = str(ds.time.values[ti])[:16]
    png = to_png_bytes(sst, lats, cmocean.cm.thermal, plt.Normalize(vmin=4, vmax=20))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": 4.0, "vmax": 20.0, "cmap": "cmocean.thermal"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_salinity_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Surface salinity (PSU, depth[0]) — cmocean.haline 0–25 PSU."""
    west, south, east, north = bbox
    ds = copernicusmarine.open_dataset(
        dataset_id=PHY_DATASET, variables=["so"],
        minimum_longitude=west, maximum_longitude=east,
        minimum_latitude=south, maximum_latitude=north,
        minimum_depth=0.0, maximum_depth=2.0,
    )
    ti = _t_idx(ds)
    sal = ds["so"].isel(time=ti, depth=0).values.astype(float)
    lats = ds.latitude.values
    timestamp = str(ds.time.values[ti])[:16]
    png = to_png_bytes(sal, lats, cmocean.cm.haline, plt.Normalize(vmin=0, vmax=25))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": 0.0, "vmax": 25.0, "cmap": "cmocean.haline"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_currents_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Surface current quiver (depth[0]) — cmocean.speed, max 0.5 m/s."""
    west, south, east, north = bbox
    ds = copernicusmarine.open_dataset(
        dataset_id=PHY_DATASET, variables=["uo", "vo"],
        minimum_longitude=west, maximum_longitude=east,
        minimum_latitude=south, maximum_latitude=north,
        minimum_depth=0.0, maximum_depth=2.0,
    )
    ti = _t_idx(ds)
    u = ds["uo"].isel(time=ti, depth=0).values.astype(float)
    v = ds["vo"].isel(time=ti, depth=0).values.astype(float)
    lats = ds.latitude.values
    lons = ds.longitude.values
    timestamp = str(ds.time.values[ti])[:16]
    png = to_quiver_png_bytes(lons, lats, u, v, cmap=cmocean.cm.speed, speed_max=0.5)
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": 0.0, "vmax": 0.5, "cmap": "cmocean.speed"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_chlorophyll_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Surface chlorophyll-a (mg/m³, depth[0]) — cmocean.algae, log scale 0.1–50."""
    west, south, east, north = bbox
    ds = copernicusmarine.open_dataset(
        dataset_id=BGC_DATASET, variables=["chl"],
        minimum_longitude=west, maximum_longitude=east,
        minimum_latitude=south, maximum_latitude=north,
    )
    ti = _t_idx(ds)
    chl = ds["chl"].isel(time=ti, depth=0).values.astype(float)
    lats = ds.latitude.values
    timestamp = str(ds.time.values[ti])[:16]
    png = to_png_bytes(chl, lats, cmocean.cm.algae, LogNorm(vmin=0.1, vmax=50))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": 0.1, "vmax": 50.0, "cmap": "cmocean.algae",
                                "scale": "log"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_oxygen_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Bottom dissolved oxygen (mmol/m³) — cmocean.oxy 0–350; <63 = hypoxic."""
    west, south, east, north = bbox
    ds = copernicusmarine.open_dataset(
        dataset_id=BGC_DATASET, variables=["o2b"],
        minimum_longitude=west, maximum_longitude=east,
        minimum_latitude=south, maximum_latitude=north,
    )
    ti = _t_idx(ds)
    # o2b is pre-computed bottom value — no depth dimension
    o2b = ds["o2b"].isel(time=ti).values.astype(float)
    lats = ds.latitude.values
    timestamp = str(ds.time.values[ti])[:16]
    png = to_png_bytes(o2b, lats, cmocean.cm.oxy, plt.Normalize(vmin=0, vmax=350))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": 0.0, "vmax": 350.0, "cmap": "cmocean.oxy",
                                "hypoxia_threshold_mmol_m3": 63}}
