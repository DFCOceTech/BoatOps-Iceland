# Solar — Design

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Implementation Approach

Phase 1: `notebooks/03_solar.ipynb` — validate suncalc outputs against USNO reference values; plot daylight timeline for example Baltic locations and dates; implement edge-case handling (polar summer).

Phase 2: `src/boatops/services/solar.py` — thin wrapper around suncalc; `src/boatops/routers/solar.py` — FastAPI router. No external API calls; fully local computation.

## Pipeline / Analysis Flow

```
Phase 1 (Notebook):
  User inputs (lat, lon, date range)
    → suncalc.get_times(date, lat, lon) → event dict
    → suncalc.get_position(time, lat, lon) → elevation, azimuth
    → build sub-hourly timeline DataFrame
    → plot timeline bar chart (daylight/twilight/night)
    → compare subset of values to USNO Solar API reference

Phase 2 (FastAPI):
  GET /api/solar/events?lat=...&lon=...&date=YYYY-MM-DD
    → solar.py → event dict (sunrise, sunset, twilight times)
  GET /api/solar/timeline?lat=...&lon=...&start=...&end=...&resolution_min=15
    → solar.py → list of {time, elevation, azimuth}
```

## Key Functions / Modules

| Module / Notebook | Responsibility | Key Functions |
|-------------------|----------------|---------------|
| `notebooks/03_solar.ipynb` | Validate and visualize suncalc | — |
| `src/boatops/services/solar.py` | suncalc wrapper | `get_solar_events(lat, lon, date)`, `get_solar_timeline(lat, lon, start, end, resolution_min)`, `get_solar_position(lat, lon, dt)` |
| `src/boatops/routers/solar.py` | FastAPI endpoints | `/events`, `/timeline`, `/position` |

## Data Contracts

### Architect Constraints

- **MUST**: All outputs in UTC; include timezone offset if local time is also returned
- **MUST**: Handle edge case where sunrise or sunset does not occur (return `null` for that event, not an error)
- **MUST NOT**: Make any network calls — solar geometry is fully local computation
- **SHOULD**: Cache timeline results in memory for repeated calls with same inputs (TTL = session)

### Configuration

```yaml
# No credentials required
SOLAR_DEFAULT_RESOLUTION_MINUTES: 15
SOLAR_MAX_WINDOW_DAYS: 14
```

## Error Handling

| Error Condition | Response | Recovery |
|-----------------|----------|----------|
| Invalid lat/lon | Raise `ValueError` | Validate at API boundary |
| No sunrise/sunset (polar summer) | Return `null` for missing event; include `"polar_day": true` flag | Expected behavior; not an error |
| Resolution < 1 minute requested | Clamp to 1 minute with warning | Log warning |

## Dependencies

- `suncalc>=0.1.2` — Python port of SunCalc.js; solar position and times
- `datetime` (stdlib)
- `zoneinfo` (stdlib, Python 3.9+) — for local time conversion if needed
