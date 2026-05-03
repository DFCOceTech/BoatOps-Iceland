# Traceability Matrix — BoatOps

> Status: Living Document | Last updated: 2026-05-03 (S03-06 Go/No-Go dashboard complete; Epic 03 complete)

## PRD → OpenSpec → Epic → Implementation Status

| PRD Req | OpenSpec Capability | Epic | Impl Status | Notes |
|---------|---------------------|------|-------------|-------|
| FR-01 | `map` | Epic 03 | Partial | Go/No-Go dashboard (S03-06) implements planning decision view; AOI draw tool + time picker deferred |
| FR-02 | `map` | Epic 01 | Partial | Notebook done |
| FR-03 | `map` | Epic 01 | Partial | Notebook done |
| FR-04 | `map` | Epic 01 | Partial | Notebook done (synthetic raster); real upload deferred to Phase 2/3 |
| FR-05 | `map` | Epic 01 | Partial | Notebook done (GEBCO, EMODnet validated as WMS layers) |
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
| FR-14 | `satellite` | Epic 03 | Done | `SatellitePanel.tsx` — overpass table grouped by platform, AOS in Berlin time, satellite elev + duration; daytime pass highlight |
| FR-15 | `satellite` | Epic 03 | Done | S2 overlay toggle: MapLibre ImageSource, acquisition date + cloud cover badge; AbortController cancel on 10–30 s fetch |
| FR-16 | `ai-synthesis` | Epic 02 | Not Started | Deferred — nice-to-have |

**Impl Status values**: Done | Partial | In Progress | Not Started | Deferred | Untested

## NFR Verification

| NFR | Verification Method | Status | Notes |
|-----|---------------------|--------|-------|
| NFR-01 | Multi-user load test | Untested | Phase 2 (FastAPI) |
| NFR-02 | N/A — always-on internet assumed | N/A | |
| NFR-03 | Security review of .env handling | Untested | Phase 2 |
| NFR-04 | Playwright 1.59 cross-browser E2E | ✅ Verified | 42/42 tests pass on Chromium, Firefox, WebKit (2026-05-03); `frontend/tests/smoke.spec.ts` |
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
