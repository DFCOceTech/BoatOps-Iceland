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


@router.get("/wind-grid")
def get_wind_grid(
    west: float = 9.5, south: float = 53.5,
    east: float = 15.0, north: float = 56.0,
    step: float = 0.25,
):
    try:
        return openmeteo.get_wind_grid(west, south, east, north, step)
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
