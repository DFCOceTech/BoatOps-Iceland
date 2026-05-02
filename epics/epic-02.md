# Epic 02: Phase 2 — FastAPI Backend

> Status: In Progress | Last updated: 2026-05-02

## Goal

Refactor the validated notebook logic into a production-ready FastAPI service under `src/boatops/`.
Each capability gets its own router and service module. All credentials are loaded server-side from
`.env`. Raster overlays are served as binary PNG with bbox metadata; scalar data as JSON; sparse
vectors as GeoJSON. In-process TTL caching (`cachetools`) matched to each data source's cadence.

## Dependencies

- Depends on: Epic 01 (all notebooks done — data sources, auth patterns, response shapes confirmed)
- Blocks: Epic 03 (React + MapLibre frontend)

## Stories

| ID | Story | Status | OpenSpec Refs |
|----|-------|--------|---------------|
| S02-01 | FastAPI skeleton — app, config, cache, router stubs, health endpoint | In Progress | — |
| S02-02 | Weather router — Open-Meteo forecast + MeteoAlarm advisories | ✅ Done | REQ-WX-001–007 |
| S02-03 | Waves router — CMEMS Hs forecast + overlay PNG | ✅ Done | REQ-WAVE-001–004 |
| S02-04 | Solar router — suncalc times + current elevation | Backlog | REQ-SOL-001–006 |
| S02-05 | Satellite router — CDSE overpasses + Sentinel-2 overlay PNG | Backlog | REQ-SAT-001–007 |
| S02-06 | Map layers router — bathymetry, SST, salinity, currents, chl, O₂ overlay PNGs | Backlog | REQ-MAP-001–016 |

## Acceptance Criteria

- [ ] `uvicorn boatops.main:app` starts cleanly with `.env` present; `GET /health` returns 200
- [ ] Each router responds to its primary endpoint with correct Content-Type (JSON or `image/png`)
- [ ] No credentials appear in any response body or log output
- [ ] TTL cache confirmed working: second identical request returns within 50 ms
- [ ] `pytest tests/` passes green with credentials mocked
- [ ] `src/boatops/` has no direct imports of notebook-specific helpers (clean refactor)
