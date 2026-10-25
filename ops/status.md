# Operational Status — BoatOps Iceland

> Last updated: 2026-10-25 · Conda env: `boatops-iceland` (Python 3.11)

## What's Working
- Backend (FastAPI): `/api/weather/{forecast,wind-grid,advisories}`, `/api/marine/forecast`, `/api/solar/*`, `/api/satellite/{overpasses,s1-overlay,s2-overlay}`. 56 pytest tests pass. Live endpoints (Open-Meteo, Open-Meteo Marine, CelesTrak, Meteoalarm IS) verified against the running server.
- Frontend: Work Site panel (type / pick / drag / save / export / share via URL), Go/No-Go, wind field, weather, tide & sea state, solar, S1/S2 imagery, overpasses. 21 Playwright tests pass on Chromium (mocked API).
- Overpass prediction now uses imaging swath width (a 12 km site box almost never intersects a nadir track).

## Not yet verified
- `docker compose up --build` (no Docker on the authoring Mac) — also covers the shapely/frontend fixes from BoatOps PR #1.
- Live Sentinel-1/2 retrieval (needs CDSE credentials): the S1 Sentinel Hub request (`sentinel-1-grd`, `SIGMA0_ELLIPSOID`, orthorectify, DV) and OData `contains(Name,'GRD')` filter are unit-tested with mocks only. **First thing to test with real credentials.**
- Firefox/WebKit Playwright projects (browser binaries mismatched on the authoring machine).

## What's Next
1. Run with real CDSE credentials; tune S1 evalscript/look-back on a recent lagoon scene.
2. `docker compose up --build` on a clean machine.
3. Optional: ice-chart overlays (IMO/Veðurstofa), drone-flight checklist, GPX export of sites.
