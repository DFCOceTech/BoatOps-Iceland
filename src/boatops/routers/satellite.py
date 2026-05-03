import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from boatops.config import settings
from boatops.services import cdse_auth, celestrak, sentinel_hub

router = APIRouter(prefix="/api/satellite", tags=["satellite"])


@router.get("/overpasses")
def get_overpasses(west: float, south: float, east: float, north: float, days: int = 7):
    try:
        return celestrak.get_overpasses((west, south, east, north), days)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


@router.get("/s2-overlay")
def get_s2_overlay(west: float, south: float, east: float, north: float,
                   cloud_max: float = 20.0):
    if not settings.cdse_email or not settings.cdse_password:
        raise HTTPException(status_code=503, detail="CDSE credentials not configured")
    try:
        token = cdse_auth.get_token(settings.cdse_email, settings.cdse_password)
        png, meta = sentinel_hub.get_s2_overlay(token, (west, south, east, north), cloud_max)
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Bbox": f"{west},{south},{east},{north}",
            "X-Scene-Id": meta.get("scene_id", ""),
            "X-Acquisition-Time": meta.get("acquisition_time", ""),
            "X-Cloud-Cover": str(meta.get("cloud_cover_pct", "")),
        },
    )
