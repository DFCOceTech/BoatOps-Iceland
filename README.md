# BoatOps

Operational marine planning web application for Baltic Sea survey missions. Integrates multi-source weather, oceanographic, solar, and satellite data into a single map-based interface for Go/No-Go decision support.

## Overview

BoatOps provides a React + MapLibre GL JS frontend consuming a FastAPI Python backend. All credentials are managed server-side. The app is designed for Blue Boat uncrewed surface vehicle (USV) operations in the German Baltic Sea.

### Capabilities

| Panel | Data source | What it shows |
|-------|-------------|---------------|
| Go/No-Go dashboard | All of the above | Verdict badge (GO / CAUTION / NO-GO) + per-capability status rows with configurable thresholds |
| Location assessment | CMEMS + Open-Meteo | Click anywhere on the map for an instant Go/No-Go assessment (waves + wind at the active planning hour) |
| Weather | Open-Meteo | 7-day wind (m/s), temperature, precipitation, cloud cover; MeteoAlarm advisories |
| Waves | CMEMS Baltic wave model | Significant wave height Hs, wave direction; time-varying overlay (hourly) |
| Solar | suncalc Python library | Sunrise/sunset, civil/nautical/astronomical twilight, solar elevation arc |
| Satellite | CelesTrak TLE + CDSE OData | Overpass table for Sentinel-1 A/C (SAR, day+night), Sentinel-2/3, Landsat 8/9, VIIRS; ground track overlay; latest cloud-free Sentinel-2 imagery |
| Oceanographic | CMEMS Baltic models | SST, salinity, surface currents (animated, m/s), chlorophyll, bottom oxygen — all time-varying |
| Monitoring stations | BSH / PTB | MARNET buoys (Fehmarnbelt, Darßer Schwelle, Oder Bank) and FINO2 offshore platform |

### Map Layers

| Toggle | Source |
|--------|--------|
| OpenSeaMap Seamarks | OpenSeaMap raster tiles (20% larger icons) |
| GEBCO Bathymetry | GEBCO WMS |
| EMODnet Seabed Habitats | EMODnet WMS (click-to-info popup) |
| Isobaths (10/25/100 m) | CMEMS static bathymetry, GeoJSON contour lines |
| MARNET buoys & FINO2 | Static markers — click for station details |
| Wind overlay | Animated particles, Open-Meteo grid (time-varying) |
| Surface currents | Animated particles, CMEMS physics model (time-varying, m/s) |
| SST overlay | CMEMS SST L4 NRT, time-varying |
| Salinity overlay | CMEMS Baltic Physics, time-varying |
| Chlorophyll overlay | CMEMS Baltic BGC, log-scale, time-varying |
| Wave height overlay | CMEMS wave model, time-varying (hourly) |
| Satellite ground tracks | Vector lines derived from TLE propagation |
| Sentinel-2 imagery | CDSE Sentinel Hub Process API |
| GBIF occurrence layers | Zostera marina, Fucus vesiculosus |

## Quick Start

### Prerequisites

- [Miniforge](https://github.com/conda-forge/miniforge) (conda package manager)
- [Node.js 20+](https://nodejs.org/) + npm

### Backend

```bash
# Create and activate the conda environment
conda env create -f environment.yml
conda activate boatops

# Install the Python package in editable mode
pip install -e ".[dev]"

# Copy the environment template and fill in credentials
cp .env.example .env
# Edit .env: CMEMS_USERNAME, CMEMS_PASSWORD, CDSE_EMAIL, CDSE_PASSWORD

# Run the FastAPI development server
uvicorn boatops.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api/* to :8000)
```

### Docker (production)

```bash
# Builds the frontend and API images (no local Node or conda needed), then starts the stack
docker compose up -d --build
# App available at http://localhost:80
```

## Development

### Commands

```bash
# Unit tests
pytest tests/ -v --tb=short

# E2E tests
pytest tests/e2e/ -v --tb=short

# Lint
ruff check .

# Type-check
mypy src/boatops/

# Format
ruff format .

# Build frontend
cd frontend && npm run build
```

### Repository Layout

```
src/boatops/
  main.py              FastAPI app entry point
  config.py            Settings loaded from .env (pydantic-settings)
  routers/             Per-capability API routers
  services/            External API clients and data processing

frontend/src/
  App.tsx              Root component — MapProvider + TimeProvider
  components/          React components (MapView, panels, TimeSlider)
  config/              Layer definitions, dark basemap style
  context/             MapContext, GoNoGoContext, TimeContext
  hooks/               useApiLayers, useFetch (time-aware layer management)
  utils/               popupStyles (shared MapLibre dark popup CSS)
  api/client.ts        Typed API client

openspec/              Capability specifications (spec.md, design.md)
_bmad/                 Strategic docs (PRD, architecture, traceability)
epics/                 Epics and stories
ops/                   Status, changelog, metrics, test results, git workflow
notebooks/             Phase 1 prototype notebooks (one per capability)
tests/                 Unit + integration tests
```

### Key Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CMEMS_USERNAME` | Yes | Copernicus Marine Service username |
| `CMEMS_PASSWORD` | Yes | Copernicus Marine Service password |
| `CDSE_EMAIL` | Yes | Copernicus Data Space Ecosystem email |
| `CDSE_PASSWORD` | Yes | CDSE password (for Sentinel-2 imagery) |
| `CLAUDE_API_KEY` | No | Anthropic API key (for future AI synthesis) |

## Planning Time Slider

A time slider at the bottom of the map spans a 7-day forecast window (168 hourly steps). Sliding it updates:

- **Weather panel** — conditions for the selected hour
- **Wind overlay** — refetches wind particle grid for the selected hour
- **Wave height overlay** — updates every hour (CMEMS hourly wave model)
- **SST, salinity, chlorophyll, currents overlays** — update once per day (CMEMS daily model; 7 distinct states across the 7-day window)
- **Satellite panel** — clicking a pass row snaps the slider to that pass's AOS time

All CMEMS datasets are fetched once per bbox and cached for 1 hour; slider steps render from the cached dataset without re-downloading.

## Satellite Overpass Predictions

The Satellite panel shows predicted overpass windows for 10 platforms derived from CelesTrak TLEs and skyfield orbital propagation:

| Platform | Sensor | Day-only filter |
|----------|--------|-----------------|
| Sentinel-1A / 1C | SAR | No — valid day and night |
| Sentinel-2A / 2B | MSI (optical) | Yes |
| Sentinel-3A / 3B | OLCI/SLSTR (optical) | Yes |
| Landsat 8 / 9 | OLI (optical) | Yes |
| Suomi-NPP (VIIRS) | VIIRS (optical) | Yes |
| NOAA-20 (VIIRS) | VIIRS (optical) | Yes |

Enable "Show satellite tracks" to overlay predicted ground tracks on the map, colour-coded by platform. Click any pass row to jump the planning time to that pass's acquisition-of-signal moment.

## Location Assessment

Enable "Click map for Go/No-Go assessment" in the sidebar to enter crosshair mode. Click any point in the AOI to fetch:

- **Wave Hs** at the clicked location (CMEMS, nearest wet cell fallback)
- **Wind speed and gusts** at the active planning hour (Open-Meteo)

A popup appears at the clicked location showing an overall GO / CAUTION / NO-GO verdict with colour-coded rows, using the same thresholds as the main dashboard.

## Monitoring Stations

Toggle "MARNET buoys & FINO2" to show four markers on the map:

| Station | Type | Position |
|---------|------|----------|
| MARNET Fehmarnbelt | BSH monitoring buoy | 54.595°N 11.183°E |
| MARNET Darßer Schwelle | BSH monitoring buoy | 54.700°N 12.700°E |
| MARNET Oder Bank | BSH monitoring buoy | 54.067°N 14.152°E |
| FINO2 | Offshore research platform | 55.010°N 13.157°E |

Click any marker for its name, coordinates, and station type.

## Data Sources

| Source | Access | Cache TTL |
|--------|--------|-----------|
| Open-Meteo (weather + wind) | Free, no auth | 15 min |
| CMEMS Baltic wave model | CMEMS credentials | 1 h (dataset); 1 h (PNG per hour) |
| CMEMS Baltic physics (SST, salinity, currents) | CMEMS credentials | 1 h (dataset); 1 h (PNG per hour) |
| CMEMS Baltic BGC (chlorophyll, oxygen) | CMEMS credentials | 1 h (dataset); 1 h (PNG per hour) |
| CMEMS static bathymetry | CMEMS credentials | 24 h |
| CDSE OData (satellite overpasses) | CDSE credentials | 1 h |
| CDSE Sentinel Hub (imagery) | CDSE credentials | on-demand |
| CelesTrak TLE (orbital propagation) | Free, no auth | 1 h |
| MeteoAlarm advisories | Free, no auth | 5 min |
| OpenSeaMap | Free, no auth | tile CDN |
| OpenFreeMap (base map) | Free, no auth | tile CDN |

## Architecture

See [`_bmad/architecture.md`](_bmad/architecture.md) for the full architecture document.

```
Browser
  └── React + MapLibre GL JS frontend
        └── /api/* → FastAPI backend
              ├── Open-Meteo
              ├── CMEMS (wave, physics, BGC, static)
              ├── CDSE OData + Sentinel Hub
              ├── CelesTrak TLE + skyfield
              ├── MeteoAlarm
              └── suncalc (local computation)
```

## Roadmap

- **FR-16 AI synthesis** — Claude API Go/No-Go reasoning with risk factors and optimal time windows
- **AOI draw tool** — user-drawn polygon constrains all data queries
- **NFR-01 load test** — multi-user concurrent sessions

## Contributing

Follow the spec-anchored development workflow in [`CLAUDE.md`](CLAUDE.md). Every change must update the relevant spec in `openspec/`, include unit tests, and pass `pytest + ruff + mypy` before commit.
