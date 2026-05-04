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


@cachetools.cached(cache=_grid_cache, lock=_grid_lock, key=cachetools.keys.hashkey)
def get_wind_grid(
    west: float, south: float, east: float, north: float,
    step: float = 0.25,
) -> dict:
    """Fetch U/V wind components on a regular grid using Open-Meteo batch API.

    Returns a 2D grid shaped [row][col] where row 0 = southernmost latitude,
    col 0 = westernmost longitude.  U = eastward m/s, V = northward m/s.
    vmax_speed = sqrt(max(u²+v²)) across the grid — used by the frontend for
    autoscaling the particle color ramp to the actual data range.
    """
    n_lons = round((east - west) / step) + 1
    n_lats = round((north - south) / step) + 1
    lats = [south + i * step for i in range(n_lats)]
    lons = [west  + j * step for j in range(n_lons)]

    # Flatten grid into parallel lat/lon lists for the batch request
    lat_list = [lat for lat in lats for _lon in lons]
    lon_list = [lon for _lat in lats for lon in lons]

    resp = httpx.get(
        _BASE_URL,
        params={
            "latitude":  ",".join(f"{v:.4f}" for v in lat_list),
            "longitude": ",".join(f"{v:.4f}" for v in lon_list),
            "hourly":    "wind_u_component_10m,wind_v_component_10m",
            "forecast_days": 1,
            "timezone": "UTC",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict):   # single point returns dict, multiple returns list
        data = [data]

    now_hour = datetime.now(timezone.utc).hour
    u_flat = [d["hourly"]["wind_u_component_10m"][now_hour] or 0.0 for d in data]
    v_flat = [d["hourly"]["wind_v_component_10m"][now_hour] or 0.0 for d in data]

    u_grid = [[u_flat[i * n_lons + j] for j in range(n_lons)] for i in range(n_lats)]
    v_grid = [[v_flat[i * n_lons + j] for j in range(n_lons)] for i in range(n_lats)]

    speeds = [math.sqrt(u ** 2 + v ** 2) for u, v in zip(u_flat, v_flat)]
    vmax_speed = max(speeds) if speeds else 1.0

    return {
        "u": u_grid,
        "v": v_grid,
        "width": n_lons,
        "height": n_lats,
        "bbox": [west, south, east, north],
        "timestamp": datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat(),
        "vmax_speed": round(vmax_speed, 3),
    }
