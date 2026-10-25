"""Coastal sea level (tide + surge), wave height and SST from the Open-Meteo Marine API.

The model grid (~8 km) is the open Atlantic off the Breiðamerkursandur coast — it is a
reference for the *tidal phase and range at the lagoon outlet*, not a model of the
lagoon itself.
"""
import cachetools
import httpx

from boatops.cache import make_cache

_cache, _lock = make_cache(ttl_seconds=1800)

_BASE_URL = "https://marine-api.open-meteo.com/v1/marine"


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_marine_forecast(lat: float, lon: float) -> dict:
    resp = httpx.get(
        _BASE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": "sea_level_height_msl,wave_height,sea_surface_temperature",
            "forecast_days": 7,
            "timezone": "UTC",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    h = data["hourly"]
    return {
        "times": h["time"],
        "sea_level_m": h["sea_level_height_msl"],
        "wave_height_m": h["wave_height"],
        "sst_c": h["sea_surface_temperature"],
        "grid_lat": data.get("latitude"),
        "grid_lon": data.get("longitude"),
    }
