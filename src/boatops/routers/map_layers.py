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


@router.get("/currents-grid")
def get_currents_grid(
    west: float = 9.5, south: float = 53.5,
    east: float = 15.0, north: float = 56.0,
    step: float = 0.25,
):
    try:
        return cmems.get_currents_grid(west, south, east, north, step)
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


@router.get("/gbif-tiles/{z}/{x}/{y}.png", response_class=Response)
def gbif_tile_proxy(z: int, x: int, y: int,
                    taxon_key: int, style: str = "classic.point",
                    bin: str | None = None, hex_per_tile: int = 10):
    """Proxy GBIF occurrence density tiles to avoid browser URL-encoding of @1x.png."""
    import httpx as _httpx
    params: dict = {"taxonKey": taxon_key, "style": style}
    if bin:
        params["bin"] = bin
        params["hexPerTile"] = hex_per_tile
    url = f"https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png"
    try:
        r = _httpx.get(url, params=params, timeout=10,
                       headers={"User-Agent": "BoatOps/1.0 (+https://github.com/DFCOceTech)"})
        r.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GBIF tile error: {exc}")
    return Response(content=r.content, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@router.get("/isobaths")
def get_isobaths(west: float, south: float, east: float, north: float):
    try:
        return cmems.get_isobaths((west, south, east, north))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"upstream error: {exc}")


@router.get("/chlorophyll")
def get_chlorophyll(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_chlorophyll_overlay, (west, south, east, north))


@router.get("/oxygen")
def get_oxygen(west: float, south: float, east: float, north: float):
    return _png_response(cmems.get_oxygen_overlay, (west, south, east, north))
