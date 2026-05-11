import math
from datetime import datetime, timezone

import cachetools
import httpx

from boatops.cache import make_cache

_cache, _lock           = make_cache(ttl_seconds=900)   # 15 min — matches Open-Meteo hourly cadence
_grid_cache, _grid_lock = make_cache(ttl_seconds=1800)  # 30 min — grid changes slowly

_BASE_URL = "https://api.open-meteo.com/v1/forecast"
_MS_TO_KT = 1.94384


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_forecast(lat: float, lon: float) -> dict:
    resp = httpx.get(
        _BASE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": (
                "wind_speed_10m,wind_direction_10m,wind_gusts_10m,"
                "temperature_2m,precipitation,cloudcover"
            ),
            "wind_speed_unit": "ms",
            "forecast_days": 7,
            "timezone": "UTC",
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    h = data["hourly"]

    def _kt(v):
        return round(v * _MS_TO_KT, 2) if v is not None else None

    return {
        "times": h["time"],
        "wind_speed_ms": h["wind_speed_10m"],
        "wind_speed_kt": [_kt(v) for v in h["wind_speed_10m"]],
        "wind_dir_deg": h["wind_direction_10m"],
        "gust_speed_ms": h["wind_gusts_10m"],
        "gust_speed_kt": [_kt(v) for v in h["wind_gusts_10m"]],
        "temperature_c": h["temperature_2m"],
        "precipitation_mm": h["precipitation"],
        "cloud_cover_pct": h["cloudcover"],
        "last_updated": f"generated_in_{data['generationtime_ms']:.1f}ms" if data.get("generationtime_ms") is not None else None,
    }


@cachetools.cached(cache=_grid_cache, lock=_grid_lock,
                   key=lambda west, south, east, north, step=0.25: cachetools.keys.hashkey(west, south, east, north, step))
def _fetch_wind_grid_raw(
    west: float, south: float, east: float, north: float,
    step: float = 0.25,
) -> dict:
    """Fetch 7-day U/V wind grid from Open-Meteo (inner cached function).

    Returns raw per-point hourly arrays so that get_wind_grid() can select
    any forecast hour (0–167) without re-fetching.
    """
    n_lons = round((east - west) / step) + 1
    n_lats = round((north - south) / step) + 1
    lats = [south + i * step for i in range(n_lats)]
    lons = [west  + j * step for j in range(n_lons)]

    lat_list = [lat for lat in lats for _lon in lons]
    lon_list = [lon for _lat in lats for lon in lons]

    resp = httpx.get(
        _BASE_URL,
        params={
            "latitude":  ",".join(f"{v:.4f}" for v in lat_list),
            "longitude": ",".join(f"{v:.4f}" for v in lon_list),
            "hourly":    "wind_u_component_10m,wind_v_component_10m",
            "forecast_days": 7,
            "timezone": "UTC",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict):
        data = [data]

    return {
        "u_all": [d["hourly"]["wind_u_component_10m"] for d in data],
        "v_all": [d["hourly"]["wind_v_component_10m"] for d in data],
        "times": data[0]["hourly"]["time"],
        "n_lons": n_lons,
        "n_lats": n_lats,
        "bbox": [west, south, east, north],
    }


_VMAX_WIND_CAP_MS = 20.0  # physical ceiling for color-scale — prevents hurricane colours dominating


def get_wind_grid(
    west: float, south: float, east: float, north: float,
    step: float = 0.25,
    hour: int | None = None,
) -> dict:
    """Return wind U/V grid for the requested forecast hour (0–167, default = current UTC hour).

    vmax_speed is capped at 20 m/s so the particle colour ramp covers operationally
    relevant wind speeds rather than stretching to rare extreme values.
    """
    raw = _fetch_wind_grid_raw(west, south, east, north, step)
    n_lons = raw["n_lons"]
    n_lats = raw["n_lats"]
    max_hours = len(raw["times"]) - 1

    if hour is None:
        hour_idx = datetime.now(timezone.utc).hour
    else:
        hour_idx = max(0, min(max_hours, int(hour)))

    u_flat = [u[hour_idx] or 0.0 for u in raw["u_all"]]
    v_flat = [v[hour_idx] or 0.0 for v in raw["v_all"]]

    u_grid = [[u_flat[i * n_lons + j] for j in range(n_lons)] for i in range(n_lats)]
    v_grid = [[v_flat[i * n_lons + j] for j in range(n_lons)] for i in range(n_lats)]

    speeds = [math.sqrt(u ** 2 + v ** 2) for u, v in zip(u_flat, v_flat)]
    vmax_speed = min(max(speeds) if speeds else 1.0, _VMAX_WIND_CAP_MS)

    timestamp = raw["times"][hour_idx] if hour_idx < len(raw["times"]) else ""

    return {
        "u": u_grid,
        "v": v_grid,
        "width": n_lons,
        "height": n_lats,
        "bbox": [west, south, east, north],
        "timestamp": timestamp,
        "vmax_speed": round(vmax_speed, 3),
    }
