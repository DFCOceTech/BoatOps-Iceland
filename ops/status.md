# Operational Status — BoatOps Iceland

> Last updated: 2026-10-25 · Conda env: `boatops-iceland` (Python 3.11)

## What's Working
- Backend (FastAPI): `/api/weather/{forecast,wind-grid,advisories}`, `/api/marine/forecast`, `/api/solar/*`, `/api/satellite/{overpasses,s1-overlay,s2-overlay}`. 79 pytest tests pass. Live endpoints (Open-Meteo, Open-Meteo Marine, CelesTrak, Meteoalarm IS) verified against the running server.
- Frontend: Work Site panel (type / pick / drag / save / export / share via URL), Go/No-Go, wind field, weather, tide & sea state, solar, S1/S2 imagery, overpasses. 21 Playwright tests pass on Chromium (mocked API).
- Overpass prediction uses imaging swath width (approximate; Sentinel-1 actually looks right of nadir). VIIRS and Sentinel-3 were dropped (swaths too wide to be meaningful for a point site). Adversarial review (Raze) findings fixed: input validation, TLE cache, IW dual-pol S1 filter, marine cache rounding, expired-forecast guard.

## Not yet verified
- `docker compose up --build` (no Docker on the authoring Mac) — also covers the shapely/frontend fixes from BoatOps PR #1.
- Live Sentinel-1/2 retrieval (needs CDSE credentials): the S1 Sentinel Hub request (`sentinel-1-grd`, `SIGMA0_ELLIPSOID`, orthorectify, DV) and OData `contains(Name,'GRD')` filter are unit-tested with mocks only. **First thing to test with real credentials.**
- Local GeoTIFFs verified only with synthetic files (EPSG 4326 / 32628) — try a real drone ortho (with overviews) and a real sonar raster; report any CRS/compression that fails.
- Firefox/WebKit Playwright projects (browser binaries mismatched on the authoring machine).

## What's Next
1. Run with real CDSE credentials; tune S1 evalscript/look-back on a recent lagoon scene.
2. `docker compose up --build` on a clean machine.
3. Optional: ice-chart overlays (IMO/Veðurstofa), drone-flight checklist, GPX export of sites.
