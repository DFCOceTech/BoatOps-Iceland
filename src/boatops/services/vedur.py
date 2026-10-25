"""Latest observations from nearby automatic weather stations.

Source: Icelandic Met Office open API (api.vedur.is, no key). The same feed carries the
Road Administration (Vegagerðin, the umferdin.is network) stations, so one call covers both.
Units: temperature °C, wind m/s, pressure hPa, humidity %, precipitation mm/h (as published).
"""
import math
from datetime import datetime, timezone

import cachetools
import httpx

from boatops.cache import make_cache

_BASE = "https://api.vedur.is/weather"
_HEADERS = {"User-Agent": "BoatOps-Iceland/0.1 (field-ops dashboard)"}
_stations_cache, _stations_lock = make_cache(ttl_seconds=86400, maxsize=2)
_obs_cache, _obs_lock = make_cache(ttl_seconds=120, maxsize=2)

_FIELDS = ("t", "f", "fg", "d", "d_txt", "p", "rh", "r")


@cachetools.cached(cache=_stations_cache, lock=_stations_lock, key=lambda: "stations")
def _stations() -> list[dict]:
    r = httpx.get(f"{_BASE}/stations", params={"active": "true", "station_type": "sj"},
                  headers=_HEADERS, timeout=20)
    r.raise_for_status()
    return r.json()


@cachetools.cached(cache=_obs_cache, lock=_obs_lock, key=lambda: "obs")
def _latest() -> dict[int, dict]:
    r = httpx.get(f"{_BASE}/observations/aws/10min/latest", headers=_HEADERS, timeout=20)
    r.raise_for_status()
    return {o["station"]: o for o in r.json()}


def _dist_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> tuple[float, float]:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    dist = 2 * 6371.0 * math.asin(math.sqrt(a))
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return dist, (math.degrees(math.atan2(y, x)) + 360) % 360


def nearby_stations(lat: float, lon: float, radius_km: float = 60, limit: int = 8,
                    now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    obs = _latest()
    out = []
    for s in _stations():
        o = obs.get(s["station"])
        if o is None or s.get("lat") is None or s.get("lon") is None:
            continue
        dist, brg = _dist_bearing(lat, lon, s["lat"], s["lon"])
        if dist > radius_km:
            continue
        if all(o.get(k) is None for k in ("t", "f", "p", "rh")):
            continue
        try:
            age = round((now - datetime.fromisoformat(o["time"]).replace(tzinfo=timezone.utc)).total_seconds() / 60)
        except (KeyError, ValueError):
            age = None
        out.append({
            "id": s["station"], "name": s["name"], "owner": s.get("owner"),
            "lat": s["lat"], "lon": s["lon"], "elevation_m": s.get("ele"),
            "distance_km": round(dist, 1), "bearing_deg": round(brg),
            "time": o.get("time"), "age_min": age,
            **{k: o.get(k) for k in _FIELDS},
        })
    out.sort(key=lambda x: x["distance_km"])
    return out[:limit]
