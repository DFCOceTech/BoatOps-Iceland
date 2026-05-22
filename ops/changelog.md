# Changelog — BoatOps

Rolling 2-week work log. Remove entries older than 2 weeks.

## 2026-05-21

**Station markers, click assessment, currents units — feature/improvements-may-2026** (user instruction)

- **REQ-MAP-031**: Surface currents legend/metadata units changed from kt to m/s; `MS_TO_KT` constant removed from `CurrentsLayerPanel.tsx`.
- **REQ-MAP-029**: `StationMarkers.tsx` — toggleable MapLibre markers for MARNET Fehmarnbelt (54.595°N, 11.183°E), Darßer Schwelle (54.700°N, 12.700°E), Oder Bank (54.067°N, 14.152°E) and FINO2 (55.010°N, 13.157°E); dark popup via `utils/popupStyles.ts`.
- **REQ-MAP-030**: `MapClickPanel.tsx` — crosshair click mode; fetches wave + weather in parallel for clicked point; popup shows Go/No-Go verdict + per-capability rows at active planning hour; AbortController cancels stale fetches.
- **Sidebar**: `MapClickPanel` inserted below GoNoDashboard; `StationMarkers` inserted after IsobathLayer.
- **Bug fixed**: `disabled={loading}` on all animated-overlay checkboxes changed to `disabled={loading && !grid/blobUrl}` so overlays can always be unchecked; `toggle()` in `useApiLayers` now aborts in-flight fetches on hide.

**Time-varying oceanographic overlays — feature/improvements-may-2026** (user instruction)

- **REQ-MAP-024–028**: SST, salinity, chlorophyll, currents (quiver + particle animation), and wave height overlays all accept `?hour=N` (0–167) on their API endpoints. Backend fetches the full time-series dataset once per bbox (cached 1 h in `_ds_cache`), then index-selects the right timestep per request.
- `_hour_to_tidx(ds, hour)`: auto-detects daily vs hourly resolution from the first time-delta; clamps to `[0, n-1]`.
- Frontend: `useApiLayers(defs, map, hour)` accepts `forecastHour` from TimeContext; `useEffect([hour])` refetches all visible, time-varying layers on slider change. `toggle()` always fetches fresh data on re-enable (fixes stale-blob after slider move while hidden). `raster-fade-duration: 0` prevents crossfade flash between slider steps.
- `CurrentsLayerPanel` uses `forecastHourRef` inside `fetchGrid`; `useEffect([forecastHour])` triggers refetch when visible.
- `oceanLayers.ts`: `ApiLayerDef.fetch` is `(hour?) => Promise<BlobResult>`; bathymetry and oxygen have `timeVarying: false`.
- 6 new tests added (hour param for SST/salinity/currents/chlorophyll; wave overlay PNG + hour); all 72 tests pass.

**Add Sentinel-1 overpass prediction — feature/improvements-may-2026** (user instruction)

- **REQ-SAT-011**: `Sentinel-1A` (NORAD 39634) and `Sentinel-1C` (NORAD 62261) added to `SATELLITE_CATALOG` in `celestrak.py`. `SATELLITE_CATALOG` refactored from `{name: int}` to `{name: {norad, daytime_only}}`. `_predict_passes` accepts `daytime_only` bool; SAR satellites skip the solar-elevation check and return night passes.
- **Frontend**: `PLATFORM_COLORS` and `ensureTrackLayer` match expression updated to color Sentinel-1 passes green (`#4ade80`). Pre-existing `'Landsat-8'` → `'Landsat 8'` key mismatch fixed.
- **E2E verified**: `get_overpasses((9.5,53.5,15.0,56.0), days=7)` returns 7 Sentinel-1 passes (1A + 1C) with correct `track_coords`.

## 2026-05-11

**Improvements batch — feature/improvements-may-2026** (triggered by improvements.md)

- **Dark vector basemap**: replaced OSM raster tiles with OpenFreeMap vector tiles (no API key). Custom `DARK_BASEMAP_STYLE` (`basemapStyle.ts`) sets land `#090909`, water `#1e3278`, dim borders, minimal city labels. `background-opacity: 0.85` dims land layers per REQ-MAP-019.
- **Seamark icon size +20%**: `tileSize: 307` (256 × 1.2) in `layers.ts` for the OpenSeaMap raster source.
- **Isobath vector lines (10/25/100 m)**: `cmems.get_isobaths()` fetches CMEMS static `deptho`, runs `matplotlib.contour` at three depth levels, returns GeoJSON FeatureCollection. `GET /api/map/isobaths` endpoint added. `getIsobaths()` in `client.ts`.
- **Wind in m/s**: `WeatherPanel.tsx` and `WindLayerPanel.tsx` now display m/s; `windClass` thresholds updated (8/13 m/s for Bft 4/6); chart Y-axis domain capped at 25 m/s; reference lines at 8 and 13 m/s.
- **Wind vmax cap**: `openmeteo._VMAX_WIND_CAP_MS = 20.0`; `get_wind_grid()` applies `min(vmax, 20.0)`. Factored raw grid fetch into cached `_fetch_wind_grid_raw()` (7-day, shared across all `hour` requests).
- **7-day planning time slider**: `TimeContext.tsx` (global `forecastHour` 0–167); `TimeSlider.tsx` (range input, day-boundary labels, "Now" reset button, active-day highlight); `WeatherPanel` indexes into forecast arrays using `forecastHour`; `WindLayerPanel` refetches with `?hour=N` on slider change.
- **Satellite ground tracks + click-to-time**: `celestrak.py` now includes `track_coords: [[lon, lat], ...]` in each pass dict. `SatellitePanel.tsx` adds a "Show satellite tracks" toggle that renders a MapLibre GeoJSON line layer (colour-coded by platform). Clicking a pass row in the overpass table calls `setForecastHour()` with that pass's AOS hour offset.
- **README.md created**: covers quick start, capabilities, map layers, data sources, planning time slider, satellite tracks, architecture, roadmap.
- **Tests**: 3 new isobath tests, 3 new wind-grid tests (including vmax cap and hour param); `test_overpasses_schema` extended to assert `track_coords`; colorscale tests updated to data-agnostic assertions. All 66 tests pass.

## 2026-05-05

**Animated surface-currents overlay**

- **`GET /api/map/currents-grid`**: new endpoint in `map_layers.py`; `get_currents_grid()` in `cmems.py` fetches CMEMS `cmems_mod_bal_phy_anfc_P1D-m` (`uo`, `vo` at depth[0]), subsamples to 0.25° grid via `xarray.sel(method='nearest')`, caps `vmax_speed` at `nanpercentile(speed, 99.5)` + 1.5 m/s physical ceiling, returns same JSON shape as wind grid
- **`CurrentsLayerPanel.tsx`**: animated particle overlay using same canvas system as `WindLayerPanel` — 500 particles, `TARGET_PX_PER_S=80` (slower than wind's 150), cmocean.speed color ramp (navy→teal→lime), z-index 2 (above wind canvas at z-index 1)
- **Static currents quiver removed**: `api-currents` entry removed from `oceanLayers.ts`; `GET /api/map/currents` PNG endpoint retained in backend but no longer exposed in frontend
- **Bug fixes applied to both particle panels** (Raze): `cancelled` flag in animation frame loop prevents zombie rAF callbacks after component unmount; `fetchIdRef` stale-fetch guard prevents double-canvas from concurrent refreshes; `vmax_speed=0` guard in `tickParticle` prevents particles animating at max speed on a calm grid; fetch failure sets `visible=false` instead of leaving checkbox checked with no overlay; `spawn()` caps initial `age` below `maxAge` so no dead-on-arrival particles
- Spec updated: REQ-MAP-014 + SCENARIO-MAP-CUR-OVERLAY-001 updated from quiver PNG to animated particle overlay

## 2026-05-04

**Animated wind overlay + autoscaled colormaps**

- **Wind overlay**: `GET /api/weather/wind-grid` — Open-Meteo batch request for U/V 10m wind on a 0.25° grid (288 pts, single call); `WindLayerPanel.tsx` — 600-particle canvas animation over MapLibre, geographic lat/lon particle positions with bilinear U/V interpolation, zoom-invariant visual speed (150 px/s at max wind), HSL ramp autoscaled to `vmax_speed` (blue=calm → red=max), `destination-out` fade for trail effect, ResizeObserver + zoom-clear
- **Autoscaled colormaps** (`cmems.py`): all overlays now use `nanpercentile`-based vmin/vmax instead of hardcoded values — SST (p2–p98 °C), salinity (p2–p98 PSU), wave Hs (0–p99 m), chlorophyll (log, p2–p98 mg/m³ of positive values), bottom O2 (p2–p98 mmol/m³). Legends show actual data range per fetch.
- **Currents artefact fix**: CMEMS `uo`/`vo` fill-value artefacts near land/boundaries inflate naive `nanmax` to 4–20 m/s (unrealistic; Baltic currents are 0–1 m/s). Fixed with 99.5th percentile + hard 1.5 m/s physical cap.
- **Date parsing fix**: `parseIso()` helper added to SolarPanel + SatellitePanel — Python's `isoformat()` emits `+00:00` not `Z`; old `endsWith('Z')` guard was appending a second timezone suffix → `RangeError` → black screen.

## 2026-05-03

**Production deployment — Docker Compose ✅**

- `docker-compose.yml`: `api` (FastAPI/uvicorn, healthcheck) + `web` (nginx:1.27-alpine, mounts `frontend/dist/`, proxies `/api/*`)
- `deploy/Dockerfile`: micromamba/Python 3.11 production image; 4 workers + `--proxy-headers` + `--forwarded-allow-ips=172.16.0.0/12`
- `deploy/environment-prod.yml`: runtime-only conda env (no Jupyter/notebooks)
- `deploy/nginx.conf`: SPA fallback, 90s proxy timeout for S2 overlay, immutable asset cache
- `.env.example`: corrected variable names (`COPERNICUSMARINE_SERVICE_USERNAME`, not `CMEMS_USERNAME`)
- `.dockerignore`: prevents `__pycache__`, egg-info, notebooks, data from entering build context
- `ops/deploy.md`: full deployment guide — prerequisites, build steps, update, logs, HTTPS options, troubleshooting
- Gate 4 (Raze): 4 findings fixed — missing `.dockerignore` (cpython-313 pyc in image), editable install → regular, worker comment wrong (processes not threads), `--forwarded-allow-ips` missing; 2 docs added to troubleshooting table

**Cross-browser E2E — NFR-04 ✅ Verified**

- **NFR-04 ✅** Playwright 1.59 E2E suite: 42 tests (14 scenarios × 3 browsers — Chromium, Firefox, WebKit), all pass; API calls mocked via `page.route()` (no live backend needed); covers app load, Go/No-Go dashboard (verdict, rows, settings modal, refresh), all 5 data panels, error degrades gracefully (NFR-06), sidebar collapse/expand
- 2 bugs found+fixed: `<title>frontend</title>` → `<title>BoatOps</title>`; sidebar toggle button clipped by `overflow:hidden` on `position:relative` containing block — fixed with `position:fixed` (viewport-anchored)
- Gate 4 (Raze — inline): changelog and traceability NFR rows missing → fixed; `right:380` hardcoded twice in same file → acceptable within scope

**Epic 03 ✅ Complete — React + MapLibre GL JS frontend, 6/6 stories**

**Epic 03 — S03-06 ✅ Go/No-Go dashboard**

- **S03-06 ✅** `GoNoGoContext` — push model context: panels push windKt/gustKt/hsM/cloudPct/solarElevDeg via `update()` when their `useFetch` data arrives; `triggerRefresh()` + `refreshSignal` counter allows dashboard ↻ button to trigger all panel refetches; `GoNoDashboard` — overall verdict badge (Go/Caution/No-Go/Awaiting Data), per-capability rows (icon + label + colored value + status dot with grey=pending), ↻ refresh button, ⚙ threshold settings modal persisted to `localStorage`, FR-16 AI placeholder; WeatherPanel/WavePanel/SolarPanel: each pushes to context and subscribes to `refreshSignal`
- Gate 4 (Raze): 2 findings fixed — `defaultValue` (uncontrolled) in modal broke Reset Defaults visually (fixed: `value=` controlled inputs); no refresh button in dashboard panel (fixed: added ↻ + `triggerRefresh` + `refreshSignal` subscription in all panels)

**Epic 03 — S03-05 ✅ Solar + satellite panels**

- **S03-05 ✅** `SolarPanel` — solar times table (sunrise/noon/sunset + civil/nautical/astronomical dawn+dusk in Berlin/CET via `Intl.DateTimeFormat`), SVG semicircle elevation gauge with coloured arc fill and tick marks, period badge (day/civil_twilight/nautical_twilight/astronomical_twilight/night), 60-second auto-refresh for elevation via `setInterval` + ref pattern; `SatellitePanel` — overpass table grouped by platform (alphabetical section headers, platform-colored) with AOS in Berlin time, satellite max elevation column (≥20° in green), daytime pass row highlight (today's sunrise–sunset proxy); S2 overlay toggle with full lifecycle management — `S2OverlayResult` type in client.ts reads `X-Scene-Id`/`X-Acquisition-Time`/`X-Cloud-Cover` headers, acquisition date + cloud cover badge shown, `AbortController.signal` threaded all the way to `fetch()` for cancellation of 10–30 s requests, `mapRef` pattern avoids stale closure after async window, `mountedRef` guard in `doAdd` callback
- Gate 4 (Raze): 6 findings fixed — AbortController signal not passed to fetch(); stale closed-over map in doAdd() (now uses mapRef.current); overpass table had no platform grouping; astronomical dawn/dusk row missing from solar times table; satellite elevation column incorrectly implied solar elevation (legend clarified); `map.once('load', doAdd)` post-unmount safety via mountedRef guard

**Epic 03 — S03-04 ✅ Weather + waves panels**

- **S03-04 ✅** `useFetch` generic hook with mounted-ref guard and fetcherRef (stable closure, no re-fetch storm); `WeatherPanel` — current conditions card (wind kt + arrow, gust, temp, cloud, precip), 7-day Recharts ComposedChart (wind line + gust fill + cloud area, 15/25 kt reference lines, every-6h thinning), advisory count badge; `WavePanel` — current Hs with Go/Caution/No-Go colour coding, wave direction + bearing label, timestamp UTC suffix, wave overlay checkbox toggle via `useApiLayers`
- Gate 4 (Raze): advisory pluralization bug fixed ("advisories" not "advisoriesies"); wave timestamp now shows "UTC" suffix

**Epic 03 — S03-03 ✅ Oceanographic overlay layers**

- **S03-03 ✅** `oceanLayers.ts` typed `ApiLayerDef` config with CSS gradient per cmocean colormap; `useApiLayers` hook — lazy fetch on first toggle, AbortController cancel on unmount/refresh, blob URL lifecycle, MapLibre `ImageSource` + `RasterLayer` per layer; `OceanLayerPanel.tsx` — checkbox toggle, loading spinner, error state with retry, colorscale legend bar, timestamp badge, opacity slider; `ColorscaleLegend.tsx` — gradient bar, vmin/vmax/unit labels; 6 layers: bathymetry, SST, salinity, currents, chl-a, bottom O₂
- Gate 4 (Raze): 3 bugs fixed — stale closure (opacity read at add-time now uses constant default); AbortController + mounted ref prevent state updates after unmount; checkbox `stopPropagation` removed (was blocking `onChange` when clicking input directly)

**Epic 03 — S03-02 ✅ Base map + layer toggle panel**

- **S03-02 ✅** `MapContext` React context shares map instance; `layers.ts` typed `RasterLayerDef` config; `useLayerVisibility` hook adds/removes sources+layers on map and syncs checkbox state; `LayerPanel.tsx` checkbox list in sidebar (OpenSeaMap, GEBCO WMS, EMODnet WMS); `CoordDisplay.tsx` cursor lat/lon overlay (hemisphere-correct °N/S/E/W); 0 TS errors
- Gate 4 (Raze): 2 issues fixed — `layerDefs` added to `useEffect` dep array (stale closure risk); coordinate display shows correct N/S/E/W hemispheres

**Epic 03 started — React + MapLibre GL JS frontend**

- **S03-01 ✅** Vite 8 + React 18 + TypeScript scaffold; `maplibre-gl` + `recharts` installed; Vite dev proxy `/api/*` → `localhost:8000`; `src/api/client.ts` typed fetch wrappers for all 14 FastAPI endpoints (JSON + PNG/blob); `MapView.tsx` MapLibre GL JS map centred on Baltic (OSM tiles, nav + scale controls); `Sidebar.tsx` collapsible dark panel; `npm run build` passes, 0 TS errors
- Gate 4 (Raze): 2 HIGH bugs fixed — bbox header validation (malformed `split().map(Number)` silent NaN), `JSON.parse` on `X-Colorscale` header wrapped in try/catch with safe default

**Epic 02 ✅ Complete — FastAPI backend, 6/6 stories, 60 tests**

- **S02-01 ✅** FastAPI skeleton: `src/boatops/` package, pydantic-settings config, `cachetools.TTLCache` cache factory, per-capability router stubs → 501, `/health` endpoint
- **S02-02 ✅** Weather router: `services/openmeteo.py` (168-item hourly JSON, m/s+knots, TTL 15 min), `services/meteoalarm.py` (GeoJSON FC, geometry=null, TTL 5 min); `GET /api/weather/{forecast,advisories}`
- **S02-03 ✅** Waves router: `services/cmems.py` `get_wave_point` (nearest-wet-cell fallback), `get_wave_overlay` (cmocean.amp PNG, TTL 1 h); `utils/raster.py` shared PNG rendering (thread-safe: FigureCanvasAgg); `GET /api/waves/{forecast,overlay}`
- **S02-04 ✅** Solar router: `services/solar.py` `get_solar_times` (ISO UTC, null for polar), `get_solar_elevation` (period classification); no cache — deterministic <10 ms; `GET /api/solar/{times,elevation}`
- **S02-05 ✅** Satellite router: `services/cdse_auth.py` (OAuth2 TTL 5 min), `services/celestrak.py` (TLE + skyfield, 6 platforms, `if peak_t is not None:` gotcha preserved), `services/sentinel_hub.py` (OData scene query + SH Process API PNG); `GET /api/satellite/{overpasses,s2-overlay}`
- **S02-06 ✅** Map layers router: 6 CMEMS overlay endpoints — bathymetry (deptho, cmocean.deep, 24 h), SST (thermal), salinity (haline), currents (speed quiver), chlorophyll (algae, LogNorm), oxygen (oxy, hypoxia threshold in header); `GET /api/map/{bathymetry,sst,salinity,currents,chlorophyll,oxygen}`
- All spec-anchor docs reconciled: architecture.md, traceability.md, all 5 capability specs, epic-02.md

## 2026-05-02

**S01-06 visualization rewrite — cmocean + Leaflet.velocity**

- All colormaps replaced with cmocean perceptually uniform palettes: `deep` (bathymetry), `amp` (waves), `thermal` (SST), `haline` (salinity), `speed` (currents), `algae` (chlorophyll), `oxy` (bottom O₂)
- GEBCO WMS and EMODnet Bathymetry WMS both found fully opaque (alpha=255 on all pixels); replaced with `deptho` from `cmems_mod_bal_phy_anfc_static` — NaN=land → transparent marine-only overlay
- ipyleaflet 0.20 lacks VelocityLayer; implemented Leaflet.velocity animated particle maps using folium + jsdelivr CDN (v1.9.1); windy.com-style visualizations for surface currents and wave propagation
- Sentinel-2: switched from cloud-free mosaic to single scene query (OData `$orderby ContentDate/Start desc`, `cloudCover lt 20`) followed by time-matched SH Process API render
- Chlorophyll plotted on log scale (`LogNorm(vmin=0.1, vmax=50)`) via cmocean.algae
- Combined map updated: GEBCO WMSLayer → `bathy_uri` ImageOverlay; `cur_uri` quiver removed (animated velocity map handles currents)
- `cmocean` and `folium` added to `environment.yml`; all 14 SCENARIO-MAP assertions PASS

**S01-06 Map layers notebook — Epic 01 complete**

- **S01-06 ✅** `06_map_layers.ipynb`: OSM + OpenSeaMap tiles; GEBCO WMS (`GEBCO_LATEST`, new URL); EMODnet WMS (`eusm_helcom_group`); GeoTIFF ImageOverlay pattern; data overlays: wind quiver, CMEMS Hs, Sentinel-2 (574 KB); CMEMS oceanographic overlays: SST L4 (6.1–12.5 °C), salinity (0–20.4 PSU), currents (0–0.33 m/s), chlorophyll log-scale (0.05–149 mg/m³), bottom O2 (0–474 mmol/m³); all 14 SCENARIO-MAP assertions PASS; combined map has 12 toggleable layers
- **FR-17 / FR-18 added**: GEBCO and EMODnet added as SHOULD-priority map layer requirements; PRD, spec, traceability updated
- **Epic 01 ✅ Complete** — all 6 Phase 1 notebook stories done

**S01-05 Sentinel-2 imagery notebook + spec-anchor reconciliation**

- **S01-05 ✅** `05_sentinel2_imagery.ipynb`: Sentinel Hub Process API works with CDSE OAuth2 token (no SH instance ID needed); OData used for discovery (STAC has no S2 collection); partial tile check added (spherical Shoelace, ≥50% coverage threshold, adapted from Sent2_GreenMac); PIL needed for JPEG quicklook; OData combined `$expand` rejected (two requests required)
- Reconciled all spec-anchor docs: stories s01-01 through s01-05 → Done; capability specs updated (Implementation Status, Deviations, Deferred); epic-01 story table → 5/6 Done; traceability matrix → all 20 verified scenarios recorded; ops/data-sources → findings from all notebooks

## 2026-05-01

**Bootstrap + Phase 1 notebooks (session 1)**

- Copied spec-anchor-py framework into BoatOps; populated all BMAD docs, capability specs, Epic-01 stories, environment.yml
- Created `boatops` conda environment (Python 3.11); registered Jupyter kernel
- **S01-01 ✅** `01_weather.ipynb`: Open-Meteo wind/temp/precip/cloud confirmed; MeteoAlarm Atom XML parsed; cloud cover query function ready for satellite annotation
- **S01-02 ✅** `02_waves.ipynb`: CMEMS `cmems_mod_bal_wav_anfc_PT1H-i` authenticated (credentials from .env); 1 nmi grid; nearest-wet-cell fallback implemented for Warnemünde coastal mask
- **S01-03 ✅** `03_solar.ipynb`: suncalc validated; all 5 scenarios pass; polar summer edge case handled; `solar_elevation_at_overpass()` ready for satellite annotation
- **S01-04 ✅** `04_satellite_overpasses.ipynb`: CDSE OData Sentinel-2/3 confirmed (100+ products); CelesTrak GP endpoint confirmed (old `satcat/tle.php` deprecated); skyfield TLE propagation for 6 platforms; 22 passes/7 days; 3 optimal windows identified for 2026-05-02

**Credentials configured in `.env`:**
- CDSE: <redacted> (Sentinel-2/3 catalog)
- CMEMS: <redacted> (see .env)
- Earthdata: <redacted> (Landsat — CMR not returning recent data; TLEs used instead)
