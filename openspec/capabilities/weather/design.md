# Weather — Design

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Implementation Approach

Phase 1: `notebooks/01_weather.ipynb` — interactive prototype validating Open-Meteo and MeteoAlarm APIs, understanding response shapes, and producing sample visualizations (wind rose, cloud cover heatmap).

Phase 2: `src/boatops/services/openmeteo.py` and `src/boatops/services/meteoalarm.py` — extracted service modules with typed return values; `src/boatops/routers/weather.py` — FastAPI router.

## Pipeline / Analysis Flow

```
Phase 1 (Notebook):
  User inputs (AOI bbox, date range)
    → openmeteo_client.fetch_forecast(bbox, variables, start, end)
      → GET https://api.open-meteo.com/v1/forecast
      → parse JSON → xarray Dataset or dict
    → meteoalarm_client.fetch_advisories(bbox)
      → parse GeoJSON / CAP XML → list of Advisory objects
    → visualize in notebook (matplotlib / ipyleaflet)

Phase 2 (FastAPI):
  GET /api/weather/forecast?bbox=...&start=...&end=...&units=...
    → openmeteo.py → JSON response
  GET /api/weather/advisories?bbox=...
    → meteoalarm.py → GeoJSON FeatureCollection
```

## Key Functions / Modules

| Module / Notebook | Responsibility | Key Functions |
|-------------------|----------------|---------------|
| `notebooks/01_weather.ipynb` | Prototype and validate both APIs | — |
| `src/boatops/services/openmeteo.py` | Open-Meteo API client | `fetch_wind()`, `fetch_temperature()`, `fetch_precipitation()`, `fetch_cloud_cover()` |
| `src/boatops/services/meteoalarm.py` | MeteoAlarm advisory client | `fetch_advisories(bbox)` |
| `src/boatops/routers/weather.py` | FastAPI endpoints | `/forecast`, `/advisories` |

## Data Contracts

### Architect Constraints

- **MUST**: Never expose API keys or credentials to client responses
- **MUST**: Include `last_updated` ISO timestamp in every data response
- **MUST**: Return structured `{"layer": "weather", "status": "error", "message": "..."}` on failure — do not raise HTTP 500 to client
- **MUST NOT**: Cache weather data beyond its validity period (Open-Meteo updates hourly)
- **SHOULD**: Use `httpx.AsyncClient` for non-blocking API calls in FastAPI context

### Configuration

```yaml
# Environment variables loaded from .env
OPEN_METEO_BASE_URL: "https://api.open-meteo.com/v1"  # no key needed
METEOALARM_API_URL: "https://feeds.meteoalarm.org"    # no key needed
WEATHER_CACHE_TTL_SECONDS: 3600                        # 1-hour cache
```

## Error Handling

| Error Condition | Response | Recovery |
|-----------------|----------|----------|
| Open-Meteo API timeout (>10 s) | Return `{"status": "error", "layer": "weather"}` | Retry once; then fail gracefully |
| MeteoAlarm returns empty / malformed | Return empty advisory list with warning log | Check MeteoAlarm feed status |
| Invalid bbox (out of bounds) | Raise `ValueError` with message | Validate bbox at API boundary |
| Open-Meteo rate limit (429) | Return `{"status": "error", "message": "rate limited"}` | Back off 60 s |

## Dependencies

- `httpx>=0.27` — async HTTP client
- `xarray>=2024.1` — optional; for grid data handling
- `numpy>=1.26`
- `python-dotenv>=1.0` — `.env` loading
