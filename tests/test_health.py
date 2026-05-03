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
    # waves implemented in S02-03 — removed from stub list
    # solar implemented in S02-04 — removed from stub list
    # satellite implemented in S02-05 — removed from stub list
    "/api/map/bathymetry?west=9.5&south=53.5&east=15.0&north=56.0",
])
def test_stub_endpoints_return_501(path):
    resp = client.get(path)
    assert resp.status_code == 501
