# Test Results — BoatOps Iceland

## 2026-10-25
| Suite | Result |
|-------|--------|
| `pytest tests` (conda `boatops-iceland`) | 61 passed |
| `npm run build` (tsc -b + vite) | OK |
| Playwright, chromium (mocked API) | 21 passed |
| Playwright, firefox/webkit | not run — browser launch failure on authoring machine |
| Live backend smoke (uvicorn :8765) | `/health`, weather, marine, solar, wind-grid, advisories(IS), overpasses → 200; s1-overlay without credentials → 503; oversized bbox → 422 |
| Docker compose build/run | **not run** (Docker not installed) |
| Live CDSE S1/S2 imagery | **not run** (no credentials) |
| `npm run lint` | react-refresh/compiler warnings in inherited contexts and panels (pre-existing pattern); not gating |
