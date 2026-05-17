import httpx
from fastapi import APIRouter, HTTPException

from boatops.services import meteoalarm, openmeteo

router = APIRouter(prefix="/api/weather", tags=["weather"])

_MAX_BBOX_SPAN = 30.0   # degrees — prevents grid explosion
_MIN_STEP      = 0.1    # degrees — prevents million-point grids


def _validate_bbox_and_step(west: float, south: float, east: float, north: float, step: float) -> None:
    if east <= west or north <= south:
        raise HTTPException(status_code=422, detail="bbox must have positive width and height")
    if (east - west) > _MAX_BBOX_SPAN or (north - south) > _MAX_BBOX_SPAN:
        raise HTTPException(status_code=422, detail=f"bbox span must be ≤{_MAX_BBOX_SPAN}°")
    if step < _MIN_STEP:
        raise HTTPException(status_code=422, detail=f"step must be ≥{_MIN_STEP}°")


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
    hour: int | None = None,
):
    _validate_bbox_and_step(west, south, east, north, step)
    try:
        return openmeteo.get_wind_grid(west, south, east, north, step, hour)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


@router.get("/advisories")
def get_advisories(country: str = "DE"):
    try:
        return meteoalarm.get_advisories(country)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
