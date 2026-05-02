# Changelog — BoatOps

Rolling 2-week work log. Remove entries older than 2 weeks.

## 2026-05-02

**S01-06 Map layers notebook — Epic 01 complete**

- **S01-06 ✅** `06_map_layers.ipynb`: OSM + OpenSeaMap tiles confirmed; synthetic raster PNG data URI as ImageOverlay; GEBCO WMS confirmed (`GEBCO_LATEST` at `https://wms.gebco.net/mapserv` — old URL returns 404); EMODnet Seabed Habitats WMS confirmed (`eusm_helcom_group` — `eusm2022` no longer exists, service restructured to per-scale layers); data layer overlays: Open-Meteo wind quiver (3×3 grid, 4.7–14.0 m/s), CMEMS Hs colour-map (150×198 grid, 0.03–0.72 m, land transparent), Sentinel-2 true-colour mosaic (574 KB via SH Process API); all 9 SCENARIO-MAP assertions PASS
- **FR-17 / FR-18 added**: GEBCO and EMODnet added as SHOULD-priority map layer requirements; PRD, spec, traceability updated
- **Epic 01 ✅ Complete** — all 6 Phase 1 notebook stories done

**S01-05 Sentinel-2 imagery notebook + spec-anchor reconciliation**

- **S01-05 ✅** `05_sentinel2_imagery.ipynb`: Sentinel Hub Process API works with CDSE OAuth2 token (no SH instance ID needed); OData used for discovery (STAC has no S2 collection); partial tile check added (spherical Shoelace, ≥50% coverage threshold, adapted from Sent2_GreenMac); PIL needed for JPEG quicklook; OData combined `$expand` rejected (two requests required)
- Reconciled all spec-anchor docs: stories s01-01 through s01-05 → Done; capability specs updated (Implementation Status, Deviations, Deferred); epic-01 story table → 5/6 Done; traceability matrix → all 20 verified scenarios recorded; ops/data-sources → findings from all notebooks

## 2026-05-01

**Bootstrap + Phase 1 notebooks (session 1)**

- Copied spec-anchor-py framework into BoatOps; populated all BMAD docs, capability specs, Epic-01 stories, environment.yml
- Created `boatops` conda environment (Python 3.11); registered Jupyter kernel
- **S01-01 ✅** `01_weather.ipynb`: Open-Meteo wind/temp/precip/cloud confirmed; MeteoAlarm Atom XML parsed; cloud cover query function ready for satellite annotation
- **S01-02 ✅** `02_waves.ipynb`: CMEMS `cmems_mod_bal_wav_anfc_PT1H-i` authenticated (credentials from .env); 1 nmi grid; nearest-wet-cell fallback implemented for Warnemünde coastal mask
- **S01-03 ✅** `03_solar.ipynb`: suncalc validated; all 5 scenarios pass; polar summer edge case handled; `solar_elevation_at_overpass()` ready for satellite annotation
- **S01-04 ✅** `04_satellite_overpasses.ipynb`: CDSE OData Sentinel-2/3 confirmed (100+ products); CelesTrak GP endpoint confirmed (old `satcat/tle.php` deprecated); skyfield TLE propagation for 6 platforms; 22 passes/7 days; 3 optimal windows identified for 2026-05-02

**Credentials configured in `.env`:**
- CDSE: <redacted> (Sentinel-2/3 catalog)
- CMEMS: <redacted> (see .env)
- Earthdata: <redacted> (Landsat — CMR not returning recent data; TLEs used instead)
