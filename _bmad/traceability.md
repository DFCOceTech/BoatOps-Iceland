# Traceability Matrix — BoatOps

> Status: Living Document | Last updated: 2026-05-21 (Sentinel-1, time-varying overlays, station markers, click assessment, currents units)

## PRD → OpenSpec → Epic → Implementation Status

| PRD Req | OpenSpec Capability | Epic | Impl Status | Notes |
|---------|---------------------|------|-------------|-------|
| FR-01 | `map` | Epic 03 | Partial | Go/No-Go dashboard (S03-06) implements planning decision view; AOI draw tool + time picker deferred |
| FR-02 | `map` | Epic 01 | Partial | Notebook done |
| FR-03 | `map` | Epic 01 | Partial | Notebook done |
| FR-04 | `map` | Epic 01 | Partial | Notebook done (synthetic raster); real upload deferred to Phase 2/3 |
| FR-05 | `map` | Epic 01 | Done | GEBCO WMS + EMODnet WMS (REQ-MAP-007/008) ✅; EMODnet click-to-info popup (REQ-MAP-022) ✅; GBIF biological occurrence layers — Zostera marina + Fucus vesiculosus (REQ-MAP-023) ✅; isobath frontend layer `IsobathLayer.tsx` (REQ-MAP-018) ✅ |
| FR-17 | `map` | Epic 01 | Partial | GEBCO WMS confirmed; URL corrected to `wms.gebco.net/mapserv` |
| FR-18 | `map` | Epic 01 | Partial | EMODnet WMS confirmed; layer `eusm_helcom_group` (eusm2022 no longer exists) |
| FR-19 | `map` | Epic 01 | Partial | SST L4 overlay confirmed; DMI NRT product |
| FR-20 | `map` | Epic 01 | Partial | Salinity overlay confirmed; CMEMS Baltic Physics |
| FR-21 | `map` | Epic 01 | Partial | Surface current quiver overlay confirmed; CMEMS Baltic Physics |
| FR-22 | `map` | Epic 01 | Partial | Chlorophyll log-scale overlay confirmed; CMEMS Baltic BGC |
| FR-23 | `map` | Epic 01 | Partial | Bottom oxygen overlay confirmed; `o2b` pre-computed; hypoxia threshold visible |
| FR-06 | `weather` | Epic 01 | Partial | Notebook done; wind rendered as map overlay (s01-06); MeteoAlarm advisory polygons need DWD WFS |
| FR-07 | `weather` | Epic 01 | Partial | Notebook done |
| FR-08 | `weather` | Epic 01 | Partial | Notebook done |
| FR-09 | `weather` | Epic 01 | Partial | Notebook done; cloud cover reused by satellite capability |
| FR-10 | `weather` | Epic 01 | Partial | MeteoAlarm text-only; no polygon geometry in Atom feed |
| FR-11 | `solar` | Epic 03 | Done | `SolarPanel.tsx` — times table (all 3 twilight tiers, Berlin CET/CEST), elevation arc gauge, period badge, 60 s auto-refresh |
| FR-12 | `waves` | Epic 01 | Partial | Notebook done; Hs rendered as map overlay (s01-06); nearest-wet-cell fallback needed in Phase 2 |
| FR-13 | `waves` | Epic 01 | Partial | Notebook done |
| FR-14 | `satellite` | Epic 03 | Done | `SatellitePanel.tsx` — overpass table grouped by platform, AOS in Berlin time, satellite elev + duration; backend filters nighttime passes via solar elevation (REQ-SAT-010); ground track overlay (REQ-SAT-008); pass click sets planning time (REQ-SAT-009); Sentinel-3A/B added (REQ-SAT-002); **Sentinel-1A/C (SAR, day+night) added** (REQ-SAT-011) |
| FR-15 | `satellite` | Epic 03 | Done | S2 overlay toggle: MapLibre ImageSource, acquisition date + cloud cover badge; AbortController cancel on 10–30 s fetch |
| FR-19 | `map` | Epic 03 | Done | SST, salinity, chlorophyll, currents, waves overlays now respond to forecast-hour slider (REQ-MAP-024–028); raw xarray dataset cached per bbox; PNG rendered per (bbox, hour) |
| FR-01 | `map` | Epic 03 | Partial | Map-click Go/No-Go assessment (REQ-MAP-030) ✅ — `MapClickPanel.tsx` provides per-location assessment at planning hour; AOI draw tool still deferred |
| FR-05 | `map` | Epic 03 | Done | Station markers (REQ-MAP-029): MARNET Fehmarnbelt/Darßer Schwelle/Oder Bank + FINO2; toggleable; dark popup on click |
| FR-14 | `map` | Epic 03 | Done | Surface currents display unit changed to m/s (REQ-MAP-031); `MS_TO_KT` removed |
| FR-16 | `ai-synthesis` | Epic 02 | Not Started | Deferred — nice-to-have |

**Impl Status values**: Done | Partial | In Progress | Not Started | Deferred | Untested

## NFR Verification

| NFR | Verification Method | Status | Notes |
|-----|---------------------|--------|-------|
| NFR-01 | Multi-user load test | Untested | Phase 2 (FastAPI) |
| NFR-02 | N/A — always-on internet assumed | N/A | |
| NFR-03 | Security review of .env handling | Untested | Phase 2 |
| NFR-04 | Playwright 1.59 cross-browser E2E | Partial | 42/42 tests pass on Chromium, Firefox, WebKit (2026-05-03); new features (TimeSlider, GBIF layers, EMODnet popup, daytime filter, isobath frontend) not yet covered by E2E |
| NFR-05 | Check `last_updated` field in each layer response | Partial | Open-Meteo: generationtime_ms ✓; CMEMS: time.values[-1] fallback; CDSE: ContentDate ✓ |
| NFR-06 | Simulated API failure per data source | ✅ Verified | E2E-008a: weather 500 → panel error, other panels unaffected; E2E-008b: verdict stays AWAITING DATA |

## Epic Dependency Graph

```
Epic 01 (Phase 1 Notebooks) → Epic 02 (Phase 2 FastAPI) → Epic 03 (Phase 3 Frontend)
```

## Process Verification / Methodology Gates

| Gate | Owner | Verifies | Authority |
|------|-------|----------|-----------|
| Gate 1 | Dev Agent (Dana) | Self-check: criteria met, tests pass | — |
| Gate 2 | Evaluator Agent (Quinn) | Independent: code matches spec, E2E passes | — |
| Gate 3 | Scrum Master (Sam) | Reconciliation: all artifacts updated | — |
| Gate 4 | Adversarial Reviewer (Raze) | Post-completion audit | Can override Gate 2 |

## Recent Gate Runs

| Sprint-Task | Gate | Date | Verdict | Artifact |
|-------------|------|------|---------|----------|
| Epic 01 notebooks (s01-01 to s01-05) | Gate 1 | 2026-05-01/02 | PASS | nbconvert executions; all SCENARIO-* assertions green |
| Epic 01 notebook s01-06 | Gate 1 | 2026-05-02 | PASS | nbconvert execution; all SCENARIO-MAP-* assertions green |
| Epic 02 FastAPI backend (s02-01 to s02-06) | Gate 1 | 2026-05-03 | PASS | `pytest tests/` 60/60; all credentials mocked; PNG magic bytes verified |

## Verified Scenarios (E2E-bound)

| Scenario | Status | Evidence |
|----------|--------|----------|
| SCENARIO-WX-WIND-001 | PASS | `notebooks/01_weather.ipynb` nbconvert |
| SCENARIO-WX-WIND-002 | PASS | `notebooks/01_weather.ipynb` nbconvert |
| SCENARIO-WX-CLOUD-001 | PASS | `notebooks/01_weather.ipynb` nbconvert |
| SCENARIO-WX-ADV-001 | PASS | `notebooks/01_weather.ipynb` nbconvert |
| SCENARIO-WX-ADV-002 | PASS | `notebooks/01_weather.ipynb` nbconvert |
| SCENARIO-WX-FAIL-001 | PASS | `notebooks/01_weather.ipynb` nbconvert |
| SCENARIO-WAVE-HEIGHT-001 | PASS | `notebooks/02_waves.ipynb` nbconvert |
| SCENARIO-WAVE-DIR-001 | PASS | `notebooks/02_waves.ipynb` nbconvert |
| SCENARIO-WAVE-SNAPSHOT-001 | PASS | `notebooks/02_waves.ipynb` nbconvert |
| SCENARIO-WAVE-FAIL-001 | PASS | `notebooks/02_waves.ipynb` nbconvert |
| SCENARIO-SOL-BASIC-001 | PASS | `notebooks/03_solar.ipynb` nbconvert |
| SCENARIO-SOL-ELEVATION-001 | PASS | `notebooks/03_solar.ipynb` nbconvert |
| SCENARIO-SOL-ACCURACY-001 | PARTIAL | Placeholder USNO values — real lookup pending |
| SCENARIO-SOL-TIMELINE-001 | PASS | `notebooks/03_solar.ipynb` nbconvert |
| SCENARIO-SOL-NIGHT-001 | PASS | `notebooks/03_solar.ipynb` nbconvert |
| SCENARIO-SAT-S2-001 | PASS | `notebooks/04_satellite_overpasses.ipynb` nbconvert |
| SCENARIO-SAT-VIIRS-001 | PASS | `notebooks/04_satellite_overpasses.ipynb` nbconvert |
| SCENARIO-SAT-FAIL-001 | PASS | `notebooks/04_satellite_overpasses.ipynb` nbconvert |
| SCENARIO-SAT-IMG-001 | PASS | `notebooks/05_sentinel2_imagery.ipynb` nbconvert |
| SCENARIO-SAT-IMG-002 | PASS | `notebooks/05_sentinel2_imagery.ipynb` nbconvert |
| SCENARIO-MAP-OSM-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-SEAMAP-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-GEOTIFF-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-WMS-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-GEBCO-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-EMODNET-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-WIND-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-WAVE-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-S2-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-SST-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-SAL-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-CUR-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-CHL-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-O2B-OVERLAY-001 | PASS | `notebooks/06_map_layers.ipynb` nbconvert |
| SCENARIO-MAP-ISOBATH-001 | PASS | manual E2E 2026-05-11; `IsobathLayer.tsx` renders 3-depth vector lines |
| SCENARIO-MAP-EMODNET-POPUP-001 | PASS | manual E2E 2026-05-11; click popup shows regionald field |
| SCENARIO-MAP-GBIF-001 | PASS | manual E2E 2026-05-11; cyan circles for Zostera marina after 502 fix |
| SCENARIO-SAT-DAYTIME-001 | PASS | manual verification 2026-05-13; 12 daytime passes vs ~30 total for 7-day Baltic window |
| SCENARIO-SAT-S1-001 | PASS | manual E2E 2026-05-21; `get_overpasses((9.5,53.5,15.0,56.0), days=7)` returns 7 Sentinel-1 passes (1A + 1C) including nighttime passes, with track_coords |
| SCENARIO-MAP-STATION-001 | PASS | manual E2E 2026-05-21; 4 markers appear, dark popup shows station name and type, toggle removes all |
| SCENARIO-MAP-CLICK-ASSESS-001 | PASS | manual E2E 2026-05-21; crosshair mode fetches wave+weather, popup shows GO/CAUTION/NO-GO with colour-coded rows at active planning hour |
| SCENARIO-MAP-CURRENTS-UNIT-001 | PASS | code review 2026-05-21; legend reads "0 m/s … max m/s"; MS_TO_KT constant removed |
