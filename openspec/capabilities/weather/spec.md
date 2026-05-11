# Weather — Specification

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Purpose

Fetch and display gridded weather forecast data (wind, temperature, precipitation, cloud cover) and active weather advisories for a user-defined AOI in the German Baltic Sea. Supports Go/No-Go decision-making by surfacing conditions over a planning window of at least 7 days.

## Functional Requirements

### REQ-WX-001: Wind Forecast
The system SHALL fetch gridded wind speed (knots or m/s, user-selectable) and direction for the AOI from Open-Meteo API with at least a 7-day forecast horizon. The system SHALL support both a static snapshot at a given time and an animated layer across the planning window. Wind direction SHALL be visualizable as animated streamlines.

### REQ-WX-002: Air Temperature Forecast
The system SHALL fetch gridded air temperature (°C or °F, user-selectable) for the AOI from Open-Meteo API. The data SHALL be available as a static snapshot or animated layer.

### REQ-WX-003: Precipitation Forecast
The system SHALL fetch precipitation rate or accumulated precipitation for the AOI from Open-Meteo API. The data SHALL be available as a static snapshot or animated layer.

### REQ-WX-004: Cloud Cover Forecast
The system SHALL fetch total cloud cover (%) for the AOI from Open-Meteo API. The data SHALL be available as a static snapshot or animated layer. Cloud cover data SHALL be usable by the satellite capability to assess overpass quality (see SAT-01).

### REQ-WX-005: Weather Advisories
The system SHALL fetch active weather advisories and warnings for the AOI from MeteoAlarm API, including at minimum: thunderstorm warnings, gale/wind warnings, small craft advisories, and fog advisories. Active advisories SHALL be returned as polygon geometries with alert level and type metadata.

### REQ-WX-006: Data Freshness
The system SHALL include a last-updated timestamp for each weather data layer.

### REQ-WX-008: Wind Speed Units — m/s Primary Display
Wind speed in the frontend SHALL be displayed in m/s as the primary unit. Knot conversion values SHALL still be available in the API response (`wind_speed_kt`) but SHALL NOT be the primary display unit.

### REQ-WX-009: Wind Speed Color Scale Cap
The animated wind particle overlay color scale SHALL be capped at 20 m/s maximum, regardless of the data `vmax_speed`. This prevents the color ramp from stretching to hurricane-force values that make moderate winds appear calm.

### REQ-WX-010: Planning Time Slider
A time slider SHALL be displayed below the map viewport, spanning a 7-day planning window with 1-hour resolution (168 steps). Moving the slider SHALL update all time-sensitive data panels (weather, waves, satellite) to display conditions at the selected forecast hour. The current time SHALL be marked as "Now" on the slider. The wind particle overlay SHALL update to show wind conditions at the selected forecast hour.

### REQ-WX-007: Graceful Failure
If any weather API call fails, the system SHALL return a structured error response for that layer without affecting other layers.

## Acceptance Scenarios

### SCENARIO-WX-WIND-001: Wind data returned for Baltic AOI
**GIVEN** a bounding box covering the German Baltic Sea coast (e.g., `[9.5, 53.5, 15.0, 56.0]`) and a 7-day planning window starting today  
**WHEN** the Open-Meteo wind endpoint is called with `wind_speed_10m` and `wind_direction_10m` variables  
**THEN** the response contains a time series grid with ≥168 hourly time steps, wind speed in the expected range (0–50 m/s), and wind direction in [0, 360)

### SCENARIO-WX-WIND-002: Unit conversion
**GIVEN** a wind speed value in m/s returned from the API  
**WHEN** the user selects "knots" as the display unit  
**THEN** the displayed value equals the m/s value × 1.94384 ± 0.01

### SCENARIO-WX-CLOUD-001: Cloud cover data usable by satellite capability
**GIVEN** cloud cover data retrieved for an AOI and time range  
**WHEN** the satellite capability queries cloud cover at a specific overpass time  
**THEN** the nearest-in-time cloud cover percentage is returned for the AOI centroid

### SCENARIO-WX-ADV-001: Weather advisory polygon returned for active warning
**GIVEN** an active gale warning covering part of the Baltic Sea  
**WHEN** the MeteoAlarm advisory endpoint is called for the AOI  
**THEN** the response contains at least one advisory with: geometry (polygon or multi-polygon), alert type, severity level, onset and expires timestamps

### SCENARIO-WX-ADV-002: No advisory returns empty list without error
**GIVEN** a time and location with no active advisories  
**WHEN** the MeteoAlarm endpoint is called  
**THEN** the response returns an empty advisory list with HTTP 200

### SCENARIO-WX-FAIL-001: API failure returns structured error
**GIVEN** Open-Meteo API is unreachable (simulated)  
**WHEN** the weather endpoint is called  
**THEN** the response returns a structured error object with `layer: "weather"`, `status: "error"`, and a human-readable message; other data layers are unaffected

## Data Contracts

### Inputs
| Name | Source | Format | Key Fields |
|------|--------|--------|------------|
| Open-Meteo forecast | `https://api.open-meteo.com/v1/forecast` | JSON | `latitude`, `longitude`, `hourly` variables |
| MeteoAlarm advisories | MeteoAlarm API | GeoJSON / CAP XML | geometry, alert type, severity, onset, expires |

### Outputs
| Name | Format | Key Fields |
|------|--------|------------|
| Wind grid | GeoJSON or dict | time series of speed (m/s, knots), direction (°), bbox |
| Temperature grid | dict | time series of temp (°C, °F), bbox |
| Precipitation grid | dict | time series of precip (mm/h), bbox |
| Cloud cover grid | dict | time series of cover (%), bbox |
| Advisories | GeoJSON FeatureCollection | geometry, type, severity, onset, expires, description |

## Implementation Status (2026-05-03)

**Status**: Implemented (Phase 1 + Phase 2 complete)

### What's Built
- `notebooks/01_weather.ipynb` — validates Open-Meteo and MeteoAlarm APIs; all SCENARIO-WX-* pass
- REQ-WX-001 through REQ-WX-007: query patterns established; unit conversion confirmed; graceful failure tested
- Cloud cover query function reusable by satellite capability (SCENARIO-WX-CLOUD-001 ✓)
- `src/boatops/services/openmeteo.py` — `get_forecast(lat, lon)` → 168-item hourly JSON (m/s + knots); TTLCache 15 min
- `src/boatops/services/meteoalarm.py` — `get_advisories(country)` → GeoJSON FeatureCollection (geometry=null — no polygon in Atom feed); TTLCache 5 min
- `src/boatops/routers/weather.py` — `GET /api/weather/forecast`, `GET /api/weather/advisories`; upstream errors → HTTP 502

### Reproducibility
- **Seed**: Not applicable (API data; no randomness)
- **Re-run verified**: Yes (nbconvert execution)
- **Known numerical tolerance**: Wind speed ±0.01 m/s; direction ±1°

### Deviations from Spec
- REQ-WX-005 (advisory polygons on map): MeteoAlarm Atom feed contains **no polygon geometry** — area described in plain text only. Phase 2 must use DWD WFS or EUMETNET GeoJSON API for polygon overlays. Open task.
- Open-Meteo returns single-point forecast for a lat/lon (not gridded). Acceptable for Go/No-Go; gridded multi-point deferred to Phase 2.

### 2026-05-11 Additions (feature/improvements-may-2026)
- **REQ-WX-008** ✅ Wind in m/s — `WeatherPanel.tsx` and `WindLayerPanel.tsx` updated; `windClass` thresholds in m/s; legend shows m/s
- **REQ-WX-009** ✅ Wind vmax cap — `openmeteo._VMAX_WIND_CAP_MS = 20.0`; `get_wind_grid` applies `min(vmax, 20.0)`
- **REQ-WX-010** ✅ Planning time slider — `TimeContext.tsx` (forecastHour state 0–167); `TimeSlider.tsx` (7-day range input, day labels); `WeatherPanel` uses `forecastHour` to index forecast arrays; `WindLayerPanel` refetches with `?hour=N`

### Deferred
- REQ-WX-005 polygon overlay: DWD WFS / EUMETNET GeoJSON investigation (Phase 2)
- Animated streamline rendering (Phase 3 frontend)
