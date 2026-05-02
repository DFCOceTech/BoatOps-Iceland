from fastapi import APIRouter

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/forecast")
async def get_forecast(lat: float, lon: float):
    raise NotImplementedError  # S02-02


@router.get("/advisories")
async def get_advisories(country: str = "DE"):
    raise NotImplementedError  # S02-02
