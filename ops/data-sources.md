# Data Sources — BoatOps Iceland

> Last updated: 2026-10-25. CMEMS (Baltic) sources of the parent project were removed.

| Source | URL | Auth | Used for |
|--------|-----|------|----------|
| Open-Meteo forecast | `https://api.open-meteo.com/v1/forecast` | none (non-commercial) | wind/gust/temp/cloud, wind grid |
| Open-Meteo Marine | `https://marine-api.open-meteo.com/v1/marine` | none (non-commercial) | `sea_level_height_msl` (tide+surge), `wave_height`, SST — ~8 km offshore grid |
| Meteoalarm | `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-iceland` | none | Icelandic warnings |
| CelesTrak GP | `https://celestrak.org/NORAD/elements/gp.php` | none | TLEs → overpass prediction (swath-aware) |
| CDSE OData + Sentinel Hub Process API | `catalogue.dataspace.copernicus.eu`, `sh.dataspace.copernicus.eu` | CDSE email/password (`.env`) | Sentinel-1 GRD (`sentinel-1-grd`) and Sentinel-2 L2A imagery |
| OpenFreeMap vector tiles | `tiles.openfreemap.org` | none | dark basemap |
| Esri World Imagery, OpenSeaMap, GEBCO WMS | various | none | optional base layers (not current; GEBCO coarse) |
| `de421.bsp` (skyfield ephemeris) | auto-downloaded to CWD | none | solar position in overpass daytime filter |

Credentials live only in `.env` (gitignored). See `.env.example`.
