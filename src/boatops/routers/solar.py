from datetime import date

from fastapi import APIRouter, HTTPException

from boatops.services import solar

router = APIRouter(prefix="/api/solar", tags=["solar"])


@router.get("/times")
def get_times(lat: float, lon: float, date: date | None = None):
    try:
        return solar.get_solar_times(lat, lon, date)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/elevation")
def get_elevation(lat: float, lon: float):
    try:
        return solar.get_solar_elevation(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
