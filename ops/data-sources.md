# Data Sources — BoatOps Iceland

> Last updated: 2026-10-25. CMEMS (Baltic) sources of the parent project were removed.

| Source | URL | Auth | Used for |
|--------|-----|------|----------|
| Open-Meteo forecast | `https://api.open-meteo.com/v1/forecast` | none (non-commercial) | wind/gust/temp/cloud, wind grid |
| Open-Meteo Marine | `https://marine-api.open-meteo.com/v1/marine` | none (non-commercial) | `sea_level_height_msl` (tide+surge), `wave_height`, SST — ~8 km offshore grid |
| Icelandic Met Office open API | `https://api.vedur.is/weather/stations`, `/weather/observations/aws/10min/latest` | none (User-Agent set) | latest 10-min obs (t, wind f/fg/d, p, rh, r) for ~290 stations; **includes Vegagerðin/umferdin.is stations**, so no separate Vegagerðin call. Nearest to the lagoon: Kvísker (15 km, IMO station has no wind sensor; Vegagerðin Kvísker 35315 does), Borgarhöfn, Fagurhólsmýri, Öræfi, Ingólfshöfði, Skaftafell |
| Meteoalarm | `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-iceland` | none | Icelandic warnings |
| CelesTrak GP | `https://celestrak.org/NORAD/elements/gp.php` | none | TLEs → overpass prediction (swath-aware) |
| CDSE OData + Sentinel Hub Process API | `catalogue.dataspace.copernicus.eu`, `sh.dataspace.copernicus.eu` | CDSE email/password (`.env`) | Sentinel-1 GRD (`sentinel-1-grd`) and Sentinel-2 L2A imagery |
| OpenFreeMap vector tiles | `tiles.openfreemap.org` | none | dark basemap |
| Esri World Imagery, OpenSeaMap, GEBCO WMS | various | none | optional base layers (not current; GEBCO coarse) |
| `de421.bsp` (skyfield ephemeris) | auto-downloaded to CWD | none | solar position in overpass daytime filter |

Credentials live only in `.env` (gitignored). See `.env.example`.
