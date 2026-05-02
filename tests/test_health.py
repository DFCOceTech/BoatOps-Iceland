import pytest
from fastapi.testclient import TestClient

from boatops.main import app

client = TestClient(app)


def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


@pytest.mark.parametrize("path", [
    # weather implemented in S02-02 — removed from stub list
    "/api/waves/overlay?west=9.5&south=53.5&east=15.0&north=56.0",
    "/api/solar/times?lat=54.18&lon=12.08",
    "/api/satellite/overpasses?west=9.5&south=53.5&east=15.0&north=56.0",
    "/api/map/bathymetry?west=9.5&south=53.5&east=15.0&north=56.0",
])
def test_stub_endpoints_return_501(path):
    resp = client.get(path)
    assert resp.status_code == 501
