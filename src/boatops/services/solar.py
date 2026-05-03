"""Solar geometry service — suncalc wrapper.

Fully deterministic; no network calls; no caching needed.
Response time is <10 ms for all functions.

suncalc gotchas (confirmed in notebooks/03_solar.ipynb):
  - Argument order is (lng, lat), NOT (lat, lon).
  - altitude and azimuth are returned in radians.
  - Azimuth convention: south = 0; convert to north = 0 with (deg + 180) % 360.
  - Missing events (polar summer/winter) are pd.NaT — check with pd.isna().
"""
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd
import suncalc


def _to_iso_or_none(v) -> str | None:
    """Convert a suncalc timestamp (tz-naive pd.Timestamp) to ISO string, or None."""
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, pd.Timestamp):
        if v.tzinfo is None:
            v = v.tz_localize("UTC")
        return v.isoformat()
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()
    return None


def _classify_period(elevation_deg: float) -> str:
    if elevation_deg >= 0:
        return "day"
    if elevation_deg >= -6:
        return "civil_twilight"
    if elevation_deg >= -12:
        return "nautical_twilight"
    if elevation_deg >= -18:
        return "astronomical_twilight"
    return "night"


def get_solar_times(lat: float, lon: float, query_date: date | None = None) -> dict:
    """Return solar event times for a given date (defaults to today UTC).

    All times are ISO-8601 UTC strings; events that don't occur (polar day/night)
    are returned as null.
    """
    if query_date is None:
        query_date = datetime.now(timezone.utc).date()
    dt = datetime(query_date.year, query_date.month, query_date.day, tzinfo=timezone.utc)
    times = suncalc.get_times(dt, lon, lat)  # NOTE: (lng, lat)
    return {
        "date": query_date.isoformat(),
        "lat": lat,
        "lon": lon,
        "sunrise": _to_iso_or_none(times.get("sunrise")),
        "sunset": _to_iso_or_none(times.get("sunset")),
        "solar_noon": _to_iso_or_none(times.get("solar_noon")),
        "dawn_civil": _to_iso_or_none(times.get("dawn")),
        "dusk_civil": _to_iso_or_none(times.get("dusk")),
        "dawn_nautical": _to_iso_or_none(times.get("nautical_dawn")),
        "dusk_nautical": _to_iso_or_none(times.get("nautical_dusk")),
        "dawn_astronomical": _to_iso_or_none(times.get("night_end")),
        "dusk_astronomical": _to_iso_or_none(times.get("night")),
    }


def get_solar_elevation(lat: float, lon: float, dt: datetime | None = None) -> dict:
    """Return solar elevation and azimuth at a given UTC datetime (defaults to now).

    elevation_deg: degrees above horizon (negative = below)
    azimuth_deg:   degrees from north, clockwise (standard meteorological convention)
    is_daylight:   True when elevation >= 0
    period:        day / civil_twilight / nautical_twilight / astronomical_twilight / night
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    pos = suncalc.get_position(dt, lon, lat)  # NOTE: (lng, lat)
    elevation_deg = float(np.degrees(pos["altitude"]))
    azimuth_deg = float((np.degrees(pos["azimuth"]) + 180) % 360)
    return {
        "elevation_deg": round(elevation_deg, 4),
        "azimuth_deg": round(azimuth_deg, 4),
        "is_daylight": elevation_deg >= 0,
        "period": _classify_period(elevation_deg),
        "timestamp": dt.astimezone(timezone.utc).isoformat(),
    }
