# Map — Design

> Version: 1.0 | Status: Draft | Last updated: 2026-05-01

## Implementation Approach

Phase 1: `notebooks/06_map_layers.ipynb` — validate tile sources (OSM, OpenSeaMap), test GeoTIFF rendering in ipyleaflet or folium, test a sample WMS endpoint. Goal: confirm tile URLs work and understand any CORS or proxy requirements.

Phase 2: Backend endpoints for GeoTIFF upload/reproject and WMS/WMTS proxy. Tile sources (OSM, OpenSeaMap) are served directly to the frontend.

Phase 3: MapLibre GL JS frontend with all layer controls, AOI draw, time picker, and animated layers.

## Pipeline / Analysis Flow

```
Phase 1 (Notebook):
  → ipyleaflet or folium map
    → add OSM TileLayer
    → add OpenSeaMap TileLayer
    → add sample GeoTIFF as ImageOverlay (rasterio for bbox extraction)
    → add sample WMS layer
    → verify rendering

Phase 2 (FastAPI):
  POST /api/map/geotiff         # Upload GeoTIFF; return bbox and tile URL
  GET  /api/map/wms-proxy       # Proxy user WMS request (avoid CORS; validate URL)
  GET  /api/map/tile-sources    # Return configured tile source URLs

Phase 3 (MapLibre GL JS):
  → MapLibre map instance
    → OSM raster source + layer
    → OpenSeaMap raster source + layer
    → Dynamic data layers (weather, waves, satellite) from FastAPI
    → AOI draw control
    → Time picker → update all time-sensitive layers
```

## Key Functions / Modules

| Module / Notebook | Responsibility | Key Functions |
|-------------------|----------------|---------------|
| `notebooks/06_map_layers.ipynb` | Validate tile sources and GeoTIFF rendering | — |
| `src/boatops/services/geotiff.py` | GeoTIFF upload and CRS validation | `validate_geotiff(path)`, `get_bbox(path)`, `reproject_to_4326(path)` |
| `src/boatops/routers/map_layers.py` | FastAPI endpoints | `/geotiff`, `/wms-proxy`, `/tile-sources` |

## Data Contracts

### Architect Constraints

- **MUST**: Validate WMS/WMTS URLs before proxying — block non-HTTP/HTTPS schemes and private IP ranges to prevent SSRF
- **MUST**: Validate GeoTIFF CRS on upload; reject files with no spatial reference
- **MUST NOT**: Store uploaded GeoTIFFs persistently — hold in temp storage for session duration only
- **SHOULD**: Reproject GeoTIFF to EPSG:4326 if needed before serving as overlay

### Configuration

```yaml
OSM_TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
OPENSEAMAP_TILE_URL: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
GEOTIFF_MAX_SIZE_MB: 200
WMS_PROXY_ALLOWED_SCHEMES: ["http", "https"]
WMS_PROXY_BLOCK_PRIVATE_IPS: true
```

## Error Handling

| Error Condition | Response | Recovery |
|-----------------|----------|----------|
| GeoTIFF has no CRS | Return `{"status": "error", "message": "GeoTIFF has no CRS — cannot georeference"}` | User must provide correctly projected file |
| WMS URL is private IP | Return `{"status": "error", "message": "URL not allowed"}` | SSRF prevention |
| WMS service returns error | Return `{"status": "error", "layer": "wms", "message": "..."}` | User checks WMS URL |

## Dependencies

- `rasterio>=1.3` — GeoTIFF CRS validation and reprojection
- `pyproj>=3.6` — CRS transformation
- `httpx>=0.27` — WMS proxy requests
