# Data Sources & External Resources — BoatOps

> Last updated: 2026-05-01

## Local Data Paths

| Dataset | Local Path | Format | Notes |
|---------|-----------|--------|-------|
| Test fixtures | `tests/fixtures/` | Various | Small synthetic data for unit tests only |
| Downloaded wave/satellite data | `data/raw/` | NetCDF, GeoTIFF | Gitignored; ephemeral downloads |

## Remote / External Sources

| Source | URL / API | Access Method | Refresh Cadence | Notes |
|--------|-----------|---------------|-----------------|-------|
| Open-Meteo Weather | `https://api.open-meteo.com/v1/forecast` | No auth (non-commercial) | Hourly forecast updates | Returns JSON; variables: wind_speed_10m, wind_direction_10m, temperature_2m, precipitation, cloudcover; 7-day horizon |
| MeteoAlarm Advisories | `https://feeds.meteoalarm.org` | No auth | Real-time | EU member state weather warnings; GeoJSON or CAP XML; covers Baltic/DE |
| CMEMS Baltic Wave Forecast | `https://marine.copernicus.eu` via copernicusmarine client | CMEMS credentials | Every 1–6 hours | Product: `BALTICSEA_ANALYSISFORECAST_WAV_003_010`; variables: VHM0 (Hs), VMDR (direction); ~2 nm spatial resolution |
| CDSE OData API | `https://catalogue.dataspace.copernicus.eu/odata/v1/` | OAuth2 bearer token (email+password) | On demand | Sentinel-2/3 acquisition search; operator registered; paginated (100/page) |
| CDSE STAC API | `https://catalogue.dataspace.copernicus.eu/stac/` | OAuth2 bearer token | On demand | Sentinel-2 Level-2A imagery search by AOI, date, cloud cover |
| CDSE OGC WMS/WMTS | `https://services.dataspace.copernicus.eu/ogc/wms/` | OAuth2 bearer token | On demand | Sentinel-2 tile streaming; supports true color (B4/B3/B2) and false color (B8/B4/B3) |
| NASA CMR (Landsat) | `https://cmr.earthdata.nasa.gov/search/granules.json` | No auth (public) | On demand | Landsat 8/9 granule search; `short_name=LANDSAT_OT_C2_L2` |
| CelesTrak TLE catalog | `https://celestrak.org/SOCRATES/` | No auth | Daily | TLE data for Suomi-NPP, NOAA-20 (VIIRS); use `skyfield` or `sgp4` for propagation |
| OpenStreetMap tiles | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | No auth | Real-time | OSM tile usage policy applies; do not hammer |
| OpenSeaMap tiles | `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png` | No auth | Updated periodically | Seamark overlay for Baltic nautical charts |
| GEBCO Bathymetry WMS | `https://wms.gebco.net/mapserv` | No auth | Annual grid releases | Layer: `GEBCO_LATEST` (2023, 15-arc-second); supports EPSG:4326 and EPSG:3857; WMS 1.3.0. Old URL `gebco.net/.../mapserv` returns 404 |
| CMEMS Baltic SST L4 | `copernicusmarine.open_dataset` | CMEMS credentials | Daily NRT | Dataset: `DMI-BALTIC-SST-L4-NRT-OBS_FULL_TIME_SERIE`; product `SST_BAL_SST_L4_NRT_OBSERVATIONS_010_007_b`; variable `analysed_sst` in Kelvin (subtract 273.15); no depth dim |
| CMEMS Baltic Physics | `copernicusmarine.open_dataset` | CMEMS credentials | Daily mean | Dataset: `cmems_mod_bal_phy_anfc_P1D-m`; product `BALTICSEA_ANALYSISFORECAST_PHY_003_006`; variables: `so` (salinity PSU), `uo`/`vo` (currents m/s), `thetao` (temp °C), `o2b`? No — physics has no BGC. Surface at `depth[0]` ≈ 0.5 m |
| CMEMS Baltic BGC | `copernicusmarine.open_dataset` | CMEMS credentials | Daily mean | Dataset: `cmems_mod_bal_bgc_anfc_P1D-m`; product `BALTICSEA_ANALYSISFORECAST_BGC_003_007`; variables: `chl` (mg/m³, depth[0]), `o2b` (mmol/m³, 2-D bottom value — no depth dim); hypoxia threshold ≈ 63 mmol/m³ |
| CMEMS Baltic Physics Static | `copernicusmarine.open_dataset` | CMEMS credentials | Static (no time dim) | Dataset: `cmems_mod_bal_phy_anfc_static`; variable: `deptho` (ocean bottom depth m, NaN=land); 150×198 grid, 3.1–79.6 m; used for transparent marine bathymetry overlay instead of GEBCO/EMODnet WMS (both return fully opaque images) |
| EMODnet Seabed Habitats WMS | `https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms` | No auth | Updated with new surveys | Layer: `eusm_helcom_group` (HELCOM Baltic classification, multi-scale); `eusm2022` monolithic layer no longer exists; `_full`-suffix layers blank at overview zoom |
| Claude API | `https://api.anthropic.com/v1/messages` | Anthropic API key | On demand | AI synthesis; use `claude-sonnet-4-6`; prompt caching for system prompt |
| SunCalc (Python) | Local library call | None | N/A | Deterministic solar geometry; no network required |

## Access Credentials

**Never store credentials here.** Use environment variables loaded from `.env` (gitignored).

| Service | Env Var | Notes |
|---------|---------|-------|
| CDSE (Copernicus Data Space) | `CDSE_EMAIL`, `CDSE_PASSWORD` | Operator already registered; OAuth2 token endpoint: `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token` |
| CMEMS (Copernicus Marine) | `CMEMS_USERNAME`, `CMEMS_PASSWORD` | Register at marine.copernicus.eu if not already |
| Anthropic Claude API | `ANTHROPIC_API_KEY` | Required for AI synthesis (nice-to-have) |
| USGS M2M API (optional) | `USGS_M2M_API_KEY` | Optional; NASA CMR is keyless alternative for Landsat overpass |

## Data Directory Convention

```
data/
  raw/          # Immutable original data — never modified after download
  external/     # Third-party reference data (e.g., Baltic coastline shapefile)
  interim/      # Intermediate transformed data
  processed/    # Final analysis-ready datasets — primary outputs
```

## Downloading / Refreshing Data

```bash
# Wave forecast (CMEMS) — example via copernicusmarine
conda activate boatops
python -c "
import copernicusmarine
copernicusmarine.subset(
    dataset_id='cmems_mod_bal_wav_anfc_PT1H-i',
    variables=['VHM0', 'VMDR'],
    minimum_longitude=9.5, maximum_longitude=15.0,
    minimum_latitude=53.5, maximum_latitude=56.0,
    output_filename='data/raw/baltic_wave_test.nc'
)
"

# CelesTrak TLEs — fetch for VIIRS satellites
# (see notebooks/04_satellite_overpasses.ipynb for working example)
```

## API Gotchas (confirmed in Phase 1 notebooks)

| API | Gotcha | Fix |
|-----|--------|-----|
| suncalc | Arg order is `(lng, lat)`, not `(lat, lon)` | Always pass longitude first |
| suncalc | Returns tz-naive `pd.NaT` for missing events (polar summer), not Python `None` | Use `pd.isna(v)`; then `v.tz_localize("UTC")` |
| suncalc | Altitude/azimuth in **radians**; azimuth south=0 | Convert: `np.degrees(alt)`; azimuth north=0: `(np.degrees(az)+180)%360` |
| CMEMS `copernicusmarine` v2 | `describe()` does not accept `username`/`password` kwargs | Set `COPERNICUSMARINE_SERVICE_USERNAME/PASSWORD` env vars |
| CMEMS Baltic Wave | Warnemünde (54.18°N, 12.08°E) is a land-masked cell | Nearest-wet-cell fallback required in Phase 2 |
| CDSE OData | `$expand=Attributes,Assets` combined returns 400 | Two separate requests: one with `$expand=Attributes`, one with `$expand=Assets` |
| CDSE OData | Quicklook asset is JPEG, not PNG | Use `PIL.Image.open(BytesIO(bytes))` |
| CDSE STAC | `stac.dataspace.copernicus.eu/v1` does not contain Sentinel-2 | Use OData for Sentinel-2 discovery |
| Sentinel Hub Process API | Requires instance ID? **No** — works with CDSE OAuth2 Bearer token | `POST https://sh.dataspace.copernicus.eu/api/v1/process` with Bearer token |
| CelesTrak | Old endpoint `satcat/tle.php` deprecated 2020 | New: `gp.php?CATNR=<NORAD_ID>&FORMAT=tle` |
| Skyfield `Time` (scalar) | `if peak_t:` raises `TypeError: this is a single Time, not an array` | Use `if peak_t is not None:` |
| NASA CMR Landsat | Returns 0 results for recent dates | TLE propagation via skyfield used instead for future planning |
| MeteoAlarm Atom feed | No polygon geometry — area in plain text only | DWD WFS or EUMETNET GeoJSON API needed for map overlays |
| Open-Meteo wind direction | Can return exactly 360° (due north) | Use `<= 360` in bounds check, not `< 360` |
| GEBCO WMS | Old URL `gebco.net/.../mapserv` returns 404 | Use `https://wms.gebco.net/mapserv` |
| GEBCO/EMODnet Bathymetry WMS | All pixels alpha=255 (land fully opaque) — cannot be used as transparent overlay | Use `deptho` from `cmems_mod_bal_phy_anfc_static`; NaN=land → transparent |
| EMODnet Seabed Habitats | Monolithic `eusm2022` layer no longer exists | Use `eusm_helcom_group` (Baltic) or `eusm_bio_group` (pan-European) |
| EMODnet `_full`-suffix layers | Return blank image at overview zoom | Use `_group`-suffix layers for multi-scale display |
| ipyleaflet 0.20 VelocityLayer | Not available in ipyleaflet 0.20 | Use folium + leaflet-velocity CDN (jsdelivr v1.9.1) for animated particle fields |

## Known Data Issues

| Dataset | Issue | Workaround |
|---------|-------|------------|
| CMEMS Baltic Wave | Separate account from CDSE (see `.env`) | Credentials in `.env` as COPERNICUSMARINE_SERVICE_USERNAME/PASSWORD |
| MeteoAlarm | CAP XML format may vary by country; no polygon geometry | DWD WFS for polygon overlays (Phase 2 investigation needed) |
| CelesTrak TLEs | TLEs become inaccurate >7 days from epoch | Refresh daily; flag passes where age_days > 7 |
| Sentinel-2 partial tiles | Scenes at orbit edge cover only a strip of the 110×110 km tile | Partial tile filter: footprint area / full_tile_area ≥ 0.5 (configurable) |

## Coordinate Reference Systems

| Dataset | CRS | Notes |
|---------|-----|-------|
| Open-Meteo | EPSG:4326 | lat/lon grid |
| CMEMS Baltic Wave | EPSG:4326 | Regular lat/lon grid; ~2 nm resolution |
| CDSE Sentinel-2 | EPSG:32632 or 32633 (UTM 32N/33N) | Reproject to EPSG:4326 for display |
| OpenStreetMap tiles | Pseudo-Mercator EPSG:3857 | Web Mercator; standard tile projection |
| User GeoTIFF | Variable | Validate and reproject to EPSG:4326 on upload |

**Project CRS**: EPSG:4326 (WGS84 geographic) — all data exchange and API responses in lat/lon degrees.
