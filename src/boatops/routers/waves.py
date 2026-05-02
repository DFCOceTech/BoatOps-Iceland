from fastapi import APIRouter

router = APIRouter(prefix="/api/waves", tags=["waves"])


@router.get("/forecast")
async def get_forecast(lat: float, lon: float):
    raise NotImplementedError  # S02-03


@router.get("/overlay")
async def get_overlay(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-03
