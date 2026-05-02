# Operational Status — BoatOps

> Last updated: 2026-05-01

## Session Handoff Protocol (MANDATORY)

Before your session ends or when you complete significant work, update:
1. **What's Working** — current capabilities
2. **What's Next** — reprioritized next steps
3. Sync to `ops/changelog.md` with what you did

## What's Working

Phase 1 notebook prototypes — 4 of 6 complete:

| Notebook | Story | Status | Key finding |
|----------|-------|--------|-------------|
| `01_weather.ipynb` | S01-01 | ✅ Done | Open-Meteo: 168h wind/temp/cloud/precip; MeteoAlarm: Atom/XML (no polygon geometry — DWD WFS needed for map overlays) |
| `02_waves.ipynb` | S01-02 | ✅ Done | CMEMS `cmems_mod_bal_wav_anfc_PT1H-i`; 1 nmi res; Warnemünde is a land-masked cell — nearest wet cell search needed |
| `03_solar.ipynb` | S01-03 | ✅ Done | suncalc returns tz-naive pd.Timestamps (not None) for missing events; `(lng, lat)` arg order; altitudes in radians |
| `04_satellite_overpasses.ipynb` | S01-04 | ✅ Done | CDSE OData: 100 S2 products/10 days; TLEs: 22 passes/7 days across 6 platforms; 3 optimal windows tomorrow |
| `05_sentinel2_imagery.ipynb` | S01-05 | ⏳ Next | CDSE STAC + WMS tile streaming |
| `06_map_layers.ipynb` | S01-06 | ⏳ Backlog | OSM, OpenSeaMap, WMS/WMTS, GeoTIFF |

## Known Issues

- MeteoAlarm Atom feed has no polygon geometry — for map overlays, investigate DWD WFS or EUMETNET GeoJSON API
- Warnemünde grid point is land-masked in CMEMS wave model — Phase 2 service must use nearest-wet-cell fallback
- NASA CMR unusable for forward Landsat planning (processing lag); TLE propagation used instead (confirmed working)
- USNO Solar accuracy comparison (SCENARIO-SOL-ACCURACY-001) still has placeholder values — needs real USNO lookup

## What's Next

1. **s01-05**: `05_sentinel2_imagery.ipynb` — CDSE STAC imagery search + WMS tile URL construction (CDSE credentials ready)
2. **s01-06**: `06_map_layers.ipynb` — OSM/OpenSeaMap tile validation, GeoTIFF display, WMS layer test
3. After all 6 notebooks: begin Epic 2 (Phase 2 FastAPI backend)

## Recently Closed

- 2026-05-01: Bootstrap session — framework scaffolded, all docs populated
- 2026-05-01: S01-01 ✅ weather notebook (Open-Meteo + MeteoAlarm)
- 2026-05-01: S01-02 ✅ waves notebook (CMEMS Baltic Wave forecast)
- 2026-05-01: S01-03 ✅ solar geometry notebook (suncalc)
- 2026-05-01: S01-04 ✅ satellite overpasses (CDSE OData + CelesTrak TLEs + skyfield)

## Gate Status for Sprint 0 (Phase 1 Notebooks)

| Gate | Status | Artifact |
|------|--------|----------|
| Gate 1 (Self-check) | In progress — 4/6 notebooks passing | `notebooks/0[1-4]_*.ipynb` |
| Gate 2 (Evaluator) | Not started | — |
| Gate 3 (Reconciliation) | Not started | — |
| Gate 4 (Adversarial) | Not started | — |
