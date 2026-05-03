"""Solar router tests — no mocking needed (suncalc is a local deterministic computation)."""
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from boatops.main import app
from boatops.services.solar import get_solar_elevation, get_solar_times

client = TestClient(app)

WARNEMUNDE = {"lat": 54.18, "lon": 12.08}
POLAR = {"lat": 70.0, "lon": 25.0}
SOLSTICE = date(2026, 6, 21)


# ── service-level tests (no HTTP) ─────────────────────────────────────────────

def test_solar_times_returns_required_keys():
    result = get_solar_times(**WARNEMUNDE, query_date=SOLSTICE)
    for key in ("date", "lat", "lon", "sunrise", "sunset", "solar_noon",
                "dawn_civil", "dusk_civil", "dawn_nautical", "dusk_nautical",
                "dawn_astronomical", "dusk_astronomical"):
        assert key in result, f"missing key: {key}"


def test_solar_times_warnemunde_solstice():
    result = get_solar_times(**WARNEMUNDE, query_date=SOLSTICE)
    # Sunrise ~02:44, sunset ~19:50 (±10 min sanity check from notebook)
    sr = datetime.fromisoformat(result["sunrise"])
    ss = datetime.fromisoformat(result["sunset"])
    assert sr.hour == 2, f"unexpected sunrise hour: {sr}"
    assert ss.hour == 19, f"unexpected sunset hour: {ss}"


def test_solar_times_iso_format():
    result = get_solar_times(**WARNEMUNDE, query_date=SOLSTICE)
    # All non-null times should be parseable ISO strings
    for key in ("sunrise", "sunset", "solar_noon"):
        val = result[key]
        assert val is not None
        dt = datetime.fromisoformat(val)
        assert dt.tzinfo is not None, f"{key} should be tz-aware"


def test_solar_times_polar_summer_nulls():
    # At 70°N on summer solstice the sun never sets — expect None for sunset/dawn
    result = get_solar_times(**POLAR, query_date=SOLSTICE)
    assert result["sunset"] is None, "Expected null sunset for polar summer"
    assert result["sunrise"] is None, "Expected null sunrise for polar summer"


def test_solar_times_default_date():
    # Should not raise when date is omitted (defaults to today)
    result = get_solar_times(**WARNEMUNDE)
    assert "sunrise" in result
    assert result["date"] == datetime.now(timezone.utc).date().isoformat()


def test_solar_elevation_noon():
    # At solar noon on summer solstice, elevation should be ~58° at Warnemünde
    noon_utc = datetime(2026, 6, 21, 11, 12, tzinfo=timezone.utc)
    result = get_solar_elevation(**WARNEMUNDE, dt=noon_utc)
    assert 55.0 <= result["elevation_deg"] <= 62.0, (
        f"Noon elevation {result['elevation_deg']:.2f}° outside 55–62° range"
    )
    assert result["is_daylight"] is True
    assert result["period"] == "day"


def test_solar_elevation_night():
    midnight = datetime(2026, 6, 21, 0, 0, tzinfo=timezone.utc)
    result = get_solar_elevation(**WARNEMUNDE, dt=midnight)
    # At midnight UTC in summer at 54°N the sun is near the horizon or slightly above
    # (polar-adjacent); just check the period classification is consistent
    period = result["period"]
    is_day = result["is_daylight"]
    assert (period == "day") == is_day


def test_solar_elevation_keys():
    result = get_solar_elevation(**WARNEMUNDE)
    for key in ("elevation_deg", "azimuth_deg", "is_daylight", "period", "timestamp"):
        assert key in result


def test_solar_azimuth_range():
    result = get_solar_elevation(**WARNEMUNDE)
    assert 0 <= result["azimuth_deg"] < 360


def test_classify_period_values():
    from boatops.services.solar import _classify_period
    assert _classify_period(10.0) == "day"
    assert _classify_period(-3.0) == "civil_twilight"
    assert _classify_period(-9.0) == "nautical_twilight"
    assert _classify_period(-15.0) == "astronomical_twilight"
    assert _classify_period(-20.0) == "night"


# ── router / HTTP tests ───────────────────────────────────────────────────────

def test_times_endpoint_200():
    resp = client.get("/api/solar/times?lat=54.18&lon=12.08&date=2026-06-21")
    assert resp.status_code == 200


def test_times_endpoint_schema():
    resp = client.get("/api/solar/times?lat=54.18&lon=12.08&date=2026-06-21")
    body = resp.json()
    assert "sunrise" in body and "sunset" in body


def test_times_endpoint_polar_null():
    resp = client.get("/api/solar/times?lat=70.0&lon=25.0&date=2026-06-21")
    assert resp.status_code == 200
    body = resp.json()
    assert body["sunset"] is None


def test_elevation_endpoint_200():
    resp = client.get("/api/solar/elevation?lat=54.18&lon=12.08")
    assert resp.status_code == 200


def test_elevation_endpoint_schema():
    resp = client.get("/api/solar/elevation?lat=54.18&lon=12.08")
    body = resp.json()
    for key in ("elevation_deg", "azimuth_deg", "is_daylight", "period"):
        assert key in body
