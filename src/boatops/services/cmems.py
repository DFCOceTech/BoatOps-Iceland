"""CMEMS data services — wave forecast, raster overlays.

All ``open_dataset`` calls are synchronous (copernicusmarine is not async-native).
Route handlers should call these from sync endpoints or via run_in_threadpool.
"""
import json
from datetime import datetime, timezone

import cachetools
import cmocean
import copernicusmarine
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from boatops.cache import make_cache
from boatops.utils.raster import to_png_bytes, to_quiver_png_bytes

_cache, _lock = make_cache(ttl_seconds=3600)  # 1 hour — matches CMEMS update cadence

WAVE_DATASET = "cmems_mod_bal_wav_anfc_PT1H-i"


# ── internal helpers ──────────────────────────────────────────────────────────

def _now_naive() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(timezone.utc)).tz_localize(None)


def _t_idx(ds) -> int:
    return int(np.argmin(np.abs(pd.to_datetime(ds.time.values) - _now_naive())))


def _nearest_wet_cell(ds, lat: float, lon: float) -> tuple[float, float]:
    """Return (lat, lon) of the nearest non-NaN grid cell."""
    hs_mean = ds["VHM0"].mean(dim="time")
    wet = ~np.isnan(hs_mean.values)
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
        glat, glon = _nearest_wet_cell(ds, lat, lon)
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
