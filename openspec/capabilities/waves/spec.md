# Waves — Specification

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Purpose

Fetch and display gridded significant wave height (Hs) and wave direction for the German Baltic Sea AOI. Wave data is a primary Go/No-Go factor for Blue Boat deployments. Source: Copernicus Marine Service (CMEMS) Baltic Sea Wave Analysis and Forecast product.

## Functional Requirements

### REQ-WAVE-001: Significant Wave Height
The system SHALL fetch gridded significant wave height (Hs, in meters) for the AOI from the CMEMS Baltic Sea Wave Forecast product. The data SHALL be available as both a static snapshot at a given time and an animated layer across the planning window.

### REQ-WAVE-002: Wave Direction
The system SHALL fetch mean wave direction or peak wave direction (degrees from north) alongside significant wave height from the same CMEMS product. Wave direction SHALL be visualizable as arrows or streamlines on the map.

### REQ-WAVE-003: Data Freshness
The system SHALL include a last-updated timestamp and model run time for wave data.

### REQ-WAVE-004: Graceful Failure
If the CMEMS API is unavailable, the system SHALL return a structured error response for the wave layer without affecting other layers.

## Acceptance Scenarios

### SCENARIO-WAVE-HEIGHT-001: Wave height data returned for Baltic AOI
**GIVEN** a bounding box covering the German Baltic Sea coast (`[9.5, 53.5, 15.0, 56.0]`) and a 48-hour forecast window  
**WHEN** the CMEMS wave endpoint is queried for `VHM0` (significant wave height)  
**THEN** the response contains a gridded dataset with Hs values in the range [0, 10] m (physically plausible for Baltic), covering the requested bbox and time range

### SCENARIO-WAVE-DIR-001: Wave direction returned alongside height
**GIVEN** the same AOI and time range as SCENARIO-WAVE-HEIGHT-001  
**WHEN** the endpoint is queried for both `VHM0` and `VMDR` (mean wave direction)  
**THEN** the response contains co-located wave height and direction grids; direction values are in [0, 360)

### SCENARIO-WAVE-SNAPSHOT-001: Static snapshot at a specific time
**GIVEN** a specific forecast time within the next 48 hours  
**WHEN** the wave snapshot endpoint is called  
**THEN** the response contains a single time slice of Hs and direction as a GeoJSON grid or NetCDF-derived dict

### SCENARIO-WAVE-FAIL-001: CMEMS unavailable returns structured error
**GIVEN** CMEMS API is unreachable (simulated)  
**WHEN** the wave endpoint is called  
**THEN** the response returns `{"layer": "waves", "status": "error", "message": "..."}` with HTTP 200; other layers unaffected

## Data Contracts

### Inputs
| Name | Source | Format | Required Fields |
|------|--------|--------|-----------------|
| CMEMS Baltic Wave product | CMEMS MOTU / OPeNDAP | NetCDF | VHM0, VMDR, time, latitude, longitude |

### Outputs
| Name | Format | Key Fields |
|------|--------|------------|
| Wave grid | dict or xarray Dataset | time, lat, lon, Hs (m), wave_dir (°), model_run_time, last_updated |

## Implementation Status (2026-05-02)

**Status**: Partially Implemented (Phase 1 notebook prototype complete)

### What's Built
- `notebooks/02_waves.ipynb` — validates CMEMS Baltic Wave Forecast; all SCENARIO-WAVE-* pass
- REQ-WAVE-001 through REQ-WAVE-004: query patterns established; VHM0 (Hs) and VMDR confirmed
- Dataset: `cmems_mod_bal_wav_anfc_PT1H-i` | 1 nmi resolution | hourly | FMI WAM model
- Auth: `copernicusmarine` Python client v2.4.0 with account from `.env`

### Reproducibility
- **Seed**: Not applicable (model forecast data)
- **Re-run verified**: Yes (nbconvert execution)
- **Known numerical tolerance**: Hs ±0.01 m; direction ±1°

### Deviations from Spec
- Warnemünde (54.18°N, 12.08°E) is a **land-masked cell** (100% NaN). Phase 2 service layer must implement nearest-wet-cell search before returning point data.
- CMEMS credentials are separate from CDSE — set `COPERNICUSMARINE_SERVICE_USERNAME` and `COPERNICUSMARINE_SERVICE_PASSWORD` in `.env`.
- `copernicusmarine.describe()` in v2.4.0 does **not** accept `username`/`password` kwargs — credentials via env vars only.

### Deferred
- Animated wave layer rendering (Phase 3 frontend)
- REQ-WAVE-003 model run time: not exposed in global attributes; using `ds.time.values[-1]` as fallback
