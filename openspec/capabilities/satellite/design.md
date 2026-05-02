# Satellite — Design

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Implementation Approach

Phase 1: Two notebooks:
- `notebooks/04_satellite_overpasses.ipynb` — CDSE OData overpass query, USGS/NASA CMR Landsat query, CelesTrak TLE + orbital propagation for VIIRS
- `notebooks/05_sentinel2_imagery.ipynb` — CDSE STAC imagery search, WMS tile URL generation; adapts patterns from `Sent2_GreenMac` CDSE_OData_Workflow_v1.ipynb

Phase 2: `src/boatops/services/cdse_auth.py`, `cdse_query.py`, `celestrak.py`, `usgs_m2m.py`; `src/boatops/routers/satellite.py`.

## Pipeline / Analysis Flow

```
Phase 1 — Notebook 04 (Overpasses):
  bbox, planning_window
    → cdse_auth: OAuth2 token (CDSE_EMAIL, CDSE_PASSWORD from .env)
    → cdse_query.get_sentinel_overpasses(bbox, window, platforms=["S2A","S2B","S3A","S3B"])
      → CDSE OData: filter by bbox, date range, platform
      → paginate (100/page), return list of acquisitions
    → usgs_m2m.get_landsat_overpasses(bbox, window)
      → NASA CMR API: Landsat 8/9 granule search
    → celestrak.get_viirs_overpasses(bbox, window)
      → fetch TLEs for Suomi-NPP, NOAA-20
      → skyfield/sgp4 propagation → ground track polylines
      → filter passes intersecting bbox
    → annotate each pass with cloud_cover from wx data, solar_elevation from solar module

Phase 1 — Notebook 05 (Imagery):
  bbox, cloud_threshold=20
    → cdse_auth: OAuth2 token
    → cdse_stac.search_sentinel2(bbox, cloud_threshold, days_back=90)
      → CDSE STAC API: search by bbox, cloud_cover < threshold
      → sort by date desc, return first result
    → build WMS URL for selected scene (true color, false color)
    → display in notebook (ipyleaflet or folium)

Phase 2 (FastAPI):
  GET /api/satellite/overpasses?bbox=...&start=...&end=...
  GET /api/satellite/sentinel2/latest?bbox=...&cloud_max=20
  GET /api/satellite/sentinel2/wms?scene_id=...&bands=true_color
```

## Key Functions / Modules

| Module / Notebook | Responsibility | Key Functions |
|-------------------|----------------|---------------|
| `notebooks/04_satellite_overpasses.ipynb` | Validate overpass query for all platforms | — |
| `notebooks/05_sentinel2_imagery.ipynb` | Validate STAC search and WMS tile access | — |
| `src/boatops/services/cdse_auth.py` | CDSE OAuth2 token management | `get_token()`, `refresh_token()` |
| `src/boatops/services/cdse_query.py` | CDSE OData + STAC queries | `get_sentinel_overpasses()`, `search_sentinel2_stac()`, `build_wms_url()` |
| `src/boatops/services/celestrak.py` | CelesTrak TLE fetch + orbital propagation | `fetch_tles(satellite_names)`, `get_overpass_windows(bbox, window, tles)` |
| `src/boatops/services/usgs_m2m.py` | USGS M2M / NASA CMR Landsat query | `get_landsat_overpasses(bbox, window)` |
| `src/boatops/routers/satellite.py` | FastAPI endpoints | `/overpasses`, `/sentinel2/latest`, `/sentinel2/wms` |

## Data Contracts

### Architect Constraints

- **MUST**: CDSE credentials (`CDSE_EMAIL`, `CDSE_PASSWORD`) in `.env`; OAuth2 token never logged or returned to client; refresh before expiry
- **MUST**: Annotate each overpass with cloud cover (from weather service) and solar elevation (from solar service) at pass time
- **MUST**: Return structured error if any platform query fails; still return results for other platforms
- **MUST NOT**: Download full Sentinel-2 `.SAFE` archives in Phase 2 (use WMS tile streaming only)
- **SHOULD**: Cache CDSE OAuth2 token for its TTL (~1 hour); cache TLEs for 24 hours

### Configuration

```yaml
# Environment variables
CDSE_EMAIL: ""          # loaded from .env
CDSE_PASSWORD: ""       # loaded from .env
USGS_M2M_API_KEY: ""    # loaded from .env (optional; NASA CMR is keyless)
CELESTRAK_TLE_URL: "https://celestrak.org/SOCRATES/"
SENTINEL2_CLOUD_THRESHOLD_DEFAULT: 20
SENTINEL2_DAYS_BACK_DEFAULT: 90
TLE_CACHE_TTL_SECONDS: 86400  # 24 hours
```

## Error Handling

| Error Condition | Response | Recovery |
|-----------------|----------|----------|
| CDSE auth failure | Structured error for CDSE-dependent platforms; Landsat/VIIRS still returned | Check `.env` credentials |
| CDSE token expired mid-request | Re-authenticate transparently; retry once | Token refresh logic in `cdse_auth.py` |
| CelesTrak TLE unavailable | Return VIIRS overpass error; other platforms unaffected | Use cached TLEs if within 24 h |
| No Sentinel-2 scene within threshold | Return `{"status": "no_scene"}` — not an error | User can raise cloud threshold |
| CDSE STAC returns 429 (rate limit) | Return structured error; log retry-after | Back off per `Retry-After` header |

## Dependencies

- `requests>=2.31` or `httpx>=0.27` — HTTP client
- `skyfield>=1.48` or `sgp4>=2.22` — orbital propagation for VIIRS TLEs
- `shapely>=2.0` — AOI intersection for ground track filtering
- `python-dotenv>=1.0`
- `xarray>=2024.1` — optional, for CDSE STAC response parsing
