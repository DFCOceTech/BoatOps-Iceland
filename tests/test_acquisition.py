"""Download-query builder. REQ-IS-10 / SCENARIO-IS-10a..d."""
from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient

from boatops.main import app
from boatops.services import acquisition, celestrak

client = TestClient(app)
BB = (-16.30, 63.98, -16.06, 64.10)
AOS, LOS = "2026-10-26T08:10:00+00:00", "2026-10-26T08:24:00+00:00"


def test_swot_in_catalog_with_correct_norad():
    assert celestrak.SATELLITE_CATALOG["SWOT"]["norad"] == 54754
    assert celestrak.SATELLITE_CATALOG["SWOT"]["daytime_only"] is False      # radar: day and night


def test_sentinel2_query_window_bbox_and_product_type():
    q = acquisition.build_queries("Sentinel-2A", AOS, LOS, BB)["queries"][0]["url"]
    d = unquote(q)
    assert "Collection/Name eq 'SENTINEL-2'" in d and "S2MSI2A" in d
    assert "ContentDate/Start gt 2026-10-26T08:00:00Z" in d       # AOS - 10 min
    assert "ContentDate/Start lt 2026-10-26T08:34:00Z" in d       # LOS + 10 min
    assert "-16.3 63.98" in d


def test_sentinel1_query():
    d = unquote(acquisition.build_queries("Sentinel-1C", AOS, LOS, BB)["queries"][0]["url"])
    assert "SENTINEL-1" in d and "GRD" in d


def test_landsat_query_is_stac():
    q = acquisition.build_queries("Landsat 9", AOS, LOS, BB)["queries"][0]["url"]
    assert q.startswith("https://earth-search.aws.element84.com/v1/search?")
    assert "collections=landsat-c2-l2" in q and "bbox=-16.3%2C63.98%2C-16.06%2C64.1" in q


def test_swot_queries_use_current_D_collections():
    info = acquisition.build_queries("SWOT", AOS, LOS, BB)
    urls = [x["url"] for x in info["queries"]]
    assert len(urls) == 4 and all("cmr.earthdata.nasa.gov" in u and "_D&" in u for u in urls)
    assert all("temporal[]=2026-10-26T08:00:00Z,2026-10-26T08:34:00Z" in u for u in urls)
    assert "Earthdata" in info["access"]


def test_unknown_platform_returns_empty_queries():
    assert acquisition.build_queries("Mystery", AOS, LOS, BB)["queries"] == []


def test_endpoint_ok_and_validation():
    qs = "platform=SWOT&aos_utc=2026-10-26T08:10:00%2B00:00&los_utc=2026-10-26T08:24:00%2B00:00&west=-16.3&south=63.98&east=-16.06&north=64.1"
    r = client.get(f"/api/satellite/download-info?{qs}")
    assert r.status_code == 200 and len(r.json()["queries"]) == 4
    assert client.get(f"/api/satellite/download-info?{qs.replace('aos_utc=2026', 'aos_utc=garbage&x=2026')}").status_code == 422
    assert client.get("/api/satellite/download-info?platform=SWOT&aos_utc=a&los_utc=b&west=-30&south=60&east=-10&north=70").status_code == 422
