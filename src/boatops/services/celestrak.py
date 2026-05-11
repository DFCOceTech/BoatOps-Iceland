"""CelesTrak TLE fetch + skyfield overpass prediction for Baltic AOI.

Gotcha (confirmed notebooks/04_satellite_overpasses.ipynb):
  - Use `if peak_t is not None:` not `if peak_t:` — Skyfield scalar Time
    raises TypeError on boolean evaluation.
  - Old CelesTrak endpoint satcat/tle.php deprecated; use gp.php?CATNR=...&FORMAT=tle
"""
import math
from datetime import datetime, timedelta, timezone

import cachetools
import numpy as np
import requests
from shapely.geometry import LineString, box
from skyfield.api import EarthSatellite, load, wgs84

from boatops.cache import make_cache

_cache, _lock = make_cache(ttl_seconds=3600, maxsize=32)  # 1 h for passes; TLEs ~24 h

_GP_URL = "https://celestrak.org/NORAD/elements/gp.php"

SATELLITE_CATALOG = {
    "Suomi-NPP (VIIRS)": 37849,
    "NOAA-20 (VIIRS)": 43013,
    "Landsat 8": 39084,
    "Landsat 9": 49260,
    "Sentinel-2A": 40697,
    "Sentinel-2B": 42063,
}

_ts = load.timescale()


def _fetch_tle(norad_id: int) -> tuple[str, str, str]:
    resp = requests.get(_GP_URL, params={"CATNR": norad_id, "FORMAT": "tle"}, timeout=15)
    resp.raise_for_status()
    lines = [l.strip() for l in resp.text.strip().splitlines() if l.strip()]
    if len(lines) != 3:
        raise ValueError(f"Expected 3 TLE lines for NORAD {norad_id}, got {len(lines)}")
    return lines[0], lines[1], lines[2]


def _predict_passes(
    satellite: EarthSatellite,
    observer,
    t_start,
    t_end,
    aoi_poly,
    platform_name: str,
) -> list[dict]:
    try:
        times, events = satellite.find_events(observer, t_start, t_end, altitude_degrees=0.0)
    except Exception:
        return []

    passes = []
    i = 0
    while i < len(events):
        if events[i] != 0:
            i += 1
            continue
        # AOS found — scan forward for peak (1) and LOS (2)
        aos_t = times[i]
        peak_t = None
        los_t = None
        for j in range(i + 1, min(i + 10, len(events))):
            if events[j] == 1:
                peak_t = times[j]
            if events[j] == 2:
                los_t = times[j]
                break
        if los_t is None:
            i += 1
            continue

        # Ground track — check AOI intersection
        n_steps = max(2, int((los_t - aos_t) * 86400 / 30))
        track_times = _ts.linspace(aos_t, los_t, n_steps)
        subpts = wgs84.subpoint_of(satellite.at(track_times))
        track = LineString(zip(subpts.longitude.degrees, subpts.latitude.degrees))
        if not track.intersects(aoi_poly):
            i += 1
            continue

        # Peak elevation
        if peak_t is not None:  # must use `is not None`, not truthiness check
            alt, *_ = (satellite - observer).at(peak_t).altaz()
            peak_elev = float(alt.degrees)
        else:
            peak_elev = float("nan")

        aos_dt = aos_t.utc_datetime()
        los_dt = los_t.utc_datetime()
        track_coords = [
            [round(float(lon), 4), round(float(lat), 4)]
            for lon, lat in zip(subpts.longitude.degrees, subpts.latitude.degrees)
        ]
        passes.append({
            "platform": platform_name,
            "aos_utc": aos_dt.isoformat(),
            "los_utc": los_dt.isoformat(),
            "max_elevation_deg": round(peak_elev, 1),
            "duration_min": round((los_dt - aos_dt).total_seconds() / 60, 1),
            "track_coords": track_coords,
        })
        i = j + 1

    return passes


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_overpasses(bbox: tuple, days: int = 7) -> list[dict]:
    """Return predicted overpasses of all catalog satellites over bbox for the next `days` days."""
    west, south, east, north = bbox
    center_lat = (south + north) / 2
    center_lon = (west + east) / 2
    aoi_poly = box(west, south, east, north)
    observer = wgs84.latlon(center_lat, center_lon)

    now = datetime.now(timezone.utc)
    t_start = _ts.from_datetime(now)
    t_end = _ts.from_datetime(now + timedelta(days=days))

    all_passes = []
    for name, norad_id in SATELLITE_CATALOG.items():
        try:
            _, line1, line2 = _fetch_tle(norad_id)
            sat = EarthSatellite(line1, line2, name, _ts)
            passes = _predict_passes(sat, observer, t_start, t_end, aoi_poly, name)
            all_passes.extend(passes)
        except Exception:
            continue  # skip platform if TLE unavailable

    return sorted(all_passes, key=lambda p: p["aos_utc"])
