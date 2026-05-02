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

## Data Contracts

### Inputs
| Name | Source | Notes |
|------|--------|-------|
| OSM tiles | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | No auth; usage policy applies |
| OpenSeaMap tiles | `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png` | No auth |
| GEBCO WMS | `https://wms.gebco.net/mapserv` | No auth; layer: `GEBCO_LATEST` |
| EMODnet Seabed Habitats WMS | `https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms` | No auth; layer: `eusm_helcom_group` |
| Open-Meteo wind grid | `https://api.open-meteo.com/v1/forecast` | No auth; `wind_speed_10m`, `wind_direction_10m`; one request per grid point |
| CMEMS Baltic Wave | `copernicusmarine.open_dataset` | CMEMS credentials in `.env`; dataset `cmems_mod_bal_wav_anfc_PT1H-i`; variable `VHM0` |
| CDSE SH Process API | `https://sh.dataspace.copernicus.eu/api/v1/process` | CDSE OAuth2 Bearer token; Sentinel-2 L2A least-CC mosaic |
| User GeoTIFF | File upload | Must be georeferenced; server-side CRS validation |
| WMS/WMTS URL | User input | Validated before fetch |

### Outputs
- Tile URLs served to frontend map library (MapLibre GL JS)
- AOI geometry (GeoJSON polygon) stored in session state

## Implementation Status (2026-05-02)

**Status**: Partially Implemented (Phase 1 notebook complete)

### What's Built
- `notebooks/06_map_layers.ipynb` — REQ-MAP-002 through REQ-MAP-008; all SCENARIO-MAP-* pass
- OSM + OpenSeaMap tile validation (HTTP 200, image content confirmed)
- Synthetic GeoTIFF ImageOverlay via PNG data URI (rasterio workflow pattern)
- GEBCO WMS: `GEBCO_LATEST` at `https://wms.gebco.net/mapserv` confirmed
- EMODnet WMS: `eusm_helcom_group` (HELCOM Baltic) confirmed; `eusm2022` no longer exists
- Combined ipyleaflet map with all 5 overlays + LayersControl

### Reproducibility
- **Seed**: Not applicable (tile/WMS live services)
- **Re-run verified**: Yes (nbconvert execution)

### Deviations from Spec
- GEBCO WMS URL changed: old `gebco.net/.../mapserv` returns 404; new: `https://wms.gebco.net/mapserv`
- EMODnet layer `eusm2022` no longer exists — service restructured to per-scale/per-classification-scheme layers; using `eusm_helcom_group` (HELCOM Baltic classification, multi-scale group). `_full`-suffix layers render blank at overview zoom
- REQ-MAP-001 AOI draw, REQ-MAP-005 GeoTIFF upload, and layer toggle UI deferred to Phase 3

### Deferred
- 3D map view (Phase 3 frontend)
- AOI draw tool (Phase 3 frontend; Phase 2 session state)
- GeoTIFF upload endpoint (Phase 2 backend; Phase 3 frontend)
- Layer toggle UI (Phase 3 MapLibre GL JS)
