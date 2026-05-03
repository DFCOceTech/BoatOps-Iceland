# E2E Test Plan — BoatOps

> Last updated: 2026-05-03

## E2E Testing Policy (MANDATORY)

Every change derived from user instruction MUST be verified end-to-end before reporting done.

## E2E Categories by Artifact Type

### Category 1: Python Scripts / CLI Tools
- **Method**: Subprocess invocation of the actual entry point
- **Command**: `python scripts/<name>.py --args ...`
- **Pass criteria**: Exit code 0, output artifacts present, spot-check values

### Category 2: Jupyter Notebooks
- **Method**: `jupyter nbconvert --to notebook --execute <notebook>.ipynb --output <output>.ipynb`
- **Pass criteria**: Execution completes without error; key output values in expected range

### Category 3: React Frontend (Browser E2E)
- **Method**: Playwright 1.59 with Chromium, Firefox, WebKit
- **Command**: `cd frontend && npx playwright test`
- **Pass criteria**: All 42 tests pass across all 3 browsers
- **Mock strategy**: `/api/*` routes intercepted at browser level — no live backend needed
- **When**: Any change to frontend components, hooks, context, or API client

## How to Run

```bash
# Frontend E2E (no backend required — API calls are mocked)
cd frontend
npm run test:e2e               # headless, all browsers
npx playwright test --headed   # headed mode for visual debugging
npm run test:e2e:report        # open HTML report

# Backend unit tests
conda activate boatops
pytest tests/ -v --tb=short

# Type check
cd frontend && npm run build   # runs tsc -b
```

## Test Scenarios

| ID | Scenario | Category | Browsers | Status |
|----|----------|----------|----------|--------|
| E2E-001 | App loads: title "BoatOps", sidebar heading, MapLibre canvas | 3 | Chromium, Firefox, WebKit | ✅ PASS |
| E2E-002a | Go/No-Go verdict badge (CAUTION with mock data) | 3 | All | ✅ PASS |
| E2E-002b | Per-capability rows: wind 13.6 kt, Hs 0.31 m, solar 42.3° | 3 | All | ✅ PASS |
| E2E-002c | Settings modal: open, edit, Reset Defaults, Save | 3 | All | ✅ PASS |
| E2E-002d | Refresh button triggers weather refetch | 3 | All | ✅ PASS |
| E2E-003 | Weather panel: wind speed value + Recharts SVG | 3 | All | ✅ PASS |
| E2E-004 | Wave panel: Hs value + Go verdict (0.31 m ≤ 0.4 m threshold) | 3 | All | ✅ PASS |
| E2E-005 | Solar panel: elevation gauge SVG + times table | 3 | All | ✅ PASS |
| E2E-006 | Satellite panel: overpass table grouped by platform | 3 | All | ✅ PASS |
| E2E-007 | Layer panel: "Base Layers" heading + OpenSeaMap checkbox | 3 | All | ✅ PASS |
| E2E-008a | Error: weather 500 → error in panel, others unaffected (NFR-06) | 3 | All | ✅ PASS |
| E2E-008b | Error: weather failure → verdict stays AWAITING DATA | 3 | All | ✅ PASS |
| E2E-009 | Sidebar collapse/expand via dispatchEvent (bypasses WebGL pointer interception) | 3 | All | ✅ PASS |

**Total: 42 tests (14 scenarios × 3 browsers) — 42/42 PASS**

## Mock Data Summary

All `/api/*` routes are intercepted by `page.route()` before reaching the network:
- Weather: wind 13.6 kt, gusts 18.5 kt, cloud 35%, temp 12.5°C
- Waves: Hs 0.31 m, vmdr 245°
- Solar elevation: 42.3°, period "day"
- Solar times: sunrise 03:42Z, sunset 19:18Z (2026-05-03)
- Overpasses: Sentinel-2A (67.4° max, 10.2 min), Landsat-9 (41.8° max, 8.7 min)
- PNG overlays: 1×1 transparent PNG with valid X-Bbox/X-Timestamp/X-Colorscale headers

## Known Limitations / Deferred

- **Live backend**: Tests mock all API calls; actual CMEMS/CDSE/Open-Meteo responses
  not verified. Run `npm run dev` + `uvicorn` for full data validation.
- **Map overlay toggles**: Clicking a layer checkbox and verifying MapLibre source
  addition requires WebGL-aware assertions — not covered here.
- **Mobile/responsive**: Tested at 1280×720 desktop viewport only.
