import cachetools
import httpx

from boatops.cache import make_cache

_cache, _lock = make_cache(ttl_seconds=900)  # 15 min — matches Open-Meteo hourly cadence

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
