# Capability: Iceland Work Site (Jökulsárlón)

> Fork of BoatOps (Baltic). Status: implemented 2026-10-25. Inherited Baltic specs (`waves`, `map`) are **historical** — those capabilities were removed in this fork.

## Context
Drone and blue-boat measurements at Jökulsárlón glacier lagoon. Ice is mobile, so the operating position changes daily and cannot be fixed in configuration.

## Requirements

| ID | Requirement |
|----|-------------|
| REQ-IS-01 | The app opens centred on Jökulsárlón (≈64.048°N, 16.179°W, zoom 12). |
| REQ-IS-02 | The user can set the active **work site** by typing coordinates, picking on the map, using the map centre, dragging the site marker, or selecting a saved/preset site. |
| REQ-IS-03 | Weather, tide, solar and satellite-overpass panels, and imagery, follow the active site. The site is encoded in the URL (`#site=lat,lon`) and restored on load. Saved sites persist in browser storage and can be exported as GeoJSON. |
| REQ-IS-04 | Backend bbox inputs are bounded: imagery bbox span ≤ 2°, wind grid ≤ 400 nodes and step ≥ 0.02°. |
| REQ-IS-05 | `/api/marine/forecast` returns 7-day hourly sea level (tide), offshore wave height and SST from Open-Meteo Marine for the site. The UI labels it a coastal reference, not a lagoon model. |
| REQ-IS-06 | `/api/satellite/s1-overlay` returns the latest Sentinel-1 GRD scene (VV/VH, dB-scaled) within `days_back` (1–30) for the bbox; `/api/satellite/s2-overlay` accepts `days_back` (1–90). Scene time is shown in the UI. |
| REQ-IS-07 | Go/No-Go uses wind, gust, cloud and solar elevation only (no wave criterion); solar thresholds default to 10°/3° for high latitude. |
| REQ-IS-08 | Meteoalarm advisories default to Iceland (`IS`). No CMEMS credentials are required. |

## Scenarios

- **SCENARIO-IS-02a** Given the app is open, when the user enters valid coordinates and presses Go, then the site marker, weather request and URL hash all use the new coordinates.
- **SCENARIO-IS-02b** Given out-of-range coordinates (e.g. lat 123), when Go is pressed, then the active site is unchanged.
- **SCENARIO-IS-03a** Given a URL with `#site=64.0610,-16.2000`, when the page loads, then that site is active.
- **SCENARIO-IS-03b** Given a saved site, when the page is reloaded, then it is still listed.
- **SCENARIO-IS-04a** An oversized imagery bbox returns 422. **04b** An inverted bbox returns 422. **04c** A wind grid over the node cap returns 422.
- **SCENARIO-IS-05a** Marine forecast returns equal-length `times`/`sea_level_m` arrays. **05b** Out-of-range lat/lon returns 422; upstream failure returns 502.
- **SCENARIO-IS-06a** S1 overlay returns PNG with `X-Scene-Id`, `X-Acquisition-Time`, `X-Bbox`. **06b** No scene → 404. **06c** No CDSE credentials → 503.
- **SCENARIO-IS-07a** With wind 13.6 kt, gust 18.5 kt, cloud 35 %, sun 42° the verdict is CAUTION (cloud amber).

## Known limitations
- The lagoon (~18 km², up to ~250 m deep) is below the resolution of any open ocean model; tide data are an offshore phase/range reference.
- Preset coordinates are approximate; verify with GNSS.
- S1/S2 live retrieval needs CDSE credentials; automated tests mock CDSE.
- Esri World Imagery has no guaranteed date. Do not use it to assess current ice.

## Implementation Status
Implemented; see `ops/test-results.md`.
