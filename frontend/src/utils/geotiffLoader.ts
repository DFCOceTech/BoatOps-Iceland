import { fromBlob } from 'geotiff'
import type { GeoTIFFImage, TypedArray } from 'geotiff'
import proj4 from 'proj4'

/** Longest preview side. Drone orthomosaics are read from an internal overview, never at full resolution. */
export const MAX_PREVIEW_PX = 4096
/** Refuse to decode a full-resolution image bigger than this (no overviews to fall back on). */
const MAX_FULLRES_PIXELS = 40_000_000

export type Ramp = 'viridis' | 'grey'

export interface RasterData {
  bands: TypedArray[]          // 1 band (scalar) or ≥3 (RGB[A])
  width: number
  height: number
  nodata: number | null
}

export interface LoadedRaster {
  id: string
  name: string
  kind: 'rgb' | 'scalar'
  /** MapLibre image-source corners: TL, TR, BR, BL as [lng, lat]. */
  coordinates: [[number, number], [number, number], [number, number], [number, number]]
  /** [west, south, east, north] in WGS84. */
  bounds: [number, number, number, number]
  crs: string
  fullSize: [number, number]
  previewSize: [number, number]
  data: RasterData
  /** Scalar only: suggested (2–98 %) display range. */
  stats: { min: number; max: number } | null
}

// ── CRS ───────────────────────────────────────────────────────────────────────

const ISN_LAMBERT = '+proj=lcc +lat_0=65 +lon_0=-19 +lat_1=64.25 +lat_2=65.75 +ellps=GRS80 +units=m +no_defs'

/** proj4 definition for an EPSG code, or null if we don't carry it (we stay offline — no EPSG database). */
export function epsgToProj4(code: number): string | null {
  if (code === 4326 || code === 4258) return '+proj=longlat +datum=WGS84 +no_defs'
  if (code === 3857) return '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs'
  if (code >= 32601 && code <= 32660) return `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs`
  if (code >= 32701 && code <= 32760) return `+proj=utm +zone=${code - 32700} +south +datum=WGS84 +units=m +no_defs`
  if (code >= 25828 && code <= 25837) return `+proj=utm +zone=${code - 25800} +ellps=GRS80 +units=m +no_defs`   // ETRS89 / UTM
  if (code === 3057) return `${ISN_LAMBERT} +x_0=500000 +y_0=500000`      // ISN93 / Lambert 1993
  if (code === 8088) return `${ISN_LAMBERT} +x_0=2700000 +y_0=300000`     // ISN2016 / Lambert 2016
  return null
}

function readEpsg(img: GeoTIFFImage): number {
  const k = img.getGeoKeys() ?? {}
  const projected = Number(k.ProjectedCSTypeGeoKey)
  if (Number.isFinite(projected) && projected > 0 && projected !== 32767) return projected
  const geographic = Number(k.GeographicTypeGeoKey)
  if (Number.isFinite(geographic) && geographic > 0 && geographic !== 32767) return geographic
  throw new Error('No EPSG code in the GeoTIFF (user-defined CRS). Reproject to EPSG:4326, a UTM zone (e.g. 32628) or ISN2016 (8088) with gdalwarp.')
}

// ── Stats / colour ────────────────────────────────────────────────────────────

const VIRIDIS: [number, number, number][] = [
  [68, 1, 84], [72, 36, 117], [65, 68, 135], [53, 95, 141], [42, 120, 142], [33, 145, 140],
  [34, 168, 132], [68, 191, 112], [122, 209, 81], [189, 223, 38], [253, 231, 37],
]

export function rampColor(t: number, ramp: Ramp): [number, number, number] {
  const x = Math.min(1, Math.max(0, t))
  if (ramp === 'grey') { const g = Math.round(x * 255); return [g, g, g] }
  const f = x * (VIRIDIS.length - 1), i = Math.min(VIRIDIS.length - 2, Math.floor(f)), u = f - i
  const a = VIRIDIS[i], b = VIRIDIS[i + 1]
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u].map(Math.round) as [number, number, number]
}

const isValid = (v: number, nodata: number | null) =>
  Number.isFinite(v) && (nodata === null || v !== nodata) && !(Number.isNaN(nodata) && Number.isNaN(v))

/** [lo, hi] percentile over valid samples (strided sample for speed). */
export function percentileRange(a: ArrayLike<number>, nodata: number | null, lo = 0.02, hi = 0.98): { min: number; max: number } | null {
  const step = Math.max(1, Math.floor(a.length / 200_000))
  const vals: number[] = []
  for (let i = 0; i < a.length; i += step) if (isValid(a[i], nodata)) vals.push(a[i])
  if (vals.length === 0) return null
  vals.sort((x, y) => x - y)
  const min = vals[Math.floor((vals.length - 1) * lo)], max = vals[Math.floor((vals.length - 1) * hi)]
  return { min, max: max > min ? max : min + 1e-9 }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

export interface RenderOptions { min?: number; max?: number; ramp?: Ramp }

/** Paint raster data to an RGBA pixel buffer. Pure: no DOM. */
export function toRgba(data: RasterData, kind: 'rgb' | 'scalar', opts: RenderOptions & { rgbRange?: { min: number; max: number } }): Uint8ClampedArray {
  const { width, height, bands, nodata } = data
  const out = new Uint8ClampedArray(width * height * 4)
  if (kind === 'scalar') {
    const b = bands[0]
    const min = opts.min ?? 0, max = opts.max ?? 1, span = max - min || 1
    for (let i = 0; i < b.length; i++) {
      const v = b[i], o = i * 4
      if (!isValid(v, nodata)) continue                  // stays transparent
      const [r, g, bl] = rampColor((v - min) / span, opts.ramp ?? 'viridis')
      out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255
    }
    return out
  }
  const [R, G, B] = bands, A = bands[3]
  const is8 = R instanceof Uint8Array || R instanceof Uint8ClampedArray
  const lo = opts.rgbRange?.min ?? 0, span = (opts.rgbRange?.max ?? 255) - lo || 1
  const alphaIs8 = A instanceof Uint8Array
  for (let i = 0; i < R.length; i++) {
    const o = i * 4
    const r = R[i], g = G[i], b = B[i]
    if (nodata !== null && r === nodata && g === nodata && b === nodata) continue
    if (!(Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b))) continue
    out[o] = is8 ? r : ((r - lo) / span) * 255
    out[o + 1] = is8 ? g : ((g - lo) / span) * 255
    out[o + 2] = is8 ? b : ((b - lo) / span) * 255
    out[o + 3] = A ? (alphaIs8 ? A[i] : (A[i] > 0 ? 255 : 0)) : 255
  }
  return out
}

export async function renderToBlob(r: LoadedRaster, opts: RenderOptions): Promise<Blob> {
  const rgbRange = r.kind === 'rgb' && !(r.data.bands[0] instanceof Uint8Array)
    ? percentileRange(r.data.bands[0], r.data.nodata) ?? undefined : undefined
  const px = toRgba(r.data, r.kind, { ...opts, rgbRange })
  const canvas = document.createElement('canvas')
  canvas.width = r.data.width; canvas.height = r.data.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, r.data.width, r.data.height), 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode preview'))), 'image/png'))
}

// ── Loading ───────────────────────────────────────────────────────────────────

/** Pick the image to read pixels from: the largest overview whose longest side ≤ MAX_PREVIEW_PX. */
export function pickImageIndex(sizes: [number, number][]): number {
  let best = -1
  sizes.forEach(([w, h], i) => {
    if (Math.max(w, h) <= MAX_PREVIEW_PX && (best < 0 || w * h > sizes[best][0] * sizes[best][1])) best = i
  })
  if (best >= 0) return best
  // nothing small enough: smallest available (overview) — or the base image if it is the only one
  return sizes.reduce((m, s, i) => (s[0] * s[1] < sizes[m][0] * sizes[m][1] ? i : m), 0)
}

export async function loadGeoTiff(file: File): Promise<LoadedRaster> {
  const tiff = await fromBlob(file)
  const count = await tiff.getImageCount()
  const base = await tiff.getImage(0)

  const fd = base.getFileDirectory() as unknown as { ModelTransformation?: number[] }
  const mt = fd.ModelTransformation
  if (mt && (mt[1] !== 0 || mt[4] !== 0)) throw new Error('Rotated/skewed GeoTIFF (ModelTransformation) is not supported — resample north-up with gdalwarp.')

  const epsg = readEpsg(base)
  const def = epsgToProj4(epsg)
  if (!def) throw new Error(`EPSG:${epsg} is not built in. Reproject to EPSG:4326, a UTM zone (326xx/327xx/258xx) or ISN93/ISN2016 (3057/8088) with gdalwarp.`)

  let bbox: number[]
  try { bbox = base.getBoundingBox() } catch { throw new Error('GeoTIFF has no georeferencing (no tiepoints/pixel scale).') }
  const [minX, minY, maxX, maxY] = bbox
  const toLL = (x: number, y: number) => proj4(def, 'EPSG:4326', [x, y]) as [number, number]
  const corners = [toLL(minX, maxY), toLL(maxX, maxY), toLL(maxX, minY), toLL(minX, minY)] as LoadedRaster['coordinates']
  if (!corners.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180))
    throw new Error('Georeferencing produced coordinates outside the valid lon/lat range — wrong CRS?')

  const images: GeoTIFFImage[] = []
  for (let i = 0; i < count; i++) images.push(await tiff.getImage(i))
  const idx = pickImageIndex(images.map(im => [im.getWidth(), im.getHeight()] as [number, number]))
  const img = images[idx]
  const w = img.getWidth(), h = img.getHeight()
  if (idx === 0 && w * h > MAX_FULLRES_PIXELS)
    throw new Error(`Image is ${w}×${h} px with no overviews — too big to preview. Add overviews: gdaladdo -r average file.tif 2 4 8 16 32 (or save as COG).`)

  const nSamples = img.getSamplesPerPixel()
  const kind: LoadedRaster['kind'] = nSamples >= 3 ? 'rgb' : 'scalar'
  const samples = kind === 'rgb' ? (nSamples >= 4 ? [0, 1, 2, 3] : [0, 1, 2]) : [0]
  let bands: TypedArray[]
  try {
    const r = await img.readRasters({ samples, interleave: false }) as TypedArray[]
    bands = Array.isArray(r) ? r : [r as unknown as TypedArray]
  } catch (e) {
    throw new Error(`Could not decode pixels (${e instanceof Error ? e.message : e}). Compression may be unsupported — re-save with DEFLATE or LZW.`)
  }
  const nodata = img.getGDALNoData() ?? base.getGDALNoData()
  const data: RasterData = { bands, width: w, height: h, nodata }
  const stats = kind === 'scalar' ? percentileRange(bands[0], nodata) : null
  if (kind === 'scalar' && !stats) throw new Error('Raster contains no valid (non-nodata) pixels.')

  const lngs = corners.map(c => c[0]), lats = corners.map(c => c[1])
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name, kind, coordinates: corners,
    bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    crs: `EPSG:${epsg}`,
    fullSize: [base.getWidth(), base.getHeight()], previewSize: [w, h],
    data, stats,
  }
}
