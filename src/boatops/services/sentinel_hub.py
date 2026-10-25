"""Sentinel-1 / Sentinel-2 scene discovery (CDSE OData) + rendering (SH Process API).

Confirmed in notebooks/05_sentinel2_imagery.ipynb:
  - STAC at stac.dataspace.copernicus.eu/v1 does NOT contain Sentinel-2 — use OData.
  - SH Process API requires only a CDSE OAuth2 Bearer token (no separate instance ID).
  - Quicklook asset type is JPEG — use PIL, not direct PNG decode.
  - OData $expand=Attributes,Assets combined returns 400 — use separate requests.
"""
from datetime import datetime, timedelta, timezone

import cachetools
import httpx

from boatops.cache import make_cache

_cache, _lock = make_cache(ttl_seconds=3600)

_ODATA_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
_SH_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"

_TRUE_COLOUR_EVALSCRIPT = (
    "//VERSION=3\n"
    "function setup(){return{input:[\"B04\",\"B03\",\"B02\",\"dataMask\"],output:{bands:4}};}\n"
    "function evaluatePixel(s){return[3.5*s.B04,3.5*s.B03,3.5*s.B02,s.dataMask];}\n"
)


def _build_filter(bbox: tuple, cloud_max: float, days_back: int) -> str:
    west, south, east, north = bbox
    wkt = (
        f"POLYGON(({west} {south},{east} {south},"
        f"{east} {north},{west} {north},{west} {south}))"
    )
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days_back)
    return (
        f"Collection/Name eq 'SENTINEL-2' and "
        f"OData.CSC.Intersects(area=geography'SRID=4326;{wkt}') and "
        f"ContentDate/Start gt {start_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')} and "
        f"ContentDate/Start lt {end_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')} and "
        f"Attributes/OData.CSC.StringAttribute/any("
        f"att:att/Name eq 'productType' and "
        f"att/OData.CSC.StringAttribute/Value eq 'S2MSI2A') and "
        f"Attributes/OData.CSC.DoubleAttribute/any("
        f"att:att/Name eq 'cloudCover' and "
        f"att/OData.CSC.DoubleAttribute/Value lt {float(cloud_max)})"
    )


_SAR_EVALSCRIPT = (
    "//VERSION=3\n"
    "function setup(){return{input:[\"VV\",\"VH\",\"dataMask\"],output:{bands:4}};}\n"
    "function db(x){return Math.min(1,Math.max(0,(10*Math.log(Math.max(x,1e-5))/Math.LN10+25)/25));}\n"
    "function evaluatePixel(s){var vv=db(s.VV),vh=db(s.VH);return[vv,vh,vv*0.5+vh*0.5,s.dataMask];}\n"
)


def _build_s1_filter(bbox: tuple, days_back: int) -> str:
    west, south, east, north = bbox
    wkt = (
        f"POLYGON(({west} {south},{east} {south},"
        f"{east} {north},{west} {north},{west} {south}))"
    )
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days_back)
    # IW, dual-pol VV+VH GRD only: matches the Process API request (polarization DV) and evalscript.
    return (
        f"Collection/Name eq 'SENTINEL-1' and "
        f"OData.CSC.Intersects(area=geography'SRID=4326;{wkt}') and "
        f"ContentDate/Start gt {start_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')} and "
        f"ContentDate/Start lt {end_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')} and "
        f"contains(Name,'IW_GRDH_1SDV')"
    )


def find_best_s1_scene(token: str, bbox: tuple, days_back: int = 14) -> dict | None:
    """Return metadata for the most recent Sentinel-1 GRD scene over bbox, or None."""
    resp = httpx.get(
        _ODATA_URL,
        params={
            "$filter": _build_s1_filter(bbox, days_back),
            "$orderby": "ContentDate/Start desc",
            "$top": 1,
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    items = resp.json().get("value", [])
    if not items:
        return None
    best = items[0]
    acq_time = datetime.fromisoformat(best["ContentDate"]["Start"].replace("Z", "+00:00"))
    return {"scene_id": best["Name"], "acquisition_time": acq_time.isoformat(), "cloud_cover_pct": ""}


@cachetools.cached(
    cache=_cache, lock=_lock,
    key=lambda token, bbox, days_back=14: cachetools.keys.hashkey("s1", bbox, days_back),
)
def get_s1_overlay(token: str, bbox: tuple, days_back: int = 14) -> tuple[bytes, dict]:
    """Return (png_bytes, metadata) for the latest Sentinel-1 SAR scene over bbox.

    Radar sees through cloud and darkness — the primary layer for locating mobile ice.
    Colours: R=VV, G=VH (dB-scaled). Calm open water is dark; ice and rough water are bright.
    """
    scene = find_best_s1_scene(token, bbox, days_back)
    if scene is None:
        raise RuntimeError(f"No Sentinel-1 GRD scene found in last {days_back} days")

    acq = datetime.fromisoformat(scene["acquisition_time"])
    time_from = (acq - timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    time_to = (acq + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    west, south, east, north = bbox

    resp = httpx.post(
        _SH_URL,
        json={
            "input": {
                "bounds": {
                    "bbox": [west, south, east, north],
                    "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                },
                "data": [{
                    "type": "sentinel-1-grd",
                    "dataFilter": {"timeRange": {"from": time_from, "to": time_to}, "polarization": "DV"},
                    "processing": {"backCoeff": "SIGMA0_ELLIPSOID", "orthorectify": True},
                }],
            },
            "output": {
                "width": 512, "height": 512,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
            },
            "evalscript": _SAR_EVALSCRIPT,
        },
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, scene


def find_best_scene(token: str, bbox: tuple,
                    cloud_max: float = 20.0, days_back: int = 90) -> dict | None:
    """Return metadata for the most recent cloud-free L2A scene over bbox, or None."""
    resp = httpx.get(
        _ODATA_URL,
        params={
            "$filter": _build_filter(bbox, cloud_max, days_back),
            "$orderby": "ContentDate/Start desc",
            "$top": 5,
            "$expand": "Attributes",
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    items = resp.json().get("value", [])
    if not items:
        return None
    best = items[0]
    attrs = {a["Name"]: a.get("Value") for a in best.get("Attributes", [])}
    acq_time = datetime.fromisoformat(
        best["ContentDate"]["Start"].replace("Z", "+00:00")
    )
    return {
        "scene_id": best["Name"],
        "acquisition_time": acq_time.isoformat(),
        "cloud_cover_pct": float(attrs.get("cloudCover") or 0),
        "orbit": attrs.get("orbitNumber"),
        "tile_ref": attrs.get("tileId") or attrs.get("S2TileId"),
    }


# Phase 2 is single-tenant: all requests use the same server-side CDSE credentials,
# so token is always the same and must NOT be part of the cache key (it would defeat
# the 1-hour cache every time the 5-minute token is refreshed).
# Phase 3: if per-user auth is added, include a user_id in the key.
@cachetools.cached(
    cache=_cache, lock=_lock,
    key=lambda token, bbox, cloud_max=20.0, days_back=90: cachetools.keys.hashkey(bbox, cloud_max, days_back),
)
def get_s2_overlay(token: str, bbox: tuple,
                   cloud_max: float = 20.0, days_back: int = 90) -> tuple[bytes, dict]:
    """Return (png_bytes, metadata) for the best recent S2 true-colour scene over bbox."""
    scene = find_best_scene(token, bbox, cloud_max, days_back)
    if scene is None:
        raise RuntimeError(f"No Sentinel-2 L2A scene found with ≤{cloud_max}% cloud in last {days_back} days")

    acq = datetime.fromisoformat(scene["acquisition_time"])
    time_from = (acq - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    time_to = (acq + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    west, south, east, north = bbox

    resp = httpx.post(
        _SH_URL,
        json={
            "input": {
                "bounds": {
                    "bbox": [west, south, east, north],
                    "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {"from": time_from, "to": time_to},
                        "maxCloudCoverage": cloud_max,
                    },
                }],
            },
            "output": {
                "width": 512, "height": 512,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
            },
            "evalscript": _TRUE_COLOUR_EVALSCRIPT,
        },
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, scene
