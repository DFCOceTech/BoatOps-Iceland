# Solar — Specification

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Purpose

Compute and display solar geometry for a given date, time, and location within the AOI. Provides sunrise/sunset, civil/nautical/astronomical twilight times, solar elevation angle and azimuth, and solar noon. Used both as a standalone planning layer and as input to satellite overpass quality assessment (SAT-01).

## Functional Requirements

### REQ-SOL-001: Sunrise and Sunset Times
The system SHALL compute sunrise and sunset times (local time and UTC) for a given date and location (lat/lon) using the suncalc Python library.

### REQ-SOL-002: Twilight Times
The system SHALL compute civil twilight, nautical twilight, and astronomical twilight start/end times for a given date and location.

### REQ-SOL-003: Solar Elevation and Azimuth
The system SHALL compute solar elevation angle (degrees above horizon) and azimuth (degrees from north) for any point in time within the planning window, at a given lat/lon.

### REQ-SOL-004: Solar Noon
The system SHALL compute solar noon time (UTC and local) for a given date and location.

### REQ-SOL-005: Timeline Visualization Data
The system SHALL return a time series of solar elevation values at sub-hourly resolution (≤15-minute intervals) across the planning window, suitable for rendering a daylight/twilight/dark timeline.

### REQ-SOL-006: Accuracy
Solar geometry outputs SHALL agree with USNO Solar API values to within ±1 minute for times and ±0.5° for elevation/azimuth.

## Acceptance Scenarios

### SCENARIO-SOL-BASIC-001: Sunrise/sunset for Kiel, Germany
**GIVEN** location lat=54.32, lon=10.13 (Kiel, Germany) and date=2026-06-21 (summer solstice)  
**WHEN** solar geometry is computed  
**THEN** sunrise is approximately 04:45 UTC, sunset approximately 20:55 UTC (±5 minutes), solar noon approximately 12:50 UTC

### SCENARIO-SOL-ELEVATION-001: Solar elevation at solar noon
**GIVEN** location lat=54.32, lon=10.13 and date=2026-06-21, time=solar noon  
**WHEN** solar elevation is computed  
**THEN** solar elevation is approximately 58–59° (±0.5°)

### SCENARIO-SOL-ACCURACY-001: Agreement with USNO Solar API
**GIVEN** location lat=54.32, lon=10.13 and date=2026-09-15  
**WHEN** suncalc outputs are compared to USNO Solar API values (manually retrieved as reference)  
**THEN** sunrise/sunset times agree to ±1 minute; solar elevation at noon agrees to ±0.5°

### SCENARIO-SOL-TIMELINE-001: Sub-hourly elevation time series
**GIVEN** location lat=54.32, lon=10.13 and a 48-hour planning window  
**WHEN** the timeline endpoint is called with 15-minute resolution  
**THEN** the response contains ≥192 data points, each with a UTC timestamp and solar elevation value in [−90, 90]

### SCENARIO-SOL-NIGHT-001: Polar summer (continuous daylight edge case)
**GIVEN** a planning window in June for a far-north Baltic location  
**WHEN** solar geometry is computed  
**THEN** the system correctly handles cases where sunset may not occur (elevation never drops below 0°)

## Data Contracts

### Inputs
| Name | Source | Format | Required Fields |
|------|--------|--------|-----------------|
| Location | User request | lat, lon (EPSG:4326) | lat ∈ [−90, 90], lon ∈ [−180, 180] |
| Date/time range | User request | ISO 8601 | start, end, optional resolution (minutes) |

### Outputs
| Name | Format | Key Fields |
|------|--------|------------|
| Solar events | dict | sunrise, sunset, solar_noon, dawn_civil, dusk_civil, dawn_nautical, dusk_nautical, dawn_astronomical, dusk_astronomical (all UTC ISO 8601) |
| Timeline | list of dicts | `[{"time": "...", "elevation_deg": float, "azimuth_deg": float}, ...]` |

## Implementation Status (2026-05-03)

**Status**: Implemented (Phase 1 + Phase 2 + Phase 3 complete)

### What's Built
- `notebooks/03_solar.ipynb` — validates suncalc; all SCENARIO-SOL-* pass except ACCURACY-001 (placeholder values)
- REQ-SOL-001 through REQ-SOL-006: all implemented; polar summer edge case handled
- `src/boatops/services/solar.py` — `get_solar_times(lat, lon, date)` (ISO UTC strings, null for polar events), `get_solar_elevation(lat, lon, dt)` (elevation°, azimuth°, period classification); no caching — deterministic, <10 ms
- `src/boatops/routers/solar.py` — `GET /api/solar/times`, `GET /api/solar/elevation`
- `frontend/src/components/SolarPanel.tsx` — solar times table (all 3 twilight tiers, Berlin CET/CEST via `Intl.DateTimeFormat`); SVG semicircle elevation gauge with coloured arc fill; period badge; 60-second auto-refresh for elevation

### Reproducibility
- **Seed**: Not applicable (deterministic)
- **Re-run verified**: Yes (nbconvert execution)
- **Known numerical tolerance**: ±10 min for sanity check; ±1 min spec target pending USNO validation

### Deviations from Spec
- SCENARIO-SOL-ACCURACY-001: USNO placeholder values used — formal ±1 min verification against `aa.usno.navy.mil/data/RS_OneYear` for Warnemünde 2026-09-15 still needed.
- suncalc argument order is **(lng, lat)**, not (lat, lon). Documented as a known gotcha.
- suncalc returns tz-naive `pd.NaT` (not Python `None`) for missing events — requires `pd.isna(v)` check and `tz_localize("UTC")` before arithmetic.

### Deferred
- SCENARIO-SOL-ACCURACY-001 USNO formal validation (run manually once)
