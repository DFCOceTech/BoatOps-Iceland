import math

import httpx
from fastapi import APIRouter, HTTPException, Query

from boatops.services import vedur

router = APIRouter(prefix="/api/stations", tags=["stations"])


@router.get("/nearby")
def get_nearby_stations(lat: float, lon: float, radius_km: float = Query(60, ge=5, le=150)):
    if not math.isfinite(radius_km):
        raise HTTPException(status_code=422, detail="radius_km must be finite")
    if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="lat/lon out of range")
    try:
        return {"stations": vedur.nearby_stations(lat, lon, radius_km)}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc.response.status_code}")
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
