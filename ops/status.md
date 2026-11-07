# Operational Status — BoatOps Iceland

> Last updated: 2026-11-07 · Conda env: `boatops-iceland` (Python 3.11)

## What's Working
- Backend (FastAPI): `/api/weather/{forecast,wind-grid,advisories}`, `/api/marine/forecast`, `/api/solar/*`, `/api/satellite/{overpasses,s1-overlay,s2-overlay,download-info}`, `/api/stations/nearby`. 91 pytest tests pass. Live endpoints (Open-Meteo, Open-Meteo Marine, CelesTrak, Meteoalarm IS) verified against the running server.
- Frontend: Work Site panel (type / pick / drag / save / export / share via URL), Go/No-Go, wind field, weather, local conditions (nearest IMO/Vegagerðin automatic stations, with map markers, 5-min refresh), tide & sea state, solar, S1/S2 imagery, overpasses, planned acquisitions, local GeoTIFF overlays. 37 Playwright tests pass on Chromium (mocked API).
- Overpass prediction uses imaging swath width (approximate; Sentinel-1 actually looks right of nadir). VIIRS and Sentinel-3 were dropped (swaths too wide to be meaningful for a point site). Adversarial review (Raze) findings fixed: input validation, TLE cache, IW dual-pol S1 filter, marine cache rounding, expired-forecast guard.

## Not yet verified
- `docker compose up --build` (no Docker on the authoring Mac) — also covers the shapely/frontend fixes from BoatOps PR #1.
- Live Sentinel-1 *EW/HH* retrieval: IW and S2 were fetched live by the project owner with real CDSE credentials (2026-10-25); EW/HH is unit-tested with mocks only and needs a real scene.
- Local GeoTIFFs verified only with synthetic files (EPSG 4326 / 32628) — try a real drone ortho (with overviews) and a real sonar raster; report any CRS/compression that fails.
- Automated Firefox/WebKit Playwright projects (browser binaries would not launch on the authoring machine). Manual testing in Firefox by the project owner covered the app end to end (2026-10-25); Safari/WebKit untested.

## Decisions / findings
- Local conditions use `api.vedur.is` (open, no key); it also carries the Vegagerðin (umferdin.is) stations. gottvedur.is station 9080 (Jökulsárlón) is a *virtual forecast point* with no observations and no public API, so it is not used. Nearest real stations are 15–50 km away.
- DMI DINI (HARMONIE, 2 km) does cover the lagoon and is reachable keyless via Open-Meteo `models=dmi_harmonie_arome_europe` (~75 h horizon). Idea, not built: plot it as a second wind line for the first ~3 days. GribStream is not needed. No forecast-vs-station comparison has been done.

## What's Next
0. Merge/review parent-repo Docker PR (DFCOceTech/BoatOps #1).
1. Run with real CDSE credentials; tune S1 evalscript/look-back on a recent lagoon scene.
2. `docker compose up --build` on a clean machine.
3. Optional: ice-chart overlays (IMO/Veðurstofa), drone-flight checklist, GPX export of sites.
