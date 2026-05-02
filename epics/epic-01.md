# Epic 01: Phase 1 — Notebook Prototypes

> Status: Done (6/6 complete) | Last updated: 2026-05-02

## Goal

Validate every external data source (Open-Meteo, CMEMS, CDSE, CelesTrak/orbital propagation, suncalc, tile servers) in interactive Jupyter notebooks before committing to a FastAPI interface design. Each notebook should produce working data retrieval, understand the response shapes, handle authentication, and produce a simple visualization confirming the data is correct.

## Dependencies

- Depends on: None (bootstrap epic)
- Blocks: Epic 02 (FastAPI backend)

## Stories

| ID | Story | Status | OpenSpec Refs |
|----|-------|--------|---------------|
| S01-01 | Weather data notebook (Open-Meteo + MeteoAlarm) | ✅ Done | REQ-WX-001–007 |
| S01-02 | Wave data notebook (CMEMS Baltic Wave Forecast) | ✅ Done | REQ-WAVE-001–004 |
| S01-03 | Solar geometry notebook (suncalc) | ✅ Done | REQ-SOL-001–006 |
| S01-04 | Satellite overpass notebook (CDSE, USGS/CMR, CelesTrak) | ✅ Done | REQ-SAT-001–004 |
| S01-05 | Sentinel-2 imagery notebook (CDSE STAC + WMS) | ✅ Done | REQ-SAT-005–007 |
| S01-06 | Map layers notebook (OSM, OpenSeaMap, WMS/WMTS, GeoTIFF, GEBCO, EMODnet) | ✅ Done | REQ-MAP-001–008 |

## Acceptance Criteria

- [ ] Each notebook executes from top to bottom without error in the `boatops` conda environment
- [ ] Each notebook produces at least one visualization confirming correct data retrieval
- [ ] Authentication patterns (CDSE OAuth2, CMEMS credentials) are validated and documented in the notebook
- [ ] All notebooks saved with output cleared before commit (no credentials in output cells)
- [ ] `ops/data-sources.md` updated with any findings (coverage limits, API quirks, rate limits)
