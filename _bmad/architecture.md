# Architecture — BoatOps

> Version: 1.1 | Status: Living Document | Last updated: 2026-05-03
> **Last Reconciled: 2026-05-03** — Review required if >30 days stale

## System Context

```
  [Browser]
     │  HTTPS
     ▼
  [FastAPI Backend]  ←→  [.env secrets]
     │
     ├── Open-Meteo API      (weather; no auth)
     ├── MeteoAlarm API      (advisories; no auth)
     ├── CMEMS MOTU/OPeNDAP  (wave forecast; credentials)
     ├── CDSE OData API      (satellite overpasses; OAuth2)
     ├── CDSE STAC API       (Sentinel-2 imagery search; OAuth2)
     ├── CDSE WMS/WMTS       (Sentinel-2 tile streaming; OAuth2)
     ├── USGS M2M / NASA CMR (Landsat overpasses; API key)
     ├── CelesTrak TLE       (VIIRS TLEs; no auth)
     ├── SunCalc (Python)    (solar geometry; local computation)
     └── Claude API          (AI synthesis; API key)
```

## Development Phases

### Phase 1 — Jupyter Notebook Prototypes ✅ Complete

One notebook per capability under `notebooks/`. Goal: validate each data source, nail down query patterns, understand data shapes and edge cases.

| Notebook | Capability | Status |
|----------|-----------|--------|
| `notebooks/01_weather.ipynb` | Weather (Open-Meteo) | ✅ Done |
| `notebooks/02_waves.ipynb` | Waves (CMEMS) | ✅ Done |
| `notebooks/03_solar.ipynb` | Solar geometry (suncalc) | ✅ Done |
| `notebooks/04_satellite_overpasses.ipynb` | SAT overpasses (CDSE, USGS, CelesTrak) | ✅ Done |
| `notebooks/05_sentinel2_imagery.ipynb` | Sentinel-2 imagery (CDSE STAC/WMS) | ✅ Done |
| `notebooks/06_map_layers.ipynb` | Map base layers (OSM, OpenSeaMap, WMS/WMTS, CMEMS overlays) | ✅ Done |

### Phase 2 — FastAPI Backend ✅ Complete (current)

Notebook logic refactored into `src/boatops/` modules. FastAPI app with per-capability routers. All credentials loaded server-side from `.env`.

```
src/boatops/
  __init__.py
  main.py              # FastAPI app entry point
  config.py            # Settings loaded from .env (pydantic-settings)
  auth/                # User authentication (JWT or session-based)
  routers/
    weather.py         # /api/weather/* endpoints
    waves.py           # /api/waves/* endpoints
    solar.py           # /api/solar/* endpoints
    satellite.py       # /api/satellite/* endpoints
    map_layers.py      # /api/map/* endpoints
    ai_synthesis.py    # /api/ai/* endpoints
  services/
    openmeteo.py       # Open-Meteo API client
    meteoalarm.py      # MeteoAlarm API client
    cmems.py           # CMEMS wave data client
    cdse_auth.py       # CDSE OAuth2 token management
    cdse_query.py      # CDSE OData + STAC query builder
    usgs_m2m.py        # USGS M2M / NASA CMR Landsat client
    celestrak.py       # CelesTrak TLE fetch + orbital propagation
    solar.py           # SunCalc wrapper
    claude_client.py   # Claude API client with prompt caching
```

### Phase 3 — Frontend (current)

React + MapLibre GL JS frontend consuming FastAPI endpoints. Animated wind/wave layers via Leaflet.velocity deferred to a later story. Satellite overpass overlay on map.

| Story | Component | Status |
|-------|-----------|--------|
| S03-01 | Vite scaffold, API client, MapView, Sidebar shell | ✅ Done |
| S03-02 | Base map layers, layer toggle panel | Backlog |
| S03-03 | Oceanographic overlay PNGs + legends | Backlog |
| S03-04 | Weather + waves panels | Backlog |
| S03-05 | Solar + satellite panels | Backlog |
| S03-06 | Go/No-Go dashboard | Backlog |

## Execution Environment

- **Conda environment**: `boatops`
- **Python version**: 3.11
- **Key libraries**: rasterio ≥1.3, shapely ≥2.0, xarray, requests, httpx, fastapi, uvicorn, suncalc
- **OS**: macOS (development), Linux (production server)
- **Deployment**: institute Linux server; uvicorn behind nginx reverse proxy

## Data Provenance & Reproducibility

- **Weather/wave/satellite data**: fetched at request time or cached with TTL; not stored in `data/raw/` (ephemeral)
- **Sentinel-2 imagery**: streamed via CDSE WMS/WMTS tiles; not downloaded locally in production
- **Solar geometry**: deterministic; no randomness; no seed needed
- **Orbital propagation (VIIRS)**: deterministic given TLE epoch; TLEs refreshed from CelesTrak daily
- **Floating-point tolerance**: solar elevation ±0.01°; wave height ±0.01 m

## Architectural Decision Records

### ADR-001: Python Backend over Node.js
- **Status**: Accepted
- **Context**: Developer background is Python data science; existing CDSE/rasterio patterns in Sent2_GreenMac are in Python; geospatial libraries (rasterio, shapely, xarray) are first-class in Python
- **Decision**: FastAPI Python backend
- **Rationale**: Reuses existing code patterns; avoids JS geospatial library limitations; conda environment handles GDAL/PROJ dependencies cleanly
- **Consequences**: Frontend must be a separate JS app (Phase 3); slight latency cost vs. Node.js for pure JSON endpoints (acceptable)

### ADR-002: Notebook-First Development
- **Status**: Accepted
- **Context**: Multiple external APIs with varying auth, data formats, and coverage; hard to know what will work until tested interactively
- **Decision**: Prototype each capability in a Jupyter notebook before writing FastAPI endpoints
- **Rationale**: Interactive iteration is faster for data exploration; catch API quirks before committing to an interface design
- **Consequences**: Code must be refactored from notebook to module in Phase 2 (expected cost); notebooks serve as living documentation of API patterns

### ADR-003: CDSE for Sentinel-2 (not AWS Open Data)
- **Status**: Accepted
- **Context**: Sentinel-2 imagery is available on multiple platforms (CDSE, AWS, Google Earth Engine)
- **Decision**: CDSE OData + STAC + WMS/WMTS
- **Rationale**: Operator already registered; EU-hosted (GDPR-friendly); WMS/WMTS tile streaming avoids downloading full scenes; OData API supports overpass prediction by AOI geometry
- **Consequences**: CDSE OAuth2 token refresh must be managed server-side; WMS bandwidth dependent on CDSE availability

### ADR-004: suncalc Python for Solar Geometry
- **Status**: Accepted
- **Context**: Solar geometry needed for both SOL-01 display and SAT-01 pass quality assessment
- **Decision**: Use `suncalc` Python library (port of SunCalc.js)
- **Rationale**: No API key required; fully deterministic; fast local computation; covers all required outputs (sunrise/sunset, twilight, elevation, azimuth)
- **Consequences**: Must validate against USNO Solar API for accuracy (SCENARIO-SOL-ACCURACY-001)
