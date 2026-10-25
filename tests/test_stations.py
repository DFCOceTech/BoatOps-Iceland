"""Nearby weather stations. REQ-IS-12 / SCENARIO-IS-12a..b."""
from datetime import datetime, timezone
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from boatops.main import app
from boatops.services import vedur

client = TestClient(app)

STATIONS = [
    {"station": 5316, "name": "Kvísker", "owner": "Veðurstofa Íslands", "lat": 63.9, "lon": -16.4, "ele": 20},
    {"station": 5544, "name": "Höfn", "owner": "Veðurstofa Íslands", "lat": 64.27, "lon": -15.2, "ele": 5},
    {"station": 1350, "name": "Keflavík", "owner": "Veðurstofa Íslands", "lat": 63.97, "lon": -22.6, "ele": 50},
    {"station": 9999, "name": "NoData", "owner": "x", "lat": 64.04, "lon": -16.2, "ele": 1},
    {"station": 35315, "name": "Kvísker VG", "owner": "Vegagerðin", "lat": 63.9, "lon": -16.42, "ele": 10},
]
OBS = [
    {"station": 5316, "time": "2026-10-25T16:30:00", "t": 5.8, "f": None, "fg": None, "d": None, "d_txt": None, "p": None, "rh": None, "r": None},
    {"station": 5544, "time": "2026-10-25T16:30:00", "t": 5.1, "f": 4.7, "fg": 6.7, "d": 347, "d_txt": "NNW", "p": 985, "rh": 83, "r": 0.1},
    {"station": 1350, "time": "2026-10-25T16:30:00", "t": 3.0, "f": 5.0, "fg": 6.0, "d": 355, "d_txt": "N", "p": 992, "rh": 74, "r": None},
    {"station": 9999, "time": "2026-10-25T16:30:00", "t": None, "f": None, "p": None, "rh": None},
    {"station": 35315, "time": "2026-10-25T15:00:00", "t": 5.9, "f": 3.5, "fg": 5.2, "d": 336, "d_txt": "NNW", "p": None, "rh": None, "r": None},
]


@pytest.fixture(autouse=True)
def patched():
    for c in (vedur._stations_cache, vedur._obs_cache):
        c.clear()
    with patch.object(vedur, "_stations", return_value=STATIONS), \
         patch.object(vedur, "_latest", return_value={o["station"]: o for o in OBS}):
        yield


def test_nearest_first_with_distance_and_bearing():
    now = datetime(2026, 10, 25, 16, 40, tzinfo=timezone.utc)
    res = vedur.nearby_stations(64.048, -16.18, 60, now=now)
    ids = [s["id"] for s in res]
    assert ids == [5316, 35315, 5544]  # Keflavík too far, NoData has no reading
    assert res[0]["distance_km"] < res[1]["distance_km"] < res[2]["distance_km"]
    assert res[0]["bearing_deg"] in range(190, 230)  # Kvísker is SW
    assert res[0]["age_min"] == 10 and res[1]["age_min"] == 100


def test_endpoint_ok_and_radius_filter():
    r = client.get("/api/stations/nearby?lat=64.048&lon=-16.18&radius_km=25")
    assert r.status_code == 200
    assert [s["id"] for s in r.json()["stations"]] == [5316, 35315]


@pytest.mark.parametrize("q", ["lat=123&lon=-16", "lat=64&lon=-16&radius_km=1", "lat=64&lon=-16&radius_km=999",
                               "lat=nan&lon=-16"])
def test_bad_input_422(q):
    assert client.get(f"/api/stations/nearby?{q}").status_code == 422


def test_upstream_failure_502():
    with patch.object(vedur, "_latest", side_effect=httpx.ConnectError("down")):
        assert client.get("/api/stations/nearby?lat=64&lon=-16").status_code == 502
