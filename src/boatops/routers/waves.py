import json

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from boatops.services import cmems

router = APIRouter(prefix="/api/waves", tags=["waves"])


@router.get("/forecast")
def get_forecast(lat: float, lon: float):
    try:
        return cmems.get_wave_point(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


@router.get("/overlay")
def get_overlay(west: float, south: float, east: float, north: float):
    try:
        png, meta = cmems.get_wave_overlay((west, south, east, north))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Bbox": f"{west},{south},{east},{north}",
            "X-Timestamp": meta.get("timestamp") or "",
            "X-Colorscale": json.dumps(meta.get("colorscale", {})),
        },
    )
