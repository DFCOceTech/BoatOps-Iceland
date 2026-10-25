import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from boatops.config import settings
from boatops.services import cdse_auth, celestrak, sentinel_hub

router = APIRouter(prefix="/api/satellite", tags=["satellite"])

_MAX_BBOX_SPAN = 2.0   # degrees — imagery is for a work-site, not a region


@router.get("/overpasses")
def get_overpasses(west: float, south: float, east: float, north: float, days: int = 7):
    try:
        return celestrak.get_overpasses((west, south, east, north), days)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


def _validate_bbox(west: float, south: float, east: float, north: float) -> tuple:
    if east <= west or north <= south:
        raise HTTPException(status_code=422, detail="bbox must have positive width and height")
    if (east - west) > _MAX_BBOX_SPAN or (north - south) > _MAX_BBOX_SPAN:
        raise HTTPException(status_code=422, detail=f"bbox span must be ≤{_MAX_BBOX_SPAN}°")
    # Round so slightly different viewports share a cache entry
    return (round(west, 3), round(south, 3), round(east, 3), round(north, 3))


@router.get("/s2-overlay")
def get_s2_overlay(west: float, south: float, east: float, north: float,
                   cloud_max: float = 20.0, days_back: int = Query(30, ge=1, le=90)):
    bbox = _validate_bbox(west, south, east, north)
    if not settings.cdse_email or not settings.cdse_password:
        raise HTTPException(status_code=503, detail="CDSE credentials not configured")
    try:
        token = cdse_auth.get_token(settings.cdse_email, settings.cdse_password)
        png, meta = sentinel_hub.get_s2_overlay(token, bbox, cloud_max, days_back)
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Bbox": ",".join(str(v) for v in bbox),
            "X-Scene-Id": meta.get("scene_id", ""),
            "X-Acquisition-Time": meta.get("acquisition_time", ""),
            "X-Cloud-Cover": str(meta.get("cloud_cover_pct", "")),
        },
    )


@router.get("/s1-overlay")
def get_s1_overlay(west: float, south: float, east: float, north: float,
                   days_back: int = Query(7, ge=1, le=30)):
    bbox = _validate_bbox(west, south, east, north)
    if not settings.cdse_email or not settings.cdse_password:
        raise HTTPException(status_code=503, detail="CDSE credentials not configured")
    try:
        token = cdse_auth.get_token(settings.cdse_email, settings.cdse_password)
        png, meta = sentinel_hub.get_s1_overlay(token, bbox, days_back)
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Bbox": ",".join(str(v) for v in bbox),
            "X-Scene-Id": meta.get("scene_id", ""),
            "X-Acquisition-Time": meta.get("acquisition_time", ""),
        },
    )
