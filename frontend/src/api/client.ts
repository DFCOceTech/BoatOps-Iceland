/** Typed API client for the BoatOps FastAPI backend.
 *
 * All JSON endpoints return typed response objects.
 * All PNG endpoints return a { blob, headers } result so callers can read
 * custom headers (X-Bbox, X-Timestamp, X-Colorscale) alongside the image data.
 */

const AOI = { west: 9.5, south: 53.5, east: 15.0, north: 56.0 }
const CENTER = { lat: 54.18, lon: 12.08 }

// ── shared types ─────────────────────────────────────────────────────────────

export interface BlobResult {
  blob: Blob
  bbox: [number, number, number, number]  // [west, south, east, north]
  timestamp: string
  colorscale: { vmin: number; vmax: number; cmap: string; scale?: string; hypoxia_threshold_mmol_m3?: number }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  return res.json() as Promise<T>
}

async function fetchPng(path: string): Promise<BlobResult> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  const blob = await res.blob()
  const bboxStr = res.headers.get('x-bbox') ?? '9.5,53.5,15.0,56.0'
  const bboxRaw = bboxStr.split(',').map(Number)
  if (bboxRaw.length !== 4 || bboxRaw.some(isNaN))
    throw new Error(`Malformed X-Bbox header: "${bboxStr}"`)
  const bbox = bboxRaw as [number, number, number, number]
  const timestamp = res.headers.get('x-timestamp') ?? ''
  let colorscale: BlobResult['colorscale'] = { vmin: 0, vmax: 1, cmap: '' }
  try { colorscale = JSON.parse(res.headers.get('x-colorscale') ?? '{}') }
  catch { /* malformed header — use safe default */ }
  return { blob, bbox, timestamp, colorscale }
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

export const getWeatherAdvisories = (country = 'DE') =>
  fetchJson<AdvisoryCollection>(`/api/weather/advisories?country=${country}`)

// ── /api/waves ───────────────────────────────────────────────────────────────

export interface WaveForecast {
  hs_m: number; vmdr_deg: number
  grid_lat: number; grid_lon: number
  timestamp: string; last_updated: string
}

export const getWaveForecast = (lat = CENTER.lat, lon = CENTER.lon) =>
  fetchJson<WaveForecast>(`/api/waves/forecast?lat=${lat}&lon=${lon}`)

export const getWaveOverlay = (bbox = AOI) =>
  fetchPng(`/api/waves/overlay?west=${bbox.west}&south=${bbox.south}&east=${bbox.east}&north=${bbox.north}`)

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
}

export const getSatelliteOverpasses = (bbox = AOI, days = 7) =>
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
}

async function fetchS2Png(path: string, signal?: AbortSignal): Promise<S2OverlayResult> {
  const res = await fetch(path, signal ? { signal } : undefined)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  const blob = await res.blob()
  const bboxStr = res.headers.get('x-bbox') ?? '9.5,53.5,15.0,56.0'
  const bboxRaw = bboxStr.split(',').map(Number)
  if (bboxRaw.length !== 4 || bboxRaw.some(isNaN))
    throw new Error(`Malformed X-Bbox header: "${bboxStr}"`)
  const bbox = bboxRaw as [number, number, number, number]
  const sceneId = res.headers.get('x-scene-id') ?? ''
  const acquisitionTime = res.headers.get('x-acquisition-time') ?? ''
  const cloudRaw = res.headers.get('x-cloud-cover')
  const cloudCoverPct = cloudRaw && cloudRaw !== '' ? parseFloat(cloudRaw) : null
  return { blob, bbox, sceneId, acquisitionTime, cloudCoverPct }
}

export const getS2Overlay = (bbox = AOI, cloudMax = 20, signal?: AbortSignal) =>
  fetchS2Png(
    `/api/satellite/s2-overlay?west=${bbox.west}&south=${bbox.south}&east=${bbox.east}&north=${bbox.north}&cloud_max=${cloudMax}`,
    signal
  )

// ── /api/map ─────────────────────────────────────────────────────────────────

const bboxQs = (bbox = AOI) =>
  `west=${bbox.west}&south=${bbox.south}&east=${bbox.east}&north=${bbox.north}`

export const getBathymetry  = (bbox = AOI) => fetchPng(`/api/map/bathymetry?${bboxQs(bbox)}`)
export const getSst         = (bbox = AOI) => fetchPng(`/api/map/sst?${bboxQs(bbox)}`)
export const getSalinity    = (bbox = AOI) => fetchPng(`/api/map/salinity?${bboxQs(bbox)}`)
export const getCurrents    = (bbox = AOI) => fetchPng(`/api/map/currents?${bboxQs(bbox)}`)
export const getChlorophyll = (bbox = AOI) => fetchPng(`/api/map/chlorophyll?${bboxQs(bbox)}`)
export const getOxygen      = (bbox = AOI) => fetchPng(`/api/map/oxygen?${bboxQs(bbox)}`)
