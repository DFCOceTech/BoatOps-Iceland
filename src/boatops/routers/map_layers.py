import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from boatops.services import cmems

router = APIRouter(prefix="/api/map", tags=["map"])

_MAX_BBOX_SPAN = 30.0
_MIN_STEP      = 0.1


def _validate_bbox(west: float, south: float, east: float, north: float) -> None:
    if east <= west or north <= south:
        raise HTTPException(status_code=422, detail="bbox must have positive width and height")
    if (east - west) > _MAX_BBOX_SPAN or (north - south) > _MAX_BBOX_SPAN:
        raise HTTPException(status_code=422, detail=f"bbox span must be ≤{_MAX_BBOX_SPAN}°")


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
    _validate_bbox(west, south, east, north)
    return _png_response(cmems.get_bathymetry_overlay, (west, south, east, north))


@router.get("/sst")
def get_sst(west: float, south: float, east: float, north: float):
    _validate_bbox(west, south, east, north)
    return _png_response(cmems.get_sst_overlay, (west, south, east, north))


@router.get("/salinity")
def get_salinity(west: float, south: float, east: float, north: float):
    _validate_bbox(west, south, east, north)
    return _png_response(cmems.get_salinity_overlay, (west, south, east, north))


@router.get("/currents")
def get_currents(west: float, south: float, east: float, north: float):
    _validate_bbox(west, south, east, north)
    return _png_response(cmems.get_currents_overlay, (west, south, east, north))


@router.get("/currents-grid")
def get_currents_grid(
    west: float = 9.5, south: float = 53.5,
    east: float = 15.0, north: float = 56.0,
    step: float = 0.25,
):
    _validate_bbox(west, south, east, north)
    if step < _MIN_STEP:
        raise HTTPException(status_code=422, detail=f"step must be ≥{_MIN_STEP}°")
    try:
        return cmems.get_currents_grid(west, south, east, north, step)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")



@router.get("/gbif-occurrences")
def get_gbif_occurrences(
    taxon_key: int,
    west: float = 9.5, south: float = 53.5,
    east: float = 15.0, north: float = 56.0,
    limit: int = 500,
):
    """Fetch GBIF occurrence records as GeoJSON FeatureCollection.

    Filters to field observations with valid coordinates and no flagged spatial
    issues — this significantly reduces records placed on land due to imprecise
    herbarium/museum specimen coordinates.
    """
    import httpx as _httpx
    try:
        # basisOfRecord must be repeated (not comma-joined) per GBIF API contract
        resp = _httpx.get(
            "https://api.gbif.org/v1/occurrence/search",
            params=[
                ("taxonKey",           taxon_key),
                ("decimalLongitude",   f"{west},{east}"),
                ("decimalLatitude",    f"{south},{north}"),
                ("hasGeospatialIssue", "false"),
                ("hasCoordinate",      "true"),
                ("basisOfRecord",      "HUMAN_OBSERVATION"),
                ("basisOfRecord",      "MACHINE_OBSERVATION"),
                ("limit",              min(limit, 500)),
            ],
            timeout=20,
            headers={"User-Agent": "BoatOps/1.0"},
        )
        resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GBIF error: {exc}")

    data = resp.json()
    features = []
    for r in data.get("results", []):
        lon = r.get("decimalLongitude")
        lat = r.get("decimalLatitude")
        if lon is None or lat is None:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "species":       r.get("species", ""),
                "date":          r.get("eventDate", ""),
                "recorded_by":   r.get("recordedBy", ""),
                "institution":   r.get("institutionCode", ""),
                "uncertainty_m": r.get("coordinateUncertaintyInMeters"),
                "dataset":       r.get("datasetName", ""),
            },
        })
    return {
        "type": "FeatureCollection",
        "features": features,
        "total_gbif": data.get("count", 0),
        "returned": len(features),
    }


@router.get("/isobaths")
def get_isobaths(west: float, south: float, east: float, north: float):
    _validate_bbox(west, south, east, north)
    try:
        return cmems.get_isobaths((west, south, east, north))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


@router.get("/chlorophyll")
def get_chlorophyll(west: float, south: float, east: float, north: float):
    _validate_bbox(west, south, east, north)
    return _png_response(cmems.get_chlorophyll_overlay, (west, south, east, north))


@router.get("/oxygen")
def get_oxygen(west: float, south: float, east: float, north: float):
    _validate_bbox(west, south, east, north)
    return _png_response(cmems.get_oxygen_overlay, (west, south, east, north))
