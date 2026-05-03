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


# All stubs implemented in S02-02 through S02-06 — no 501 endpoints remain
