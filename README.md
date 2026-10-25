# BoatOps Iceland — Jökulsárlón

Field-planning web app for **drone and blue-boat (USV) measurements at Jökulsárlón glacier lagoon**. It is a fork of [BoatOps](https://github.com/DFCOceTech/BoatOps) (Baltic Sea), stripped of Baltic-only ocean models and rebuilt around one idea: **the ice moves, so the work site moves.** Set the site each morning and every panel follows it.

## What it shows

| Panel | Source | Notes |
|-------|--------|-------|
| **Work Site** | — | Type coordinates, pick on map, use map centre, or drag the cyan marker. Save/export sites. The site is in the URL (`#site=lat,lon`) — share it with colleagues. |
| Go/No-Go | derived | Wind, gusts, cloud, sun elevation; thresholds editable (⚙). |
| Wind | Open-Meteo | 7-day forecast chart + animated wind field; scrub the forecast hour with the time slider. |
| Local conditions | Icelandic Met Office + Road Administration (umferdin.is) | Live 10-min temperature, wind/gust, pressure, humidity from the 8 nearest automatic stations to the work site, with distance/bearing and a STALE flag after 60 min (auto-refreshes every 5 min), plus an amber map marker per station (click for the reading; zoom out to see stations 15+ km away). Land stations (nearest ~15 km), not the lagoon. |
| Tide & sea state | Open-Meteo Marine | Next high/low tides at the outlet, offshore Hs and SST. A **coastal reference** (~8 km grid): good for tidal phase/range in the outlet channel, **not** a model of the lagoon. |
| Solar | suncalc | Sunrise/sunset, twilight, elevation. |
| Imagery | CDSE | **Sentinel-1 SAR** (IW VV+VH or EW HH+HV, whichever is newest and covers the site; day/night, through cloud — best for finding ice) and **Sentinel-2** true colour, for the site area with selectable look-back. Scene time is shown: ice moves, always check the timestamp. |
| **Your GeoTIFFs** | local files | Drop drone orthomosaics or sonar/depth rasters onto *Imagery — your GeoTIFFs*. Read in the browser (nothing uploaded). RGB shows as-is; single-band rasters get a colour ramp with editable range. Needs overviews for big mosaics (`gdaladdo -r average file.tif 2 4 8 16 32` or COG). |
| Satellite passes | CelesTrak | Sentinel-1/2, Landsat 8/9 and **SWOT** overpasses over the site; ground tracks. Tick **Save** on a pass to keep the queries needed to find/download its product afterwards (Planned acquisitions → JSON/CSV). |
| Base layers | Esri, OpenSeaMap, GEBCO | Optional; GEBCO is coarse and not valid inside the lagoon. |

Weather alerts use Meteoalarm Iceland. Not included (and not meaningful at this scale): CMEMS currents/waves/SST/salinity, EMODnet, GBIF.

## Install (Docker — recommended for colleagues)

```bash
git clone <this repo> && cd BoatOps-Iceland
cp .env.example .env        # add CDSE_EMAIL / CDSE_PASSWORD (free: dataspace.copernicus.eu)
docker compose up -d --build
# open http://localhost
```

No Node.js or conda needed on the host — the frontend is built inside the image. Without CDSE credentials everything works except the Sentinel imagery layers.

## Install (development)

```bash
conda env create -f environment.yml && conda activate boatops-iceland
pip install -e src
cp .env.example .env
uvicorn boatops.main:app --reload --port 8000         # backend
cd frontend && npm ci && npm run dev                  # http://localhost:5173
# If port 8000 is taken: BOATOPS_API=http://localhost:8001 npm run dev
```

## Tests

```bash
pytest tests -v                        # backend (mocked upstreams)
cd frontend && npm run build && npx playwright test --project=chromium
```

## Field notes

- Times are UTC (Iceland has no DST).
- Preset coordinates are approximate — verify with GNSS.
- Open-Meteo wind is ~10 km: expect local katabatic/glacier winds and lagoon shelter to differ. Treat as guidance, not a substitute for on-site anemometry.
- Sentinel-1 colours: R=VV, G=VH (dB). Calm open water is dark; ice and wind-roughened water are bright. Dark could also be new ice/brash — confirm visually.

## Provenance

Forked from BoatOps (`fix/docker-build-frontend-shapely`). `_bmad/`, `epics/` and most of `openspec/` are inherited Baltic documents kept for history; the Iceland spec is `openspec/capabilities/iceland-site/spec.md`.
