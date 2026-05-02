# Product Requirements Document — BoatOps

> Version: 1.0 | Status: Living Document | Last updated: 2026-05-01

## Functional Requirements

| ID | Requirement | Priority | OpenSpec Capability |
|----|-------------|----------|---------------------|
| FR-01 | Interactive 2D/3D web map with pan/zoom, layer toggles, time/date picker, and AOI draw tool | MUST | `map` |
| FR-02 | OpenStreetMap tile layer as toggleable base layer | MUST | `map` |
| FR-03 | OpenSeaMap nautical chart overlay (Baltic waters) | MUST | `map` |
| FR-04 | User-provided GeoTIFF upload and display as map layer | SHOULD | `map` |
| FR-05 | User-specified WMS/WMTS layer fetch and display | SHOULD | `map` |
| FR-06 | Gridded wind speed (knots/m/s) and direction with animated streamlines, 7-day forecast | MUST | `weather` |
| FR-07 | Gridded air temperature (°C/°F), static snapshot and animated | MUST | `weather` |
| FR-08 | Precipitation rate/accumulation, static snapshot and animated | MUST | `weather` |
| FR-09 | Total cloud cover (%), static snapshot and animated | MUST | `weather` |
| FR-10 | Active weather advisories (thunderstorm, gale, small craft, fog) with map polygon overlays | MUST | `weather` |
| FR-11 | Sunrise/sunset times, twilight times, solar elevation/azimuth, solar noon, timeline visualization | MUST | `solar` |
| FR-12 | Gridded significant wave height (Hs), static snapshot and animated | MUST | `waves` |
| FR-13 | Wave direction visualization alongside wave height | MUST | `waves` |
| FR-14 | Satellite overpass prediction for Sentinel-2 A/B, Sentinel-3 A/B, Landsat 8/9, VIIRS for AOI and planning window | MUST | `satellite` |
| FR-15 | Most recent cloud-free Sentinel-2 Level-2A image (≤20% cloud cover, configurable) as map overlay with true/false color options | MUST | `satellite` |
| FR-16 | AI-generated Go/No-Go assessment via Claude API with verdict, risk factors, optimal time windows, PDF export | MAY | `ai-synthesis` |
| FR-17 | GEBCO bathymetry layer (GEBCO 2023 15-arc-second grid) as toggleable WMS overlay | SHOULD | `map` |
| FR-18 | EMODnet Seabed Habitats layer (EUSM broad-scale habitat classification) as toggleable WMS overlay | SHOULD | `map` |

## Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Multiple concurrent authenticated users | ≥3 concurrent sessions without degradation |
| NFR-02 | Always-on internet connection required; no offline mode | N/A |
| NFR-03 | All external API credentials managed server-side; never exposed to client | Zero credential leaks in security review |
| NFR-04 | Functions in current versions of Chrome, Firefox, and Safari | Tested in all three browsers |
| NFR-05 | Data layers display last-updated timestamp | Timestamp visible for every active layer |
| NFR-06 | API failures degrade gracefully; failed layers show error state without blocking other layers | Verified via simulated failure tests per data source |

## Interface Contracts

| Interface | Protocol | Notes |
|-----------|----------|-------|
| Open-Meteo Weather API | HTTPS REST | Free; no API key for non-commercial; returns JSON grid data |
| MeteoAlarm API | HTTPS REST / CAP XML | EU weather advisories; Baltic/DE coverage |
| CMEMS Baltic Wave Forecast | HTTPS / OPeNDAP / MOTU | Requires CMEMS credentials; NetCDF response |
| CDSE OData API | HTTPS REST | Sentinel-2/3 overpass query; OAuth2 bearer token; operator registered |
| CDSE STAC API | HTTPS REST | Sentinel-2 imagery search by AOI, date, cloud cover |
| CDSE OGC WMS/WMTS | HTTPS | Sentinel-2 imagery tile streaming |
| USGS M2M API / NASA CMR | HTTPS REST | Landsat overpass prediction |
| CelesTrak TLE + Satellite.js | HTTPS (TLE download) + client-side | VIIRS orbital propagation |
| GEBCO WMS | `https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv` | No auth | Bathymetry grid layer `GEBCO_LATEST`; EPSG:4326 and EPSG:3857 |
| EMODnet Seabed Habitats WMS | `https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms` | No auth | EUSM 2022 broad-scale habitats layer; Baltic covered |
| SunCalc (Python) | Library call | No network; solar geometry computed locally |
| Claude API | HTTPS REST | AI synthesis; prompt caching for system prompt; credentials in `.env` |

## OpenSpec Capability Mapping

| PRD Requirement(s) | OpenSpec Capability | Epic |
|--------------------|---------------------|------|
| FR-01 – FR-05, FR-17, FR-18 | `map` | Epic 1 (story s01-06), Epic 2 |
| FR-06 – FR-10 | `weather` | Epic 1 (story s01-01), Epic 2 |
| FR-11 | `solar` | Epic 1 (story s01-03), Epic 2 |
| FR-12 – FR-13 | `waves` | Epic 1 (story s01-02), Epic 2 |
| FR-14 – FR-15 | `satellite` | Epic 1 (stories s01-04, s01-05), Epic 2 |
| FR-16 | `ai-synthesis` | Epic 2 (deferred) |
