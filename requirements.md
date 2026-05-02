# BoatOps — Planning Phase Requirements

## Overview

BoatOps is a browser-based survey planning tool for operations conducted with a Blue Robotics Blue Boat. This document covers the **planning phase**: providing environmental and observational data to support a Go/No-Go decision before a survey is dispatched. Mission planning, real-time execution, and data analysis are addressed separately.

The platform shall surface relevant data layers in an interactive map, organized by operational area, allowing operators to assess conditions across time windows and make informed deployment decisions.

---

## Target Regions

- **EU:** German Baltic Sea and adjacent coastal waters

---

## Users

- Multiple users with accounts (authentication required)
- No role differentiation required at this stage; all authenticated users have full access

---

## Scope

**In scope (this document):**
- Browser-based interactive map 
- Environmental data layers (weather, waves, solar, satellite)
- Satellite overpass planning
- Cloud-free Sentinel-2 imagery retrieval
- Nautical chart and base map overlays
- Go/No-Go synthesis options for Claude API or local LLM **nice-to-have**

**Out of scope:**
- Mission planning (waypoints, route generation, survey parameters)
- Real-time execution monitoring
- Post-survey data analysis
- Offline / low-connectivity operation

---

## Functional Requirements

### MAP-01 — webGIS Base Map

- Users shall be able to pan, zoom, and navigate in 2D and 3D views.
- The map shall support toggling individual data layers on and off.
- A time/date picker shall allow users to set the planning window (date + time range) that drives all time-sensitive layers.
- The planning area of interest (AOI) shall be definable by the user (bounding box or polygon draw tool).

---

### MAP-02 — Base Map: OpenStreetMap Overlay

- An OpenStreetMap tile layer shall be available as a toggleable base layer.
- **Suggested source:** Standard OSM tile server (`tile.openstreetmap.org`) or a self-hosted/proxied equivalent.

---

### MAP-03 — Base Map: Nautical Chart Overlay

- A nautical chart tile layer shall be available as a toggleable overlay.
- For Baltic waters: OpenSeaMap vector overlay (sourced from OpenSeaMap tile server).
- **Suggested sources:**
  - Global/Baltic: OpenSeaMap (`tiles.openseamap.org/seamark`)

---

### MAP-04 — User-provided map data (geotiff)
- User-provided geotiff. Most likely drone orthomosaic. 
- Add layer option

### MAP-05 - Fetch additional WMS/WMTS layers
- User-specified
- Add WMS/WMTS option

--- 

### WX-01 — Weather Forecast: Wind Speed and Direction

- The map shall display gridded wind speed (knots or m/s, user-selectable) and direction for the AOI.
- Data shall be available as both a static layer (snapshot at a given time) and an animation across the planning window.
- Wind direction shall be visualized as animated streamlines - like windy.com.
- Forecast horizon: minimum 7 days.
- **Suggested sources:**
  - Baltic: Copernicus Climate Data Store (CDS) / ECMWF ERA5 or Open-Meteo (ECMWF model option)

---

### WX-02 — Weather Forecast: Air Temperature

- The map shall display gridded air temperature (°C or °F, user-selectable) for the AOI.
- Available as a static snapshot or animated layer across the planning window.
- **Suggested source:** Open-Meteo API (free tier available)

---

### WX-03 — Weather Forecast: Precipitation

- The map shall display precipitation rate or accumulated precipitation for the AOI.
- Available as a static snapshot or animated layer.
- **Suggested source:** Open-Meteo API; 

---

### WX-04 — Weather Forecast: Cloud Cover

- The map shall display total cloud cover (%) for the AOI.
- Available as a static snapshot or animated layer.
- Cloud cover is particularly relevant for satellite imagery scheduling (see SAT-01, SAT-02).
- **Suggested source:** Open-Meteo API

---

### WX-05 — Weather Advisories

- The application shall fetch and display active weather advisories and warnings for the AOI.
- Advisory types shall include at minimum: thunderstorm warnings, gale/wind warnings, small craft advisories, and fog advisories.
- Active advisories shall be visually highlighted on the map (e.g., polygon overlay with alert color coding) and listed in a sidebar panel.
- **Suggested sources:**
  - Baltic/EU: MeteoAlarm API (`meteoalarm.org`) — covers all EU member state meteorological services

---

### SOL-01 — Sunrise, Sunset, and Solar Geometry

- For a given date and location within the AOI, the application shall display:
  - Sunrise and sunset times (local time and UTC)
  - Civil, nautical, and astronomical twilight times
  - Solar elevation angle and azimuth at any point in the planning window
  - Solar noon time
- A timeline visualization shall show daylight/twilight/dark periods across the planning window.
- Solar geometry is critical for optical satellite pass scheduling and surface reflectance assessment.
- **Suggested source:** Client-side computation using SunCalc.js (no API key required) or USNO Solar API

---

### WAVE-01 — Significant Wave Height

- The map shall display gridded significant wave height (Hs) for the AOI.
- Available as a static snapshot or animated layer.
- **Suggested sources:**
  - Baltic: Copernicus Marine Service (CMEMS) — Baltic Sea Wave Analysis and Forecast product

---

### WAVE-02 — Wave Direction

- The map shall display wave direction (mean wave direction or peak wave direction) alongside significant wave height.
- Direction shall be visualized as arrows or streamlines.
- **Suggested sources:** Same as WAVE-01

---

### SAT-01 — Satellite Overpass Prediction

- For the AOI and a given planning window, the application shall identify and display predicted overpass times for:
  - **Sentinel-2** (A and B; ESA; 10 m optical, 5-day revisit)
  - **Sentinel-3** (A and B; ESA; ocean color/thermal)
  - **Landsat 8 and 9** (USGS; 30 m optical, 16-day revisit)
  - **VIIRS** (Suomi-NPP and NOAA-20; 375 m/750 m)
- For each predicted overpass, the application shall show:
  - Pass start and end time (UTC and local)
  - Ground track geometry overlaid on the map
  - Estimated cloud cover over the AOI at that time (from WX-04)
  - Solar elevation angle at pass time (from SOL-01)
- **Suggested sources:**
  - Sentinel-2 and Sentinel-3 overpasses: Copernicus Data Space Ecosystem (CDSE) OData API — query upcoming acquisitions by AOI geometry and time range (operator is registered)
  - Landsat 8/9: USGS M2M API / NASA CMR API
  - VIIRS: NASA LAADS DAAC or CelesTrak TLE data + Satellite.js for orbital propagation

---

### SAT-02 — Most Recent Cloud-Free Sentinel-2 Image

- For the defined AOI, the application shall retrieve and display the most recent available Sentinel-2 Level-2A image with cloud cover below a configurable threshold (default: ≤ 20%).
- Check user's GitHub repo to see what can be adapted/reused: https://github.com/DFCOceTech/Sent2_GreenMac
- The image shall be rendered as a map overlay, with options for:
  - True color (RGB: B4/B3/B2)
  - False color (NIR: B8/B4/B3)
- Image metadata (acquisition date, cloud cover %, scene ID) shall be displayed in the layer panel.
- The cloud cover threshold shall be user-adjustable.
- **Suggested source:** Copernicus Data Space Ecosystem (CDSE) — use the STAC API to search for scenes by AOI, date, and cloud cover, then stream imagery via the CDSE OGC WMS/WMTS service. Operator is registered.

---

## Nice-to-Have

### AI-01 — Go/No-Go Synthesis via Claude API or local LLM

- After loading data for the AOI and planning window, the user may request an AI-generated Go/No-Go assessment.
- The application shall assemble a structured summary of the active data layers (wind speed/gusts, wave height, active advisories, cloud cover, tidal state [Florida only], overpass windows) and submit it to the Claude API.
- Claude shall return a plain-language recommendation that includes:
  - An overall Go / Caution / No-Go verdict
  - Key risk factors identified
  - Suggested optimal time windows within the planning period
  - Caveats or data gaps noted
- The response shall be displayed in a dedicated panel and summarized in a pdf and shall not modify any map layers.
- The system prompt shall be configurable so operators can tune thresholds (e.g., max acceptable wave height, minimum solar elevation for optical surveys).
- **Suggested model:** `claude-opus-4-7` or `claude-sonnet-4-6` depending on latency/cost tradeoff; include prompt caching for the static system prompt.

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | The application shall support multiple concurrent authenticated users. Authentication mechanism is at developer discretion (e.g., OAuth 2.0, email/password). |
| NFR-02 | The application shall require an always-on internet connection. No offline capability is required. |
| NFR-03 | All external API credentials (keys, tokens) shall be managed server-side and never exposed to the client. |
| NFR-04 | The application shall function in current versions of Chrome, Firefox, and Safari. |
| NFR-05 | Data layers shall indicate their last-updated timestamp so users can assess data freshness. |
| NFR-06 | The application shall handle API failures gracefully: failed layers shall display an error state without preventing other layers from loading. |

---

## Data Source Summary

| Layer | EU / Baltic Source |
|-------|-----------|-------------------|
| Weather forecast | | Open-Meteo (ECMWF) |
| Weather advisories | MeteoAlarm API |
| Solar geometry | SunCalc.js |
| Wave height/direction | CMEMS Baltic Wave Forecast |
| Sentinel-2/3 overpasses | CDSE OData API |
| Landsat overpasses | USGS M2M API / NASA CMR |
| VIIRS overpasses | NASA LAADS DAAC / CelesTrak + Satellite.js |
| Sentinel-2 imagery | CDSE STAC + OGC WMS/WMTS |
| Nautical charts | OpenSeaMap |
| Base map | OpenStreetMap |
| AI synthesis | Claude API (Anthropic) |

---

## Out of Scope (Future Documents)

- **Mission planning:** Waypoint definition, survey line generation, coverage area calculation, mission file export (e.g., MAVLink, GPX)
- **Execution monitoring:** Real-time telemetry, live layer updates, Blue Boat status display
- **Data analysis:** Ingestion and processing of survey data collected by the Blue Boat
