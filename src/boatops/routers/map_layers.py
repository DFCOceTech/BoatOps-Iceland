import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from boatops.services import cmems

router = APIRouter(prefix="/api/map", tags=["map"])

BBOX_PARAMS = "west: float, south: float, east: float, north: float"


def _png_response(fn, bbox: tuple) -> Response:
    try:
        png, meta = fn(bbox)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
    west, south, east, north = bbox
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Bbox": f"{west},{south},{east},{north}",
            "X-Timestamp": meta.get("timestamp") or "",
            "X-Colorscale": json.dumps(meta.get("colorscale", {})),
        },
    )


@router.get("/bathymetry")
def get_bathymetry(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_bathymetry_overlay, (west, south, east, north))


@router.get("/sst")
def get_sst(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_sst_overlay, (west, south, east, north))


@router.get("/salinity")
def get_salinity(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_salinity_overlay, (west, south, east, north))


@router.get("/currents")
def get_currents(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_currents_overlay, (west, south, east, north))


@router.get("/chlorophyll")
def get_chlorophyll(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_chlorophyll_overlay, (west, south, east, north))


@router.get("/oxygen")
def get_oxygen(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_oxygen_overlay, (west, south, east, north))
