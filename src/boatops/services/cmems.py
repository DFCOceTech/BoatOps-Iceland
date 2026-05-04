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

    vmax = float(np.nanpercentile(hs[~np.isnan(hs)], 99)) if np.any(~np.isnan(hs)) else 2.5
    vmax = max(vmax, 0.1)   # never collapse to a zero range
    png = to_png_bytes(hs, lats, cmocean.cm.amp, plt.Normalize(vmin=0, vmax=vmax))
    meta = {
        "bbox": list(bbox),
        "timestamp": timestamp,
        "colorscale": {"vmin": 0.0, "vmax": round(vmax, 2), "cmap": "cmocean.amp"},
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
    """SST L4 (°C) — DMI NRT product, autoscaled to actual data range."""
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
    vmin = round(float(np.nanpercentile(sst, 2)),  1)
    vmax = round(float(np.nanpercentile(sst, 98)), 1)
    if vmax <= vmin:
        vmax = vmin + 1.0
    png = to_png_bytes(sst, lats, cmocean.cm.thermal, plt.Normalize(vmin=vmin, vmax=vmax))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": vmin, "vmax": vmax, "cmap": "cmocean.thermal"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_salinity_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Surface salinity (PSU, depth[0]) — autoscaled to actual data range."""
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
    vmin = round(float(np.nanpercentile(sal, 2)),  1)
    vmax = round(float(np.nanpercentile(sal, 98)), 1)
    if vmax <= vmin:
        vmax = vmin + 1.0
    png = to_png_bytes(sal, lats, cmocean.cm.haline, plt.Normalize(vmin=vmin, vmax=vmax))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": vmin, "vmax": vmax, "cmap": "cmocean.haline"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_currents_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Surface current quiver (depth[0]) — autoscaled, hard cap 1.5 m/s.

    CMEMS model output can contain fill-value artefacts near land/boundaries
    that survive masking and inflate the naive nanmax.  Using the 99.5th
    percentile and capping at 1.5 m/s gives a physically realistic scale
    (Baltic surface currents are typically 0–0.5 m/s, seldom exceed 1 m/s).
    """
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

    speed = np.sqrt(u ** 2 + v ** 2)
    valid = speed[~np.isnan(speed)]
    speed_max = float(np.nanpercentile(valid, 99.5)) if valid.size else 0.5
    speed_max = min(speed_max, 1.5)   # physical cap — 4–20 m/s values are artefacts
    speed_max = max(speed_max, 0.05)  # never collapse to a zero range

    png = to_quiver_png_bytes(lons, lats, u, v, cmap=cmocean.cm.speed, speed_max=speed_max)
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": 0.0, "vmax": round(speed_max, 2),
                                "cmap": "cmocean.speed"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_chlorophyll_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Surface chlorophyll-a (mg/m³, depth[0]) — log scale, autoscaled."""
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
    pos = chl[chl > 0]
    vmin = max(float(np.nanpercentile(pos, 2)),  0.001) if pos.size else 0.1
    vmax = max(float(np.nanpercentile(pos, 98)), vmin * 10) if pos.size else 50.0
    png = to_png_bytes(chl, lats, cmocean.cm.algae, LogNorm(vmin=vmin, vmax=vmax))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": round(vmin, 3), "vmax": round(vmax, 1),
                                "cmap": "cmocean.algae", "scale": "log"}}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_oxygen_overlay(bbox: tuple) -> tuple[bytes, dict]:
    """Bottom dissolved oxygen (mmol/m³) — autoscaled; <63 = hypoxic."""
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
    vmin = max(0.0, round(float(np.nanpercentile(o2b, 2)),  1))
    vmax =         round(float(np.nanpercentile(o2b, 98)), 1)
    if vmax <= vmin:
        vmax = vmin + 10.0
    png = to_png_bytes(o2b, lats, cmocean.cm.oxy, plt.Normalize(vmin=vmin, vmax=vmax))
    return png, {"bbox": list(bbox), "timestamp": timestamp,
                 "colorscale": {"vmin": vmin, "vmax": vmax, "cmap": "cmocean.oxy",
                                "hypoxia_threshold_mmol_m3": 63}}
