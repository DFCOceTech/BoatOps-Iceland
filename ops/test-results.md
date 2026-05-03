# E2E Test Results — BoatOps

> Last run: 2026-05-03

## Verdict

- **Frontend E2E**: ✅ PASS — 42/42 tests across Chromium, Firefox, WebKit
- **Backend unit tests**: ✅ PASS — `pytest tests/` 60/60 (run 2026-05-03)
- **Type check**: ✅ PASS — `cd frontend && npm run build` (tsc -b + vite build, 0 errors)
- **Live API E2E**: NOT RUN — requires live CMEMS/CDSE/Open-Meteo credentials

## Environment

- **Platform**: macOS Darwin 25.3.0 (Apple Silicon)
- **Playwright**: 1.59.1 (Chromium, Firefox, WebKit browsers)
- **Node**: via system nvm / project devDependencies
- **Python**: conda `boatops` env, Python 3.11
- **Frontend command**: `cd frontend && npx playwright test`
- **Backend command**: `conda activate boatops && pytest tests/ -v`

## Frontend E2E Test Results (2026-05-03)

| ID | Scenario | Chromium | Firefox | WebKit |
|----|----------|----------|---------|--------|
| E2E-001 | App loads (title + canvas) | ✅ | ✅ | ✅ |
| E2E-002a | Go/No-Go verdict badge | ✅ | ✅ | ✅ |
| E2E-002b | Per-capability rows | ✅ | ✅ | ✅ |
| E2E-002c | Settings modal | ✅ | ✅ | ✅ |
| E2E-002d | Refresh refetch | ✅ | ✅ | ✅ |
| E2E-003 | Weather panel | ✅ | ✅ | ✅ |
| E2E-004 | Wave panel | ✅ | ✅ | ✅ |
| E2E-005 | Solar panel | ✅ | ✅ | ✅ |
| E2E-006 | Satellite panel | ✅ | ✅ | ✅ |
| E2E-007 | Layer panel | ✅ | ✅ | ✅ |
| E2E-008a | Error degrades gracefully | ✅ | ✅ | ✅ |
| E2E-008b | Verdict stays AWAITING DATA | ✅ | ✅ | ✅ |
| E2E-009 | Sidebar collapse/expand | ✅ | ✅ | ✅ |

**42/42 passed — 11.9s total**

## Issues Found During Testing (Bugs Fixed)

1. **Page title "frontend"**: `index.html` had `<title>frontend</title>`. Fixed to "BoatOps".
2. **Sidebar collapse button clipped**: Toggle button used `position:absolute` inside a `position:relative; overflow:hidden` containing block. When sidebar collapsed to `width:0`, button was clipped by overflow:hidden. Fixed: button changed to `position:fixed` (viewport-anchored, always visible).

## Backend Unit Tests (2026-05-03)

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| `tests/test_weather.py` | 10 | 10 | 0 |
| `tests/test_waves.py` | 10 | 10 | 0 |
| `tests/test_solar.py` | 10 | 10 | 0 |
| `tests/test_satellite.py` | 20 | 20 | 0 |
| `tests/test_map.py` | 10 | 10 | 0 |
| **Total** | **60** | **60** | **0** |
