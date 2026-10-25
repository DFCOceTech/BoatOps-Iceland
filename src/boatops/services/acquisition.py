"""Build catalogue queries that find a predicted overpass's data product after acquisition.

Every query URL is a public search endpoint (no credentials to *find* a product); downloading
needs the account noted in `access`. Pure functions — no network.
"""
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode

_PAD = timedelta(minutes=10)   # overpass AOS/LOS is horizon-to-horizon; sensing falls inside it

_CDSE = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
_STAC = "https://earth-search.aws.element84.com/v1/search"
_CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"

# CMR short names — SWOT version "D" is the current reprocessing; 2.0 collections are no longer updated.
_SWOT_PRODUCTS = [
    ("SWOT_L2_HR_Raster_100m_D", "HR water-mask raster, 100 m (lake/river extent & height)"),
    ("SWOT_L2_HR_LakeSP_D", "HR lake single-pass vector (lagoon polygon, WSE)"),
    ("SWOT_L2_HR_PIXC_D", "HR pixel cloud (full-resolution points)"),
    ("SWOT_L2_LR_SSH_D", "KaRIn low-rate sea-surface height (2 km)"),
]


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _cdse(collection: str, extra: str, start: datetime, end: datetime, bbox: tuple) -> str:
    w, s, e, n = bbox
    wkt = f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"
    flt = (
        f"Collection/Name eq '{collection}' and "
        f"OData.CSC.Intersects(area=geography'SRID=4326;{wkt}') and "
        f"ContentDate/Start gt {_iso(start)} and ContentDate/Start lt {_iso(end)}{extra}"
    )
    return f"{_CDSE}?$filter={quote(flt, safe='')}&$orderby={quote('ContentDate/Start asc', safe='')}&$top=20"


def build_queries(platform: str, aos_utc: str, los_utc: str, bbox: tuple) -> dict:
    """Return {"availability", "access", "queries": [{label, url, note?}]} for one pass."""
    start, end = _parse(aos_utc) - _PAD, _parse(los_utc) + _PAD
    w, s, e, n = bbox
    bbox_str = f"{w},{s},{e},{n}"

    if platform.startswith("Sentinel-1"):
        return {
            "availability": "usually within a few hours of acquisition",
            "access": "free Copernicus Data Space account (download: https://download.dataspace.copernicus.eu/odata/v1/Products(<Id>)/$value with a bearer token)",
            "queries": [{
                "label": "Sentinel-1 GRD scenes (CDSE OData)",
                "url": _cdse("SENTINEL-1", " and contains(Name,'GRD')", start, end, bbox),
            }],
        }
    if platform.startswith("Sentinel-2"):
        return {
            "availability": "L2A usually within ~1 day of acquisition",
            "access": "free Copernicus Data Space account",
            "queries": [{
                "label": "Sentinel-2 L2A scenes (CDSE OData)",
                "url": _cdse(
                    "SENTINEL-2",
                    " and Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType'"
                    " and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A')",
                    start, end, bbox),
                "note": "Check footprint coverage and cloud cover before downloading.",
            }],
        }
    if platform.startswith("Landsat"):
        params = {"collections": "landsat-c2-l2", "bbox": bbox_str,
                  "datetime": f"{_iso(start)}/{_iso(end)}", "limit": 20}
        return {
            "availability": "Collection 2 Level-2 typically 1–3 days after acquisition",
            "access": "no account to search; assets are on AWS (requester-pays) — or download free from USGS EarthExplorer (login)",
            "queries": [{"label": "Landsat C2 L2 scenes (Earth Search STAC)", "url": f"{_STAC}?{urlencode(params)}"}],
        }
    if platform.startswith("SWOT"):
        queries = []
        for short_name, label in _SWOT_PRODUCTS:
            qs = (f"short_name={short_name}&bounding_box={bbox_str}"
                  f"&temporal[]={_iso(start)},{_iso(end)}&sort_key=start_date&page_size=20")
            queries.append({"label": f"{short_name} — {label}", "url": f"{_CMR}?{qs}"})
        return {
            "availability": "typically 1–5 days after acquisition; HR products exist only where SWOT's HR mask is active over the target",
            "access": "free NASA Earthdata login (PO.DAAC); search needs no login",
            "queries": queries,
        }
    return {"availability": "unknown", "access": "unknown", "queries": []}
