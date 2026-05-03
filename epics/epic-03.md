# Epic 03: Phase 3 — React + MapLibre GL JS Frontend

> Status: In Progress | Last updated: 2026-05-03

## Goal

Build the browser-based Go/No-Go planning dashboard that consumes the Phase 2 FastAPI
endpoints. Stack: **Vite + React 18 + TypeScript + MapLibre GL JS**. The UI has a
full-screen map on the left and a collapsible sidebar on the right for data panels.
All data fetching is done client-side against the FastAPI backend at
`/api/*` (same origin in production; proxied via Vite in development).

## Dependencies

- Depends on: Epic 02 (FastAPI backend — all endpoints live)
- Blocks: Production deployment

## Stories

| ID | Story | Status | PRD Refs |
|----|-------|--------|----------|
| S03-01 | Project scaffold — Vite + React + TS + MapLibre, API client, layout shell | ✅ Done | — |
| S03-02 | Base map — OSM tiles, OpenSeaMap overlay, layer toggle panel, coordinate display | ✅ Done | FR-01, FR-02, FR-03 |
| S03-03 | Oceanographic overlays — all `/api/map/*` PNG layers with legend and timestamp | Backlog | FR-17–FR-23 |
| S03-04 | Weather + waves panels — forecast charts, wind/wave overlays | Backlog | FR-06–FR-09, FR-12, FR-13 |
| S03-05 | Solar + satellite panels — solar times, overpass timeline, S2 overlay | Backlog | FR-11, FR-14, FR-15 |
| S03-06 | Go/No-Go dashboard — per-capability status, overall recommendation | Backlog | FR-01 (partial) |

## Acceptance Criteria

- [ ] `npm run dev` starts cleanly; map loads in browser at localhost:5173
- [ ] All layer toggles work without page reload
- [ ] Each active layer displays a last-updated timestamp (NFR-05)
- [ ] Layer errors show error state without blocking other layers (NFR-06)
- [ ] No API credentials exposed in browser DevTools network tab (NFR-03)
- [ ] Renders correctly in Chrome, Firefox, and Safari (NFR-04)
- [ ] Go/No-Go recommendation updates when forecast data changes

## Tech Stack Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Build tool | Vite 6 | Fast HMR; native ESM; MapLibre GL JS compatible |
| Map library | MapLibre GL JS 4 | Open-source Mapbox fork; vector + raster; specified in architecture.md |
| Charts | Recharts | Lightweight; React-native; no D3 complexity |
| Styling | CSS Modules + CSS custom properties | Zero runtime; no Tailwind build complexity |
| API client | Native fetch + custom wrapper | No extra dependency; typed with TypeScript |
| State | React `useState`/`useEffect` + Context | Scope is small; Redux overkill for Phase 3 |
