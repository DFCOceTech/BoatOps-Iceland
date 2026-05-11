# BoatOps

Operational marine planning web application for Baltic Sea survey missions. Integrates multi-source weather, oceanographic, solar, and satellite data into a single map-based interface for Go/No-Go decision support.

## Overview

BoatOps provides a React + MapLibre GL JS frontend consuming a FastAPI Python backend. All credentials are managed server-side. The app is designed for Blue Boat uncrewed surface vehicle (USV) operations in the German Baltic Sea.

### Capabilities

| Panel | Data source | What it shows |
|-------|-------------|---------------|
| Weather | Open-Meteo | 7-day wind (m/s), temperature, precipitation, cloud cover; MeteoAlarm advisories |
| Waves | CMEMS Baltic wave model | Significant wave height Hs, wave direction |
| Solar | suncalc Python library | Sunrise/sunset, civil/nautical/astronomical twilight, solar elevation arc |
| Satellite | CelesTrak TLE + CDSE OData | Overpass table for Sentinel-2/3, Landsat 8/9, VIIRS; ground track overlay; latest cloud-free Sentinel-2 imagery |
| Oceanographic | CMEMS Baltic models | SST, salinity, surface currents (animated), chlorophyll, bottom oxygen |
| Go/No-Go | All of the above | Verdict badge + per-capability status rows with configurable thresholds |

### Map Layers

| Toggle | Source |
|--------|--------|
| OpenSeaMap Seamarks | OpenSeaMap raster tiles (20% larger icons) |
| GEBCO Bathymetry | GEBCO WMS |
| EMODnet Seabed Habitats | EMODnet WMS |
| Isobaths (10/25/100 m) | CMEMS static bathymetry, generated as GeoJSON contour lines |
| Wind overlay | Animated particles, Open-Meteo grid |
| Surface currents | Animated particles, CMEMS physics model |
| Satellite ground tracks | Vector lines derived from TLE propagation |
| Sentinel-2 imagery | CDSE Sentinel Hub Process API |

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
# Build frontend first
cd frontend && npm run build && cd ..

# Start the full stack (FastAPI + nginx)
docker compose up -d
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

### Planning Time Slider

A time slider at the bottom of the map spans a 7-day forecast window (168 hourly steps). Sliding it updates:
- **Weather panel** — shows conditions for the selected hour from the cached 7-day forecast
- **Wind overlay** — refetches wind grid for the selected hour
- **Satellite panel** — clicking a pass row snaps the slider to that pass's AOS time

### Satellite Ground Tracks

Enable "Show satellite tracks" in the Satellite panel to overlay predicted ground tracks on the map (Sentinel-2/3, Landsat 8/9, VIIRS). Click any pass row in the overpass table to jump the planning time to that pass's acquisition-of-signal moment.

## Data Sources

| Source | Access | Latency |
|--------|--------|---------|
| Open-Meteo (weather) | Free, no auth | 15-min cache |
| CMEMS Baltic wave model | CMEMS credentials | 1-h cache |
| CMEMS Baltic physics (SST, salinity, currents) | CMEMS credentials | 1-h cache |
| CMEMS Baltic BGC (chlorophyll, oxygen) | CMEMS credentials | 1-h cache |
| CMEMS static bathymetry | CMEMS credentials | 24-h cache |
| CDSE OData (satellite overpasses) | CDSE credentials | 1-h cache |
| CDSE Sentinel Hub (imagery) | CDSE credentials | on-demand |
| CelesTrak TLE (orbital propagation) | Free, no auth | 1-h cache |
| MeteoAlarm advisories | Free, no auth | 5-min cache |
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
