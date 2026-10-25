"""Sentinel-1 / Sentinel-2 scene discovery (CDSE OData) + rendering (SH Process API).

Confirmed in notebooks/05_sentinel2_imagery.ipynb:
  - STAC at stac.dataspace.copernicus.eu/v1 does NOT contain Sentinel-2 — use OData.
  - SH Process API requires only a CDSE OAuth2 Bearer token (no separate instance ID).
  - Quicklook asset type is JPEG — use PIL, not direct PNG decode.
  - OData $expand=Attributes,Assets combined returns 400 — use separate requests.
"""
import re
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


# Sentinel-1 GRD products near Iceland are a mix of IW dual-pol VV+VH and EW dual-pol HH+HV (the
# latter dominates around sea ice). The product name encodes both: S1A_<MODE>_GRDx_1S<SD><HV>_...
_S1_NAME = re.compile(r"_(IW|EW)_GRD[HMF]_1S([SD])([HV])")
_S1_POL = {   # (S|D, H|V) -> (Process-API polarization, co-pol band, cross-pol band)
    ("D", "V"): ("DV", "VV", "VH"),
    ("D", "H"): ("DH", "HH", "HV"),
    ("S", "V"): ("SV", "VV", "VV"),
    ("S", "H"): ("SH", "HH", "HH"),
}


def _sar_evalscript(co: str, cross: str) -> str:
    return (
        "//VERSION=3\n"
        f"function setup(){{return{{input:[\"{co}\",\"{cross}\",\"dataMask\"],output:{{bands:4}}}};}}\n"
        "function db(x){return Math.min(1,Math.max(0,(10*Math.log(Math.max(x,1e-5))/Math.LN10+25)/25));}\n"
        f"function evaluatePixel(s){{var a=db(s.{co}),b=db(s.{cross});return[a,b,a*0.5+b*0.5,s.dataMask];}}\n"
    )


def parse_s1_name(name: str) -> dict | None:
    """{'mode': 'EW', 'pol': 'DH', 'co': 'HH', 'cross': 'HV'} or None for unsupported products."""
    m = _S1_NAME.search(name)
    if not m:
        return None
    mode, sd, hv = m.groups()
    pol, co, cross = _S1_POL[(sd, hv)]
    return {"mode": mode, "pol": pol, "co": co, "cross": cross}


def _build_s1_filter(bbox: tuple, days_back: int) -> str:
    west, south, east, north = bbox
    wkt = (
        f"POLYGON(({west} {south},{east} {south},"
        f"{east} {north},{west} {north},{west} {south}))"
    )
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days_back)
    # GRD only (IW and EW, any polarisation); the product name is parsed afterwards.
    return (
        f"Collection/Name eq 'SENTINEL-1' and "
        f"OData.CSC.Intersects(area=geography'SRID=4326;{wkt}') and "
        f"ContentDate/Start gt {start_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')} and "
        f"ContentDate/Start lt {end_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')} and "
        f"contains(Name,'GRD')"
    )


_S1_GAP = timedelta(minutes=3)    # slices of one data-take are ~25-60 s apart


def _parse_dt(v: str) -> datetime:
    return datetime.fromisoformat(v.replace("Z", "+00:00"))


def find_best_s1_scene(token: str, bbox: tuple, days_back: int = 14) -> dict | None:
    """Most recent Sentinel-1 GRD data-take covering the bbox (IW VV+VH or EW HH+HV), or None.

    Consecutive slices of one data-take with the same mode/polarisation are grouped (the Process API
    mosaics them). Preference: most recent group with full bbox coverage, else the best-covering one.
    """
    resp = httpx.get(
        _ODATA_URL,
        params={
            "$filter": _build_s1_filter(bbox, days_back),
            "$orderby": "ContentDate/Start desc",
            "$top": 80,
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    seen, items = set(), []
    for it in resp.json().get("value", []):
        info = parse_s1_name(it.get("Name", ""))
        if info is None or it["Name"] in seen:      # skip unsupported products and duplicate copies
            continue
        seen.add(it["Name"])
        it["_info"] = info
        it["_start"] = _parse_dt(it["ContentDate"]["Start"])
        it["_end"] = _parse_dt(it["ContentDate"].get("End") or it["ContentDate"]["Start"])
        items.append(it)
    if not items:
        return None

    groups: list[list[dict]] = []
    for it in items:   # newest first
        for g in groups:
            if g[0]["_info"]["pol"] == it["_info"]["pol"] and g[0]["_info"]["mode"] == it["_info"]["mode"] \
                    and (min(x["_start"] for x in g) - it["_end"]) <= _S1_GAP \
                    and (it["_start"] - max(x["_end"] for x in g)) <= _S1_GAP:
                g.append(it)
                break
        else:
            groups.append([it])

    scored = []
    for g in groups:
        cov = _bbox_coverage([i.get("GeoFootprint") for i in g], bbox)
        scored.append((g, 1.0 if cov is None else cov))
    full = [x for x in scored if x[1] >= _FULL_COVERAGE]
    g, cov = full[0] if full else max(scored, key=lambda x: (round(x[1], 2), max(i["_start"] for i in x[0])))

    info = g[0]["_info"]
    start = min(i["_start"] for i in g)
    return {
        "scene_id": g[0]["Name"],
        "acquisition_time": start.isoformat(),
        "window_start": start.isoformat(),
        "window_end": max(i["_end"] for i in g).isoformat(),
        "cloud_cover_pct": "",
        "coverage_pct": round(cov * 100),
        "tiles": len(g),
        "mode": info["mode"], "pol": info["pol"], "co": info["co"], "cross": info["cross"],
    }


@cachetools.cached(
    cache=_cache, lock=_lock,
    key=lambda token, bbox, days_back=14: cachetools.keys.hashkey("s1", bbox, days_back),
)
def get_s1_overlay(token: str, bbox: tuple, days_back: int = 14) -> tuple[bytes, dict]:
    """Return (png_bytes, metadata) for the latest Sentinel-1 SAR data-take over bbox.

    Radar sees through cloud and darkness — the primary layer for locating mobile ice.
    Colours: R=co-pol (VV or HH), G=cross-pol (VH or HV), dB-scaled. Calm open water is dark; ice and
    rough water are bright. HH (EW mode) separates ice from water differently than VV — see `mode`.
    """
    scene = find_best_s1_scene(token, bbox, days_back)
    if scene is None:
        raise RuntimeError(f"No Sentinel-1 GRD scene found in last {days_back} days")

    time_from = (_parse_dt(scene["window_start"]) - timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    time_to = (_parse_dt(scene["window_end"]) + timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
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
                    "dataFilter": {
                        "timeRange": {"from": time_from, "to": time_to},
                        "polarization": scene["pol"],
                        "acquisitionMode": scene["mode"],
                    },
                    "processing": {"backCoeff": "SIGMA0_ELLIPSOID", "orthorectify": True},
                }],
            },
            "output": {
                "width": 512, "height": 512,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
            },
            "evalscript": _sar_evalscript(scene["co"], scene["cross"]),
        },
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, scene


_FULL_COVERAGE = 0.95     # fraction of the requested bbox a scene must cover to count as "full"
_GROUP_WINDOW = timedelta(minutes=10)   # tiles of one pass share (almost) the same start time


def _bbox_coverage(footprints: list, bbox: tuple) -> float | None:
    """Fraction of bbox covered by the union of scene footprints (GeoJSON); None if unknown."""
    from shapely.geometry import box, shape
    from shapely.ops import unary_union
    try:
        polys = [shape(g) for g in footprints if g]
        if not polys:
            return None
        target = box(*bbox)
        return float(unary_union(polys).intersection(target).area / target.area)
    except Exception:
        return None


def find_best_scene(token: str, bbox: tuple,
                    cloud_max: float = 20.0, days_back: int = 90) -> dict | None:
    """Return the best recent cloud-limited L2A pass over bbox, or None.

    Tiles of one pass are grouped (the Process API mosaics them), and coverage of the *bbox*
    is computed from their footprints — tile-wide cloud cover says nothing about whether the
    scene actually covers the site. Preference: most recent pass with full coverage; otherwise
    the pass with the highest coverage (ties → most recent).
    """
    resp = httpx.get(
        _ODATA_URL,
        params={
            "$filter": _build_filter(bbox, cloud_max, days_back),
            "$orderby": "ContentDate/Start desc",
            "$top": 40,
            "$expand": "Attributes",
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    items = resp.json().get("value", [])
    if not items:
        return None

    groups: list[list[dict]] = []   # items arrive newest first
    for it in items:
        start = datetime.fromisoformat(it["ContentDate"]["Start"].replace("Z", "+00:00"))
        it["_start"] = start
        if groups and abs(groups[-1][0]["_start"] - start) <= _GROUP_WINDOW:
            groups[-1].append(it)
        else:
            groups.append([it])

    scored = []
    for g in groups:
        cov = _bbox_coverage([i.get("GeoFootprint") for i in g], bbox)
        scored.append((g, 1.0 if cov is None else cov))
    full = [x for x in scored if x[1] >= _FULL_COVERAGE]
    g, cov = full[0] if full else max(scored, key=lambda x: (round(x[1], 2), x[0][0]["_start"]))

    best = g[0]
    attrs = {a["Name"]: a.get("Value") for a in best.get("Attributes", [])}
    return {
        "scene_id": best["Name"],
        "acquisition_time": best["_start"].isoformat(),
        "cloud_cover_pct": float(attrs.get("cloudCover") or 0),
        "orbit": attrs.get("orbitNumber"),
        "tile_ref": attrs.get("tileId") or attrs.get("S2TileId"),
        "coverage_pct": round(cov * 100),
        "tiles": len(g),
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
