# Project Brief — BoatOps

> Version: 1.0 | Status: Living Document | Last updated: 2026-05-01

## Problem Statement

Survey operators deploying a Blue Robotics Blue Boat USV in German Baltic Sea coastal waters need to make a Go/No-Go decision before each mission. Currently this requires manually checking multiple separate services (weather forecast, wave forecast, nautical charts, satellite schedules) with no unified view. The lack of a consolidated planning tool increases decision time, risks missed satellite overpass windows, and can lead to deployments under unsafe conditions.

## Vision

BoatOps is a browser-based planning dashboard that aggregates all pre-mission environmental and observational data into a single interactive map. Operators select a date/time window and area of interest, and the tool surfaces wind, wave, solar, and satellite overpass data alongside nautical charts — enabling a confident Go/No-Go decision in minutes. An optional AI synthesis layer (Claude API) can generate a plain-language assessment with recommended time windows.

## Stakeholders

| Role | Interest |
|------|----------|
| Survey operator | Needs rapid, reliable Go/No-Go assessment before Blue Boat deployment |
| Institute researcher | Needs satellite overpass timing and cloud-free imagery to coordinate field campaigns with satellite passes |
| Institute IT / sysadmin | Needs a maintainable, securely deployed web service with server-side credential management |

## Success Criteria

| ID | Criterion | Measure |
|----|-----------|---------|
| SC-1 | Weather, wave, and solar data load for a user-defined AOI within 5 seconds | P95 load time ≤ 5 s in network tests |
| SC-2 | Satellite overpass predictions cover all 5 target platforms (Sentinel-2 A/B, Sentinel-3 A/B, Landsat 8/9, VIIRS) | All platforms returned for a 7-day planning window over a Baltic AOI |
| SC-3 | Most recent cloud-free Sentinel-2 image (≤20% cloud cover) displays as a map overlay | Image renders correctly for at least one test AOI |
| SC-4 | Multiple authenticated users can access the tool concurrently | Load test with ≥3 concurrent sessions |
| SC-5 | API failures degrade gracefully — failed layers show error state without breaking other layers | Simulated API failure test passes for each external data source |

## Constraints

- Always-on internet connection required; no offline mode
- All API credentials managed server-side; never exposed to client (NFR-03)
- Target browsers: Chrome, Firefox, Safari (current versions)
- Deployment: institute Linux server
- Development: Python/Jupyter prototypes first, then FastAPI backend + React/MapLibre GL frontend
- CDSE (Copernicus Data Space Ecosystem): operator account already registered

## Architecture Overview

Three-phase development:
1. **Phase 1 — Notebook prototypes**: One Jupyter notebook per capability validates each data source and establishes the query patterns and data shapes
2. **Phase 2 — FastAPI backend**: Notebook logic refactored into `src/boatops/` modules; FastAPI app with per-capability routers; server-side credential management via `.env`
3. **Phase 3 — Frontend**: React + MapLibre GL JS frontend consuming the FastAPI endpoints; animated wind/wave layers; satellite overpass overlay

Full architecture detail in `_bmad/architecture.md`.

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend language | Python | Data scientist background; reuses CDSE/rasterio patterns from Sent2_GreenMac notebook |
| Backend framework | FastAPI | Async support for concurrent API calls; auto-generated OpenAPI docs; modern Python idioms |
| Frontend map library | MapLibre GL JS | WebGL rendering for animated wind/wave layers; vector tile support; active open-source project |
| Weather data | Open-Meteo API | Free, no API key required for non-commercial use; ECMWF model option; 7-day forecast |
| Wave data | CMEMS Baltic Sea Wave Forecast | Official EU Copernicus Marine Service; covers Baltic Sea; NetCDF/API access |
| Satellite imagery | CDSE STAC + OGC WMS/WMTS | Operator registered; supports Level-2A Sentinel-2; cloud cover filtering via STAC |
| Solar geometry | suncalc (Python port) | Client-computable; no API key; covers twilight times, solar elevation, azimuth |
| AI synthesis | Claude API (claude-sonnet-4-6) | Low-latency; prompt caching for static system prompt; Anthropic credentials available |
| Conda env | boatops (Python 3.11) | Isolates geospatial dependencies (GDAL, PROJ, rasterio) from base environment |
