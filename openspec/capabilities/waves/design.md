# Waves — Design

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Implementation Approach

Phase 1: `notebooks/02_waves.ipynb` — authenticate to CMEMS, query the Baltic Sea Wave Forecast product (`BALTICSEA_ANALYSISFORECAST_WAV_003_010`), download a subset for a test AOI and time range, visualize Hs and wave direction. Determine whether MOTU or OPeNDAP is more practical for the web backend.

Phase 2: `src/boatops/services/cmems.py` — CMEMS API client; `src/boatops/routers/waves.py` — FastAPI router.

## Pipeline / Analysis Flow

```
Phase 1 (Notebook):
  User inputs (bbox, start, end)
    → cmems_auth: load CMEMS_USERNAME, CMEMS_PASSWORD from .env
    → copernicusmarine.subset() or motuclient request
      → product: BALTICSEA_ANALYSISFORECAST_WAV_003_010
      → variables: VHM0, VMDR
      → subset by bbox and time range
    → returns xarray Dataset
    → plot: pcolormesh(Hs), quiver(wave_dir)
    → inspect: time resolution, spatial resolution, update cadence

Phase 2 (FastAPI):
  GET /api/waves/forecast?bbox=...&start=...&end=...
    → cmems.py → dict/JSON (subsetted grid)
  GET /api/waves/snapshot?bbox=...&time=...
    → cmems.py → single time-slice JSON
```

## Key Functions / Modules

| Module / Notebook | Responsibility | Key Functions |
|-------------------|----------------|---------------|
| `notebooks/02_waves.ipynb` | Validate CMEMS access and data shapes | — |
| `src/boatops/services/cmems.py` | CMEMS API client | `fetch_wave_forecast(bbox, start, end)`, `fetch_wave_snapshot(bbox, time)` |
| `src/boatops/routers/waves.py` | FastAPI endpoints | `/forecast`, `/snapshot` |

## Data Contracts

### Architect Constraints

- **MUST**: CMEMS credentials (`CMEMS_USERNAME`, `CMEMS_PASSWORD`) loaded from `.env`; never logged or returned to client
- **MUST**: Include `model_run_time` and `last_updated` in every response
- **MUST**: Return structured error (not HTTP 500) if CMEMS is unavailable
- **MUST NOT**: Cache wave data beyond 1 hour (CMEMS updates every 1–6 hours)
- **SHOULD**: Use `copernicusmarine` Python package if available; fall back to MOTU client

### Configuration

```yaml
# Environment variables
CMEMS_USERNAME: ""      # loaded from .env
CMEMS_PASSWORD: ""      # loaded from .env
CMEMS_WAVE_PRODUCT: "BALTICSEA_ANALYSISFORECAST_WAV_003_010"
CMEMS_WAVE_DATASET: "cmems_mod_bal_wav_anfc_PT1H-i"
WAVE_CACHE_TTL_SECONDS: 3600
```

## Error Handling

| Error Condition | Response | Recovery |
|-----------------|----------|----------|
| CMEMS auth failure | Return structured error; log warning | Check `.env` credentials |
| CMEMS product unavailable | Return structured error with last-known update time if cached | Use cached data if within TTL |
| Bbox outside Baltic coverage | Return `ValueError` with coverage extent | Validate bbox against product coverage |
| NetCDF parse error | Return structured error | Log traceback for debugging |

## Dependencies

- `copernicusmarine>=1.3` — official CMEMS Python client (preferred)
- `xarray>=2024.1` — NetCDF handling
- `numpy>=1.26`
- `python-dotenv>=1.0`
