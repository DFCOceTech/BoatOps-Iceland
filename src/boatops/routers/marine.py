import httpx
from fastapi import APIRouter, HTTPException

from boatops.services import marine

router = APIRouter(prefix="/api/marine", tags=["marine"])


@router.get("/forecast")
def get_marine_forecast(lat: float, lon: float):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="lat/lon out of range")
    try:
        return marine.get_marine_forecast(lat, lon)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
