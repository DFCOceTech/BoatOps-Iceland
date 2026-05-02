from fastapi import APIRouter

router = APIRouter(prefix="/api/map", tags=["map"])


@router.get("/bathymetry")
async def get_bathymetry(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-06


@router.get("/sst")
async def get_sst(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-06


@router.get("/salinity")
async def get_salinity(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-06


@router.get("/currents")
async def get_currents(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-06


@router.get("/chlorophyll")
async def get_chlorophyll(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-06


@router.get("/oxygen")
async def get_oxygen(west: float, south: float, east: float, north: float):
    raise NotImplementedError  # S02-06
