import httpx
from fastapi import APIRouter, HTTPException

from boatops.services import meteoalarm, openmeteo

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/forecast")
def get_forecast(lat: float, lon: float):
    try:
        return openmeteo.get_forecast(lat, lon)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


@router.get("/advisories")
def get_advisories(country: str = "DE"):
    try:
        return meteoalarm.get_advisories(country)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
