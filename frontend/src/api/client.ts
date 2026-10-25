/** Typed API client for the BoatOps FastAPI backend.
 *
 * All JSON endpoints return typed response objects.
 * All PNG endpoints return a { blob, headers } result so callers can read
 * custom headers (X-Bbox, X-Timestamp, X-Colorscale) alongside the image data.
 */

// Regional wind-field extent (SE Iceland); site imagery bboxes come from SiteContext.
export const AOI = { west: -17.2, south: 63.6, east: -15.2, north: 64.5 }
export interface Bbox { west: number; south: number; east: number; north: number }
// Jökulsárlón lagoon (approx.) — default site
const CENTER = { lat: 64.048, lon: -16.179 }

// ── shared types ─────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  return res.json() as Promise<T>
}

// ── /health ──────────────────────────────────────────────────────────────────

export interface HealthResponse { status: string; version: string }
export const getHealth = () => fetchJson<HealthResponse>('/health')

// ── /api/weather ─────────────────────────────────────────────────────────────

export interface WeatherForecast {
  times: string[]
  wind_speed_ms: number[]
  wind_speed_kt: number[]
  wind_dir_deg: number[]
  gust_speed_ms: number[]
  gust_speed_kt: number[]
  temperature_c: number[]
  precipitation_mm: number[]
  cloud_cover_pct: number[]
  last_updated: string | null
}

export interface AdvisoryFeature {
  type: 'Feature'
  geometry: null
  properties: {
    title: string; event: string; severity: string
    urgency: string; onset: string | null; expires: string | null
    area_description: string
  }
}

export interface AdvisoryCollection {
  type: 'FeatureCollection'
  features: AdvisoryFeature[]
  last_updated: string
}

export const getWeatherForecast = (lat = CENTER.lat, lon = CENTER.lon) =>
  fetchJson<WeatherForecast>(`/api/weather/forecast?lat=${lat}&lon=${lon}`)

export const getWeatherAdvisories = (country = 'IS') =>
  fetchJson<AdvisoryCollection>(`/api/weather/advisories?country=${country}`)

// u[row][col]: row 0 = southernmost lat, col 0 = westernmost lon
// U = eastward m/s, V = northward m/s
// vmax_speed = sqrt(max(u²+v²)) — autoscale reference for the particle color ramp
export interface WindGrid {
  u: number[][]
  v: number[][]
  width: number
  height: number
  bbox: [number, number, number, number]   // [west, south, east, north]
  timestamp: string
  vmax_speed: number
}

export const getWindGrid = (bbox = AOI, hour?: number) =>
  fetchJson<WindGrid>(
    `/api/weather/wind-grid?west=${bbox.west}&south=${bbox.south}&east=${bbox.east}&north=${bbox.north}&step=0.1` +
    (hour !== undefined ? `&hour=${hour}` : '')
  )

// ── /api/solar ───────────────────────────────────────────────────────────────

export interface SolarTimes {
  date: string; lat: number; lon: number
  sunrise: string | null; sunset: string | null; solar_noon: string | null
  dawn_civil: string | null; dusk_civil: string | null
  dawn_nautical: string | null; dusk_nautical: string | null
  dawn_astronomical: string | null; dusk_astronomical: string | null
}

export interface SolarElevation {
  elevation_deg: number; azimuth_deg: number
  is_daylight: boolean; period: string; timestamp: string
}

export const getSolarTimes = (lat = CENTER.lat, lon = CENTER.lon, date?: string) => {
  const dateParam = date ? `&date=${date}` : ''
  return fetchJson<SolarTimes>(`/api/solar/times?lat=${lat}&lon=${lon}${dateParam}`)
}

export const getSolarElevation = (lat = CENTER.lat, lon = CENTER.lon) =>
  fetchJson<SolarElevation>(`/api/solar/elevation?lat=${lat}&lon=${lon}`)

// ── /api/satellite ───────────────────────────────────────────────────────────

export interface Overpass {
  platform: string; aos_utc: string; los_utc: string
  max_elevation_deg: number; duration_min: number
  track_coords: [number, number][]  // [[lon, lat], ...] ground track polyline
}

export const getSatelliteOverpasses = (bbox: Bbox = AOI, days = 7) =>
  fetchJson<Overpass[]>(
    `/api/satellite/overpasses?west=${bbox.west}&south=${bbox.south}&east=${bbox.east}&north=${bbox.north}&days=${days}`
  )

// S2 overlay returns satellite-specific headers (not X-Timestamp / X-Colorscale).
export interface S2OverlayResult {
  blob: Blob
  bbox: [number, number, number, number]
  sceneId: string
  acquisitionTime: string
  cloudCoverPct: number | null
  coveragePct: number | null   // % of the requested area the scene actually covers (S2)
}

async function fetchS2Png(path: string, signal?: AbortSignal): Promise<S2OverlayResult> {
  const res = await fetch(path, signal ? { signal } : undefined)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  const blob = await res.blob()
  const bboxStr = res.headers.get('x-bbox') ?? '-17.2,63.6,-15.2,64.5'
  const bboxRaw = bboxStr.split(',').map(Number)
  if (bboxRaw.length !== 4 || bboxRaw.some(isNaN))
    throw new Error(`Malformed X-Bbox header: "${bboxStr}"`)
  const bbox = bboxRaw as [number, number, number, number]
  const sceneId = res.headers.get('x-scene-id') ?? ''
  const acquisitionTime = res.headers.get('x-acquisition-time') ?? ''
  const cloudRaw = res.headers.get('x-cloud-cover')
  const cloudCoverPct = cloudRaw && cloudRaw !== '' ? parseFloat(cloudRaw) : null
  const covRaw = res.headers.get('x-coverage')
  const coveragePct = covRaw && covRaw !== '' ? parseFloat(covRaw) : null
  return { blob, bbox, sceneId, acquisitionTime, cloudCoverPct, coveragePct }
}

export const getS2Overlay = (bbox: Bbox, cloudMax = 20, daysBack = 30, signal?: AbortSignal) =>
  fetchS2Png(
    `/api/satellite/s2-overlay?west=${bbox.west}&south=${bbox.south}&east=${bbox.east}&north=${bbox.north}` +
    `&cloud_max=${cloudMax}&days_back=${daysBack}`,
    signal
  )

/** Sentinel-1 SAR (radar) — sees ice through cloud and polar night. */
export const getS1Overlay = (bbox: Bbox, daysBack = 7, signal?: AbortSignal) =>
  fetchS2Png(
    `/api/satellite/s1-overlay?west=${bbox.west}&south=${bbox.south}&east=${bbox.east}&north=${bbox.north}` +
    `&days_back=${daysBack}`,
    signal
  )

// ── /api/marine ──────────────────────────────────────────────────────────────

export interface MarineForecast {
  times: string[]
  sea_level_m: (number | null)[]
  wave_height_m: (number | null)[]
  sst_c: (number | null)[]
  grid_lat: number | null
  grid_lon: number | null
}

export const getMarineForecast = (lat = CENTER.lat, lon = CENTER.lon) =>
  fetchJson<MarineForecast>(`/api/marine/forecast?lat=${lat}&lon=${lon}`)

