# Operational Status — BoatOps

> Last updated: 2026-05-21

## Session Handoff Protocol (MANDATORY)

Before your session ends or when you complete significant work, update:
1. **What's Working** — current capabilities
2. **What's Next** — reprioritized next steps
3. Sync to `ops/changelog.md` with what you did

## What's Working

All three phases complete. The full BoatOps stack is running.

### Phase 1 — Jupyter Notebooks (Epic 01 ✅)

| Notebook | Story | Status |
|----------|-------|--------|
| `01_weather.ipynb` | S01-01 | ✅ Done |
| `02_waves.ipynb` | S01-02 | ✅ Done |
| `03_solar.ipynb` | S01-03 | ✅ Done |
| `04_satellite_overpasses.ipynb` | S01-04 | ✅ Done |
| `05_sentinel2_imagery.ipynb` | S01-05 | ✅ Done |
| `06_map_layers.ipynb` | S01-06 | ✅ Done |

### Phase 2 — FastAPI Backend (Epic 02 ✅)

60/60 tests passing. All 6 capability routers live:
- `GET /health`, `/api/weather/{forecast,advisories}`, `/api/waves/{forecast,overlay}`
- `GET /api/solar/{times,elevation}`, `/api/satellite/{overpasses,s2-overlay}`
- `GET /api/map/{bathymetry,sst,salinity,currents,chlorophyll,oxygen}`

### Phase 3 — React + MapLibre GL JS Frontend (Epic 03 ✅)

All 6 stories done:
- **S03-01** Vite 8 + React 18 + TypeScript scaffold; MapLibre GL JS map; API client
- **S03-02** Base map: OSM tiles, OpenSeaMap, GEBCO WMS, EMODnet WMS; layer toggle panel; coordinate display
- **S03-03** Oceanographic overlay layers (6 CMEMS PNG layers): legend, opacity slider, timestamp badge
- **S03-04** Weather + waves panels: 7-day Recharts forecast chart, current conditions card, wave overlay toggle
- **S03-05** Solar + satellite panels: solar times table (Berlin CET), elevation arc gauge, overpass table, S2 overlay toggle
- **S03-06** Go/No-Go dashboard: overall verdict badge, per-capability status rows, threshold settings modal (localStorage), ↻ refresh button, FR-16 AI placeholder

**To start the frontend dev server:** `cd frontend && npm run dev` → http://localhost:5173

## 2026-05-21 Additions
- **Sentinel-1 overpass prediction**: `SATELLITE_CATALOG` now includes `Sentinel-1A` (NORAD 39634) and `Sentinel-1C` (NORAD 62261) with `daytime_only=False` — SAR sensor, valid day and night. Frontend shows them in green (#4ade80) in the overpass table group headers and map track layer.
- **Station markers**: MARNET Fehmarnbelt/Darßer Schwelle/Oder Bank + FINO2 — toggleable MapLibre markers with dark popup showing name, coordinates, station type.
- **Map-click Go/No-Go assessment**: Crosshair mode in sidebar fetches wave Hs + wind/gusts at the clicked location for the active planning hour; popup shows colour-coded verdict using configured thresholds.
- **Surface currents units**: Legend and metadata now show m/s throughout.
- **Time-varying oceanographic overlays**: SST, salinity, chlorophyll, currents (quiver + particle), and wave height overlays now respond to the global forecast-hour slider. Waves update every hour (CMEMS hourly); SST/salinity/chlorophyll/currents update once per day (CMEMS daily model). Raw xarray datasets cached per bbox; PNG rendered per (bbox, hour) in ~50 ms without re-downloading from CMEMS.

## Known Issues / Deferred

- **Live API E2E**: Tests mock all API calls; actual CMEMS/CDSE data path not verified in E2E. Requires live credentials + running backend.
- **MeteoAlarm polygon overlays**: Atom feed has no geometry; DWD WFS not integrated (deferred).
- **USNO solar accuracy (SCENARIO-SOL-ACCURACY-001)**: Placeholder values; formal ±1 min validation pending.
- **Midpass solar elevation**: `Overpass` schema has no `midpass_solar_elevation_deg`; frontend uses daytime proxy. Backend schema extension deferred.
- **FR-16 AI synthesis**: Claude API integration deferred to Phase 4; placeholder shown in dashboard.
- **Chunk size warning**: Vite warns bundle > 500 kB; code-splitting optimization deferred.

## What's Next

Phase 4 options (no epic scoped yet):
1. **FR-16 AI synthesis** — Claude API integration for Go/No-Go reasoning with risk factors and optimal time windows
2. **AOI draw tool** — FR-01 time picker + user-drawn AOI polygon; passes center/bbox to all API calls
3. **NFR-01 load test** — multi-user concurrent sessions; currently untested
4. **E2E coverage for new features** — Playwright tests for TimeSlider, satellite track toggle, isobath layer, GBIF layers, EMODnet popup, wind m/s display

## Recently Closed

- 2026-05-13: **Satellite daytime filter ✅** — `_solar_elevation()` in `celestrak.py` uses de421.bsp (skyfield) to discard nighttime passes; ~12 daytime passes per 7-day Baltic window
- 2026-05-11: **Improvements batch ✅** (feature/improvements-may-2026) — dark vector basemap, seamark +20%, isobath API + frontend layer, wind in m/s, wind vmax cap 20 m/s, 7-day time slider, satellite ground tracks + click-to-time, EMODnet click-to-info popup, GBIF biological layers (Zostera marina + Fucus vesiculosus)
- 2026-05-03: **Production deployment ✅** — Docker Compose; `docker compose up -d` starts the full stack at port 80
- 2026-05-03: **Epic 03 ✅ complete** — all 6 Phase 3 frontend stories done (S03-01 through S03-06)
- 2026-05-03: **Epic 02 ✅ complete** — all 6 Phase 2 backend stories done; 60 tests passing
- 2026-05-02/03: **Epic 01 ✅ complete** — all 6 Phase 1 notebook stories done

## Gate Status

| Epic | Gate 1 | Gate 4 (Raze) | Notes |
|------|--------|---------------|-------|
| Epic 01 (notebooks) | ✅ nbconvert | ✅ | All SCENARIO-* pass |
| Epic 02 (FastAPI) | ✅ pytest 60/60 | ✅ | 4 bugs fixed post-Raze |
| Epic 03 (frontend) | ✅ tsc + vite build | ✅ | Raze run per story; total 14 bugs fixed |
