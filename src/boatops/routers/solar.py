from fastapi import APIRouter

router = APIRouter(prefix="/api/solar", tags=["solar"])


@router.get("/times")
async def get_times(lat: float, lon: float, date: str | None = None):
    raise NotImplementedError  # S02-04


@router.get("/elevation")
async def get_elevation(lat: float, lon: float):
    raise NotImplementedError  # S02-04
