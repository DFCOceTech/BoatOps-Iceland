# Satellite — Specification

> Version: 1.1 | Status: Draft | Last updated: 2026-05-13

## Purpose

Predict satellite overpasses for a user-defined AOI and planning window, and retrieve the most recent cloud-free Sentinel-2 Level-2A imagery for the AOI. Supports coordination of Blue Boat surveys with optical satellite passes for co-located data collection.

Platforms covered: Sentinel-1 A/C, Sentinel-2 A/B, Sentinel-3 A/B, Landsat 8/9, VIIRS (Suomi-NPP, NOAA-20).

## Functional Requirements

### REQ-SAT-011: Sentinel-1 Overpass Prediction
The system SHALL predict overpass windows for Sentinel-1A (NORAD 39634) and Sentinel-1C (NORAD 62261) using CelesTrak TLE data and skyfield orbital propagation, returning the same fields as other TLE-based platforms. Because Sentinel-1 carries a SAR sensor, the daytime-only filter SHALL NOT apply — nighttime passes SHALL be returned.

### REQ-SAT-001: Sentinel-2 Overpass Prediction
The system SHALL query the CDSE OData API for upcoming Sentinel-2 A and B acquisitions overlapping the AOI within the planning window. For each acquisition, the system SHALL return: platform, pass start/end time (UTC), footprint geometry, estimated cloud cover at pass time (from WX-04), and solar elevation at pass time (from SOL-03).

### REQ-SAT-002: Sentinel-3 Overpass Prediction
The system SHALL query the CDSE OData API for upcoming Sentinel-3 A and B acquisitions overlapping the AOI, returning the same fields as REQ-SAT-001.

### REQ-SAT-003: Landsat 8/9 Overpass Prediction
The system SHALL query the USGS M2M API or NASA CMR API for upcoming Landsat 8 and 9 acquisitions overlapping the AOI, returning pass time and footprint geometry.

### REQ-SAT-004: VIIRS Overpass Prediction
The system SHALL compute VIIRS (Suomi-NPP and NOAA-20) overpass predictions for the AOI using CelesTrak TLE data and orbital propagation (via the `skyfield` or `sgp4` Python library), returning pass windows and ground track geometry.

### REQ-SAT-005: Cloud-Free Sentinel-2 Imagery Search
The system SHALL query the CDSE STAC API for the most recent available Sentinel-2 Level-2A scene covering the AOI with cloud cover ≤ the configured threshold (default 20%, user-adjustable). The system SHALL return the scene acquisition date, cloud cover percentage, and scene ID.

### REQ-SAT-006: Sentinel-2 Imagery Display
The system SHALL stream Sentinel-2 imagery tiles via the CDSE OGC WMS/WMTS service for the selected scene, supporting true color (B4/B3/B2) and false color / NIR (B8/B4/B3) band combinations.

### REQ-SAT-008: Ground Track Overlay on Map
The system SHALL render the ground track of each predicted overpass as a vector line on the map. Tracks SHALL be grouped by platform with distinct colours. A toggle in the Satellite panel SHALL show or hide all tracks simultaneously.

### REQ-SAT-009: Pass Selection Sets Planning Time
Clicking a satellite pass row in the overpass table SHALL set the global planning time context to that pass's AOS time. This SHALL cause all time-sensitive panels (weather, waves) to display conditions for that forecast hour.

### REQ-SAT-010: Daytime-Only Overpass Filter
The system SHALL exclude satellite overpasses that occur during nighttime. A pass is nighttime if the solar elevation at the midpoint of the pass window (AOS + LOS)/2 is below 0° at the AOI centre. Solar position SHALL be computed using a planetary ephemeris (de421.bsp via skyfield). Only optically useful passes (sunlit ground) SHALL be returned.

### REQ-SAT-007: Imagery Metadata Display
The system SHALL return image metadata (acquisition date, cloud cover %, scene ID, tile grid reference) for display in the layer panel alongside the imagery.

## Acceptance Scenarios

### SCENARIO-SAT-S1-001: Sentinel-1 overpasses returned for Baltic AOI including nighttime passes
**GIVEN** current TLE data for Sentinel-1A (NORAD 39634) and Sentinel-1C (NORAD 62261) from CelesTrak and a 7-day planning window over the Baltic AOI `[9.5, 53.5, 15.0, 56.0]`  
**WHEN** `get_overpasses()` is called  
**THEN** the response contains ≥1 pass from Sentinel-1A or Sentinel-1C with: platform name, AOS/LOS times UTC, max elevation, duration, and track_coords polyline intersecting the AOI; passes occurring during nighttime SHALL be included (daytime_only=False for SAR)

### SCENARIO-SAT-S2-001: Sentinel-2 overpasses returned for Baltic AOI
**GIVEN** a bounding box covering the German Baltic coast (`[9.5, 53.5, 15.0, 56.0]`) and a 10-day planning window  
**WHEN** the CDSE OData API is queried for Sentinel-2 acquisitions  
**THEN** the response contains ≥1 acquisition with: platform name, start/end time (UTC), footprint GeoJSON, and cloud cover estimate; acquisitions are sorted by time ascending

### SCENARIO-SAT-VIIRS-001: VIIRS overpass predicted from TLE
**GIVEN** current TLE data for Suomi-NPP from CelesTrak and a 48-hour planning window  
**WHEN** orbital propagation is run for the AOI  
**THEN** the response contains ≥1 overpass with: satellite name, AOS (acquisition of signal) time UTC, LOS (loss of signal) time UTC, and ground track polyline geometry intersecting the AOI bbox

### SCENARIO-SAT-IMG-001: Cloud-free Sentinel-2 scene found
**GIVEN** a bounding box over the German Baltic coast and cloud threshold = 20%  
**WHEN** the CDSE STAC API is queried  
**THEN** the response returns the most recent scene with cloud_cover ≤ 20%, including acquisition_date, cloud_cover_pct, scene_id, and WMS/WMTS tile URL template

### SCENARIO-SAT-IMG-002: No cloud-free scene available
**GIVEN** a very small AOI or high cloud season where no scene meets the threshold  
**WHEN** the CDSE STAC search returns no results  
**THEN** the response returns an empty result with `{"status": "no_scene", "message": "No scene found with cloud cover ≤ 20% in the last 90 days"}` — not an error

### SCENARIO-SAT-TRACK-001: Ground track overlay renders for all predicted passes
**GIVEN** overpasses have been fetched for the Baltic AOI  
**WHEN** the "Show satellite tracks" toggle is enabled  
**THEN** ground track LineStrings are drawn on the map, one per pass, colour-coded by platform; tracks intersect the Baltic AOI bbox

### SCENARIO-SAT-DAYTIME-001: Nighttime passes are excluded
**GIVEN** CelesTrak TLE data for Suomi-NPP and a 7-day planning window over the Baltic AOI  
**WHEN** `get_overpasses()` is called  
**THEN** all returned passes have solar elevation ≥ 0° at the AOI centre at pass midpoint; no nighttime passes appear in the list

### SCENARIO-SAT-FAIL-001: CDSE unavailable returns structured error
**GIVEN** CDSE API is unreachable (simulated)  
**WHEN** the satellite endpoint is called  
**THEN** the response returns `{"layer": "satellite", "status": "error"}` without affecting other layers

## Data Contracts

### Inputs
| Name | Source | Format | Required Fields |
|------|--------|--------|-----------------|
| CDSE OData query | CDSE OData API | JSON | bbox, date range, platform, product type |
| CDSE STAC query | CDSE STAC API | GeoJSON/JSON | bbox, date range, cloud_cover threshold |
| CelesTrak TLEs | `https://celestrak.org/SOCRATES/` or TLE catalog | Two-line element sets | satellite name, TLE line 1, TLE line 2 |
| USGS M2M / NASA CMR | API | JSON | path/row or bbox, date range, platform |

### Outputs
| Name | Format | Key Fields |
|------|--------|------------|
| Overpass list | list of dicts | platform, start_utc, end_utc, footprint (GeoJSON), cloud_cover_pct, solar_elevation_deg |
| Best Sentinel-2 scene | dict | scene_id, acquisition_date, cloud_cover_pct, wms_url, tile_grid_ref |

## Implementation Status (2026-05-13)

**Status**: Implemented (Phase 1 + Phase 2 + Phase 3 complete)

### What's Built
- `notebooks/04_satellite_overpasses.ipynb` — REQ-SAT-001 through REQ-SAT-004; all SCENARIO-SAT-S2-001, SCENARIO-SAT-VIIRS-001, SCENARIO-SAT-FAIL-001 pass
- `notebooks/05_sentinel2_imagery.ipynb` — REQ-SAT-005 through REQ-SAT-007; SCENARIO-SAT-IMG-001, SCENARIO-SAT-IMG-002 pass
- CDSE OData overpass query (Sentinel-2/3), CelesTrak TLE + skyfield overpass prediction (6 platforms), Sentinel Hub Process API imagery rendering
- Partial tile check (spherical Shoelace formula on GeoFootprint; rejects coverage < 50%)
- `src/boatops/services/cdse_auth.py` — OAuth2 token management; TTLCache 5 min (well inside CDSE expiry)
- `src/boatops/services/celestrak.py` — TLE fetch (gp.php endpoint) + skyfield `find_events` with AOI ground-track intersection; `if peak_t is not None:` gotcha preserved
- `src/boatops/services/sentinel_hub.py` — OData scene query (newest cloud-free L2A) + SH Process API true-colour render → PNG bytes
- `src/boatops/routers/satellite.py` — `GET /api/satellite/overpasses` (JSON array, 6 platforms, 7-day), `GET /api/satellite/s2-overlay` (PNG, X-Scene-Id/X-Acquisition-Time/X-Cloud-Cover headers)
- `frontend/src/components/SatellitePanel.tsx` — overpass table grouped by platform (alphabetical section headers, AOS in Berlin time, satellite max elevation, duration); S2 overlay toggle with manual MapLibre ImageSource lifecycle; acquisition date + cloud cover badge
- `frontend/src/api/client.ts` — `S2OverlayResult` type; `fetchS2Png()` reads satellite-specific headers; `getS2Overlay()` accepts `AbortSignal` for cancellation of 10–30 s fetch

### Reproducibility
- **Seed**: Not applicable (live API data)
- **Re-run verified**: Yes (nbconvert execution)

### Deviations from Spec
- Landsat overpass: NASA CMR unusable for future planning (processing lag). **TLE propagation via skyfield used instead** for all platforms including Landsat 8/9. NORAD IDs: 39084, 49260.
- Sentinel-2 imagery: CDSE STAC does not contain Sentinel-2 — OData used for discovery. Sentinel Hub Process API used for rendering (not WMS/WMTS), requires no separate instance ID.
- CelesTrak old endpoint deprecated — new: `gp.php?CATNR=<ID>&FORMAT=tle`.
- OData rejects `$expand=Attributes,Assets` combined — two separate requests required.
- Quicklook asset is JPEG (not PNG) — PIL.Image.open() required.
- REQ-SAT-005 tile coverage filter added: pool of 20 candidates fetched; scenes with footprint area < 50% of full 110×110 km tile are rejected (adapted from Sent2_GreenMac).

### 2026-05-11 Additions (feature/improvements-may-2026)
- **REQ-SAT-008** ✅ Ground track overlay — `celestrak.py` now returns `track_coords: [[lon, lat], ...]` in each pass dict; `SatellitePanel.tsx` adds GeoJSON LineString layer on map via `addTrackLayer()`; colour-coded by platform; toggle checkbox
- **REQ-SAT-009** ✅ Pass click → planning time — `handlePassClick` in `SatellitePanel` computes hour offset from AOS and calls `setForecastHour()`; all time-sensitive panels update

### 2026-05-21 Additions
- **REQ-SAT-011** ✅ Sentinel-1 overpass prediction — `Sentinel-1A` (NORAD 39634) and `Sentinel-1C` (NORAD 62261) added to `SATELLITE_CATALOG` with `daytime_only=False`; SAR sensor operates day/night. `SATELLITE_CATALOG` refactored from `{name: int}` to `{name: {norad, daytime_only}}` dict; `_predict_passes` accepts `daytime_only` bool; frontend color `#4ade80` (green) added to `PLATFORM_COLORS` and MapLibre `match` expression.

### 2026-05-13 Additions
- **REQ-SAT-010** ✅ Daytime-only filter — `_solar_elevation(observer, t)` in `celestrak.py` uses `de421.bsp` (skyfield planetary ephemeris, cached on disk) to compute solar altitude; passes with solar elevation < 0° at pass midpoint are discarded before appending to results
- **REQ-SAT-002** ✅ Sentinel-3 overpass prediction — `Sentinel-3A` (NORAD 41335) and `Sentinel-3B` (NORAD 43437) added to `SATELLITE_CATALOG`; TLE propagation identical to other platforms; frontend already colour-coded purple (`#818cf8`)

### Deferred
- Sentinel-3 overpass TLE prediction (CDSE OData historical only in notebook)
- "Optimal passes" midpass solar elevation > 20°: still approximated by satellite max elevation ≥ 20° in frontend; REQ-SAT-010 now guarantees sun-above-horizon but does not expose the elevation value in the API response
