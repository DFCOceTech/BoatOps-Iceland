from fastapi import APIRouter

router = APIRouter(prefix="/api/satellite", tags=["satellite"])


@router.get("/overpasses")
async def get_overpasses(west: float, south: float, east: float, north: float, days: int = 7):
    raise NotImplementedError  # S02-05


@router.get("/s2-overlay")
async def get_s2_overlay(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-05
