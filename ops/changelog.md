# Changelog — BoatOps

Rolling 2-week work log. Remove entries older than 2 weeks.

## 2026-05-02

**S01-06 visualization rewrite — cmocean + Leaflet.velocity**

- All colormaps replaced with cmocean perceptually uniform palettes: `deep` (bathymetry), `amp` (waves), `thermal` (SST), `haline` (salinity), `speed` (currents), `algae` (chlorophyll), `oxy` (bottom O₂)
- GEBCO WMS and EMODnet Bathymetry WMS both found fully opaque (alpha=255 on all pixels); replaced with `deptho` from `cmems_mod_bal_phy_anfc_static` — NaN=land → transparent marine-only overlay
- ipyleaflet 0.20 lacks VelocityLayer; implemented Leaflet.velocity animated particle maps using folium + jsdelivr CDN (v1.9.1); windy.com-style visualizations for surface currents and wave propagation
- Sentinel-2: switched from cloud-free mosaic to single scene query (OData `$orderby ContentDate/Start desc`, `cloudCover lt 20`) followed by time-matched SH Process API render
- Chlorophyll plotted on log scale (`LogNorm(vmin=0.1, vmax=50)`) via cmocean.algae
- Combined map updated: GEBCO WMSLayer → `bathy_uri` ImageOverlay; `cur_uri` quiver removed (animated velocity map handles currents)
- `cmocean` and `folium` added to `environment.yml`; all 14 SCENARIO-MAP assertions PASS

**S01-06 Map layers notebook — Epic 01 complete**

- **S01-06 ✅** `06_map_layers.ipynb`: OSM + OpenSeaMap tiles; GEBCO WMS (`GEBCO_LATEST`, new URL); EMODnet WMS (`eusm_helcom_group`); GeoTIFF ImageOverlay pattern; data overlays: wind quiver, CMEMS Hs, Sentinel-2 (574 KB); CMEMS oceanographic overlays: SST L4 (6.1–12.5 °C), salinity (0–20.4 PSU), currents (0–0.33 m/s), chlorophyll log-scale (0.05–149 mg/m³), bottom O2 (0–474 mmol/m³); all 14 SCENARIO-MAP assertions PASS; combined map has 12 toggleable layers
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
