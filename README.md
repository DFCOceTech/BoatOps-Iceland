# BoatOps Iceland — Jökulsárlón

Field-planning web app for **drone and blue-boat (USV) measurements at Jökulsárlón glacier lagoon**. It is a fork of [BoatOps](https://github.com/DFCOceTech/BoatOps) (Baltic Sea), stripped of Baltic-only ocean models and rebuilt around one idea: **the ice moves, so the work site moves.** Set the site each morning and every panel follows it.

## What it shows

| Panel | Source | Notes |
|-------|--------|-------|
| **Work Site** | — | Type coordinates, pick on map, use map centre, or drag the cyan marker. Save/export sites. The site is in the URL (`#site=lat,lon`) — share it with colleagues. |
| Go/No-Go | derived | Wind, gusts, cloud, sun elevation; thresholds editable (⚙). |
| Wind | Open-Meteo | 7-day forecast chart + animated wind field; scrub the forecast hour with the time slider. |
| Tide & sea state | Open-Meteo Marine | Next high/low tides at the outlet, offshore Hs and SST. A **coastal reference** (~8 km grid): good for tidal phase/range in the outlet channel, **not** a model of the lagoon. |
| Solar | suncalc | Sunrise/sunset, twilight, elevation. |
| Imagery | CDSE | **Sentinel-1 SAR** (day/night, through cloud — best for finding ice) and **Sentinel-2** true colour, for the site area with selectable look-back. Scene time is shown: ice moves, always check the timestamp. |
| Satellite passes | CelesTrak | Sentinel-1/2/3, Landsat, VIIRS overpasses over the site; ground tracks. |
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
