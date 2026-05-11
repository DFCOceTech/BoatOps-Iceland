# Map — Specification

> Version: 1.1 | Status: Draft | Last updated: 2026-05-02

## Purpose

Provide the interactive web GIS base map that hosts all data layers. Supports pan/zoom in 2D and 3D, layer toggling, time/date picker, AOI definition, OpenStreetMap and OpenSeaMap overlays, user-provided GeoTIFF upload, and user-specified WMS/WMTS layer fetch.

## Functional Requirements

### REQ-MAP-001: Interactive Web Map
The system SHALL provide an interactive 2D and 3D web map with pan, zoom, and navigation controls. The map SHALL support toggling individual data layers on and off. A time/date picker SHALL allow users to set the planning window (date + time range) that drives all time-sensitive layers.

### REQ-MAP-002: AOI Definition
The map SHALL allow users to define an area of interest (AOI) by drawing a bounding box or polygon. The AOI SHALL be used to constrain all data queries.

### REQ-MAP-003: OpenStreetMap Base Layer
An OpenStreetMap tile layer SHALL be available as a toggleable base layer, sourced from the standard OSM tile server.

### REQ-MAP-004: OpenSeaMap Nautical Chart Overlay
An OpenSeaMap nautical chart seamark overlay SHALL be available as a toggleable layer, sourced from the OpenSeaMap tile server.

### REQ-MAP-005: User-Provided GeoTIFF
Users SHALL be able to upload a GeoTIFF file (e.g., drone orthomosaic) which the system SHALL render as a georeferenced map overlay.

### REQ-MAP-006: User-Specified WMS/WMTS Layers
Users SHALL be able to add a custom WMS or WMTS layer by providing a service URL and optional layer name. The system SHALL fetch and display the layer on the map.

### REQ-MAP-007: GEBCO Bathymetry Layer
The system SHALL provide a toggleable GEBCO bathymetry overlay sourced from the GEBCO WMS (`https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv`), displaying the `GEBCO_LATEST` layer (2023 15-arc-second grid). The layer SHALL be styled to show water depth in colour over the Baltic AOI.

### REQ-MAP-012: Baltic SST L4 Overlay
The system SHALL render the DMI Baltic Sea SST L4 NRT product (`analysed_sst`, converted from Kelvin to °C) as a colour-mapped ImageOverlay.

### REQ-MAP-013: Baltic Salinity Overlay
The system SHALL render CMEMS Baltic Physics surface salinity (`so` at depth ≈ 0.5 m) as a colour-mapped ImageOverlay, with land/NaN cells transparent.

### REQ-MAP-014: Baltic Surface Current Overlay
The system SHALL render CMEMS Baltic Physics surface current vectors (`uo`, `vo` at depth ≈ 0.5 m) as an animated particle overlay using the same canvas particle system as the wind overlay. Current speed SHALL be encoded as colour (cmocean.speed approximation: navy → teal → lime). The overlay SHALL be fetched via `GET /api/map/currents-grid` returning a JSON velocity grid at 0.25° resolution; `vmax_speed` SHALL be capped at the 99.5th percentile with a 1.5 m/s physical ceiling.

### REQ-MAP-015: Baltic Chlorophyll Overlay
The system SHALL render CMEMS Baltic BGC surface chlorophyll (`chl` at depth ≈ 0.5 m) as a log-scale colour-mapped ImageOverlay, with land/NaN cells transparent.

### REQ-MAP-016: Baltic Bottom Oxygen Overlay
The system SHALL render CMEMS Baltic BGC bottom dissolved oxygen (`o2b`, mmol/m³) as a colour-mapped ImageOverlay. The hypoxia threshold (63 mmol/m³ ≈ 2 mg/L) SHOULD be visually marked in the colour scale.

### REQ-MAP-017: Dark Vector Base Map
The system SHALL use a free vector tile base map (no API key required) styled with land colour `#090909` (nearly black) and water colour `#1e3278` (dark blue, RGB 30/50/120). The vector base map SHALL replace the OpenStreetMap raster tile layer.

### REQ-MAP-018: Isobath Contour Layers
The system SHALL render depth contour lines at 10 m, 25 m, and 100 m from CMEMS static bathymetry (`deptho`) as vector line layers on the map. Each depth SHALL have a visually distinct colour. The isobaths SHALL be served from `GET /api/map/isobaths` as a GeoJSON FeatureCollection.

### REQ-MAP-019: Dimmed Base Map Layers
Land fill layers in the vector base map SHALL be rendered at 0.85 opacity so that oceanographic overlays are visually prominent against the dark background.

### REQ-MAP-020: Seamark Icon Scale
The OpenSeaMap seamark tile layer SHALL render at 20% larger than the default (tile display size 307 px vs. 256 px) to improve readability at operational zoom levels.

### REQ-MAP-021: Time-Controlled Wind Overlay
The animated wind particle overlay SHALL accept an optional `hour` parameter (0–167, representing hours from current UTC) so the overlay displays wind conditions for a user-selected planning hour rather than always showing the current hour.

### REQ-MAP-009: Wind Field Overlay
The system SHALL render wind speed and direction from the Open-Meteo forecast as a vector-field ImageOverlay covering the AOI bbox, updated for the active planning time. Wind vectors SHALL encode both speed (colour) and direction (arrow).

### REQ-MAP-010: Wave Height Overlay
The system SHALL render CMEMS significant wave height (Hs) as a colour-mapped ImageOverlay covering the AOI bbox, with land/masked cells rendered transparent.

### REQ-MAP-011: Sentinel-2 Imagery Overlay
The system SHALL fetch the least-cloud-cover Sentinel-2 Level-2A true-colour mosaic via the CDSE Sentinel Hub Process API and render it as an ImageOverlay on the map.

### REQ-MAP-008: EMODnet Seabed Habitats Layer
The system SHALL provide a toggleable EMODnet Seabed Habitats overlay sourced from the EMODnet WMS (`https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms`), displaying the `eusm_helcom_group` HELCOM Baltic seabed habitat classification layer. The layer SHALL be available for the Baltic Sea coverage area.

## Acceptance Scenarios

### SCENARIO-MAP-OSM-001: OSM tiles load for Baltic AOI
**GIVEN** the map is centered on the German Baltic coast  
**WHEN** the OSM base layer is enabled  
**THEN** OSM tiles load without error and display coastlines, roads, and place names at zoom levels 6–15

### SCENARIO-MAP-SEAMAP-001: OpenSeaMap overlay renders
**GIVEN** the map is centered on a Baltic coastal area  
**WHEN** the OpenSeaMap overlay is enabled  
**THEN** nautical seamark symbols (buoys, depth contours, shipping lanes) render over the base map

### SCENARIO-MAP-AOI-001: AOI draw creates bounding box
**GIVEN** the user activates the AOI draw tool  
**WHEN** the user draws a rectangle on the map  
**THEN** the AOI polygon is set; all time-sensitive data layers reload with the new bbox; the AOI is visually highlighted

### SCENARIO-MAP-GEOTIFF-001: GeoTIFF upload renders as overlay
**GIVEN** a valid GeoTIFF file with EPSG:4326 or reprojectable CRS  
**WHEN** the user uploads the file  
**THEN** the GeoTIFF renders as a georeferenced overlay on the map at the correct location and extent

### SCENARIO-MAP-WMS-001: User-added WMS layer loads
**GIVEN** a valid WMS service URL (e.g., a BSH or DWD WMS)  
**WHEN** the user provides the URL and layer name  
**THEN** the WMS tiles load and display on the map; if the URL is invalid, an error message is shown

### SCENARIO-MAP-GEBCO-001: GEBCO bathymetry renders over Baltic AOI
**GIVEN** the map is centered on the German Baltic coast  
**WHEN** the GEBCO bathymetry toggle is enabled  
**THEN** the `GEBCO_LATEST` WMS layer loads without authentication, renders depth contours over the Baltic, and the GetCapabilities response confirms layer availability

### SCENARIO-MAP-EMODNET-001: EMODnet Seabed Habitats layer renders
**GIVEN** the map is centered on the German Baltic coast  
**WHEN** the EMODnet Seabed Habitats toggle is enabled  
**THEN** the EUSM 2022 WMS layer loads without authentication, renders habitat classification polygons over the Baltic, and the GetCapabilities response confirms layer availability

### SCENARIO-MAP-SST-OVERLAY-001: SST L4 renders as ImageOverlay
**GIVEN** CMEMS Baltic SST L4 NRT data for the current day over the Baltic AOI
**WHEN** `analysed_sst` is converted to °C and colour-mapped to a PNG
**THEN** the overlay displays on the map; SST values in [−2, 30] °C; array not all-NaN

### SCENARIO-MAP-SAL-OVERLAY-001: Salinity renders as ImageOverlay
**GIVEN** CMEMS Baltic Physics surface salinity for the current day over the Baltic AOI
**WHEN** `so` (depth=0) is colour-mapped to a PNG with NaN cells transparent
**THEN** the overlay displays; salinity values in [0, 35] PSU; array not all-NaN

### SCENARIO-MAP-CUR-OVERLAY-001: Surface current animated particle overlay renders
**GIVEN** CMEMS Baltic Physics `uo`, `vo` at surface for the current day
**WHEN** `GET /api/map/currents-grid` is called for the Baltic AOI
**THEN** the response is a JSON grid with `u`, `v`, `width`, `height`, `bbox`, `timestamp`, `vmax_speed`; `vmax_speed` is ≤ 1.5 m/s; the frontend animates particles over the map canvas

### SCENARIO-MAP-CHL-OVERLAY-001: Chlorophyll renders as ImageOverlay
**GIVEN** CMEMS Baltic BGC surface chlorophyll for the current day over the Baltic AOI
**WHEN** `chl` (depth=0) is log-scale colour-mapped to a PNG with NaN cells transparent
**THEN** the overlay displays; chlorophyll values > 0 mg/m³; array not all-NaN

### SCENARIO-MAP-O2B-OVERLAY-001: Bottom oxygen renders as ImageOverlay
**GIVEN** CMEMS Baltic BGC bottom oxygen (`o2b`) for the current day
**WHEN** the 2-D array is colour-mapped to a PNG with the hypoxia threshold visible
**THEN** the overlay displays; O₂ values in [0, 500] mmol/m³; array not all-NaN

### SCENARIO-MAP-WIND-OVERLAY-001: Wind field renders as ImageOverlay
**GIVEN** Open-Meteo wind forecasts fetched at a 3×3 sample grid over the Baltic AOI  
**WHEN** the wind vectors are rendered to a transparent PNG and added as an ImageOverlay  
**THEN** the overlay displays on the map without error; grid shape is (3, 3); data URI is a valid PNG

### SCENARIO-MAP-WAVE-OVERLAY-001: Wave height renders as ImageOverlay
**GIVEN** CMEMS VHM0 data for the current forecast hour over the Baltic AOI  
**WHEN** the gridded Hs array is colour-mapped to a PNG (NaN cells transparent) and added as an ImageOverlay  
**THEN** the overlay displays on the map; Hs values are in [0, 10] m; the array is not all-NaN

### SCENARIO-MAP-S2-OVERLAY-001: Sentinel-2 imagery renders as ImageOverlay
**GIVEN** a valid CDSE OAuth2 token  
**WHEN** the least-cloud-cover Sentinel-2 L2A mosaic is requested via the SH Process API for the AOI bbox  
**THEN** the response is HTTP 200 with `image/png` content; the PNG is added as an ImageOverlay; file size > 10 KB

### SCENARIO-MAP-DARK-001: Dark vector base map renders over Baltic AOI
**GIVEN** the BoatOps web app is loaded  
**WHEN** the map displays  
**THEN** land areas render as `#090909` (nearly black) and water areas as `#1e3278` (dark blue); no OpenStreetMap raster tiles are loaded

### SCENARIO-MAP-ISOBATH-001: Isobath vector lines render at 10 / 25 / 100 m
**GIVEN** `GET /api/map/isobaths` is called for the Baltic AOI bbox  
**WHEN** the CMEMS `deptho` data is processed  
**THEN** the response is a GeoJSON FeatureCollection; features with `depth_m = 10`, `25`, and `100` are all present; each geometry is a valid LineString with at least 2 coordinates; the isobath lines render as distinct vector line layers on the map

## Data Contracts

### Inputs
| Name | Source | Notes |
|------|--------|-------|
| OSM tiles | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | No auth; usage policy applies |
| OpenSeaMap tiles | `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png` | No auth |
| GEBCO WMS | `https://wms.gebco.net/mapserv` | No auth; layer: `GEBCO_LATEST` |
| EMODnet Seabed Habitats WMS | `https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms` | No auth; layer: `eusm_helcom_group` |
| Open-Meteo wind grid | `https://api.open-meteo.com/v1/forecast` | No auth; `wind_speed_10m`, `wind_direction_10m`; one request per grid point |
| CMEMS Baltic Wave | `copernicusmarine.open_dataset` | CMEMS credentials; dataset `cmems_mod_bal_wav_anfc_PT1H-i`; variable `VHM0` |
| CDSE SH Process API | `https://sh.dataspace.copernicus.eu/api/v1/process` | CDSE OAuth2 Bearer token; Sentinel-2 L2A least-CC mosaic |
| CMEMS Baltic SST L4 | `copernicusmarine.open_dataset` | CMEMS credentials; dataset `DMI-BALTIC-SST-L4-NRT-OBS_FULL_TIME_SERIE`; variable `analysed_sst` (K) |
| CMEMS Baltic Physics | `copernicusmarine.open_dataset` | CMEMS credentials; dataset `cmems_mod_bal_phy_anfc_P1D-m`; variables `so`, `uo`, `vo` at depth[0] |
| CMEMS Baltic BGC | `copernicusmarine.open_dataset` | CMEMS credentials; dataset `cmems_mod_bal_bgc_anfc_P1D-m`; variables `chl` (depth[0]), `o2b` (2-D) |
| User GeoTIFF | File upload | Must be georeferenced; server-side CRS validation |
| WMS/WMTS URL | User input | Validated before fetch |

### Outputs
- Tile URLs served to frontend map library (MapLibre GL JS)
- AOI geometry (GeoJSON polygon) stored in session state

## Implementation Status (2026-05-11)

**Status**: Implemented (Phase 1 + Phase 2 complete)

### What's Built
- `notebooks/06_map_layers.ipynb` — all 14 SCENARIO-MAP-* assertions PASS; cmocean colormaps throughout; quiver direction overlays for waves + currents; Leaflet.velocity deferred to Phase 3
- OSM + OpenSeaMap tile validation; GEBCO WMS `GEBCO_LATEST`; EMODnet `eusm_helcom_group`
- Marine bathymetry: CMEMS `deptho` (NaN=land → transparent) instead of GEBCO WMS (fully opaque)
- `src/boatops/services/cmems.py` — `get_bathymetry_overlay` (cmocean.deep, 24 h cache), `get_sst_overlay` (thermal), `get_salinity_overlay` (haline), `get_currents_overlay` (speed quiver), `get_chlorophyll_overlay` (algae, LogNorm), `get_oxygen_overlay` (oxy, hypoxia threshold 63 mmol/m³ in header); all 1 h cache except bathymetry
- `src/boatops/routers/map_layers.py` — `GET /api/map/{bathymetry,sst,salinity,currents,chlorophyll,oxygen}`; PNG binary + `X-Bbox`/`X-Timestamp`/`X-Colorscale` headers

### Reproducibility
- **Seed**: Not applicable (tile/WMS live services)
- **Re-run verified**: Yes (nbconvert execution)

### Deviations from Spec
- GEBCO WMS URL changed: old `gebco.net/.../mapserv` returns 404; new: `https://wms.gebco.net/mapserv`
- EMODnet layer `eusm2022` no longer exists — service restructured to per-scale/per-classification-scheme layers; using `eusm_helcom_group` (HELCOM Baltic classification, multi-scale group). `_full`-suffix layers render blank at overview zoom
- REQ-MAP-001 AOI draw, REQ-MAP-005 GeoTIFF upload, and layer toggle UI deferred to Phase 3

### 2026-05-11 Additions (feature/improvements-may-2026)
- **REQ-MAP-017** ✅ Dark vector basemap — `frontend/src/config/basemapStyle.ts` + `MapView.tsx`; OpenFreeMap tiles; land `#090909`, water `#1e3278`
- **REQ-MAP-018** ✅ Isobath contour GeoJSON — `cmems.get_isobaths()` (matplotlib contour on `deptho`; 24h cache); `GET /api/map/isobaths` endpoint; `frontend/src/api/client.ts` `getIsobaths()`
- **REQ-MAP-019** ✅ Dim basemap — `background-opacity: 0.85` applied to land background layer in custom style
- **REQ-MAP-020** ✅ Seamark icon size +20% — `tileSize: 307` in `frontend/src/config/layers.ts`
- **REQ-MAP-021** ✅ Time-controlled wind overlay — `openmeteo.get_wind_grid()` accepts optional `hour` (0–167); `GET /api/weather/wind-grid?hour=N`; `WindLayerPanel` refetches on `forecastHour` change

### Deferred
- 3D map view (Phase 3 frontend)
- AOI draw tool (Phase 3 frontend; Phase 2 session state)
- GeoTIFF upload endpoint (Phase 2 backend; Phase 3 frontend)
- Isobath frontend layer toggle in LayerPanel (currently only served via API; no map layer rendered yet — Phase 4)
