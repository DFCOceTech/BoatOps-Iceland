import { useState, useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { useFetch } from '../hooks/useFetch'
import { getSatelliteOverpasses, getS2Overlay, getSolarTimes } from '../api/client'
import type { Overpass } from '../api/client'

const CENTER = { lat: 54.18, lon: 12.08 }
const AOI = { west: 9.5, south: 53.5, east: 15.0, north: 56.0 }
const BERLIN_TZ = 'Europe/Berlin'
const S2_LAYER_ID = 'api-s2-overlay'

// Python isoformat() emits "+00:00" not "Z"; handle both without appending Z blindly.
function parseIso(iso: string): Date {
  return (iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso))
    ? new Date(iso)
    : new Date(iso + 'Z')
}

function toLocalDayTime(isoUtc: string): string {
  const d = parseIso(isoUtc)
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TZ, weekday: 'short' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN_TZ, hour: '2-digit', minute: '2-digit',
  }).format(d)
  return `${day} ${time}`
}

const PLATFORM_COLORS: Record<string, string> = {
  'Sentinel-2': '#38bdf8',
  'Sentinel-3': '#818cf8',
  'SNPP':       '#a78bfa',
  'NOAA-20':    '#c084fc',
  'Landsat-8':  '#fb923c',
  'Landsat-9':  '#f97316',
}

function platformColor(platform: string): string {
  for (const [key, color] of Object.entries(PLATFORM_COLORS)) {
    if (platform.includes(key)) return color
  }
  return '#94a3b8'
}

// Group passes by platform, sort each group by AOS, sort groups alphabetically.
function groupByPlatform(passes: Overpass[]): { platform: string; passes: Overpass[] }[] {
  const map = new Map<string, Overpass[]>()
  for (const p of passes) {
    const g = map.get(p.platform) ?? []
    g.push(p)
    map.set(p.platform, g)
  }
  for (const ps of map.values()) ps.sort((a, b) => a.aos_utc.localeCompare(b.aos_utc))
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([platform, passes]) => ({ platform, passes }))
}

// Returns true if the pass AOS falls between today's sunrise and sunset.
// This is a daylight proxy — accurate only for today's passes.
// Full per-pass solar elevation requires a backend schema change to Overpass.
function isDaylightPass(aoUtc: string, sunrise: string | null, sunset: string | null): boolean {
  if (!sunrise || !sunset) return false
  const t    = parseIso(aoUtc).getTime()
  const rise = parseIso(sunrise).getTime()
  const set  = parseIso(sunset).getTime()
  return t >= rise && t <= set
}

function addS2Layer(
  map: maplibregl.Map,
  blobUrl: string,
  bbox: [number, number, number, number],
) {
  const [west, south, east, north] = bbox
  try {
    if (!map.getSource(S2_LAYER_ID)) {
      map.addSource(S2_LAYER_ID, {
        type: 'image',
        url: blobUrl,
        coordinates: [[west, north], [east, north], [east, south], [west, south]],
      })
    }
    if (!map.getLayer(S2_LAYER_ID)) {
      map.addLayer({
        id: S2_LAYER_ID, type: 'raster', source: S2_LAYER_ID,
        paint: { 'raster-opacity': 0.85 },
      })
    }
  } catch (err) {
    console.warn('[SatellitePanel] addS2Layer:', err)
  }
}

function removeS2Layer(map: maplibregl.Map) {
  try {
    if (map.getLayer(S2_LAYER_ID)) map.removeLayer(S2_LAYER_ID)
    if (map.getSource(S2_LAYER_ID)) map.removeSource(S2_LAYER_ID)
  } catch { /* map may be in teardown */ }
}

interface S2State {
  visible: boolean
  loading: boolean
  error: string | null
  meta: { sceneId: string; acquisitionTime: string; cloudCoverPct: number | null } | null
}

const S2_INIT: S2State = { visible: false, loading: false, error: null, meta: null }

const S: Record<string, React.CSSProperties> = {
  section:    { marginBottom: 24 },
  heading:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
                textTransform: 'uppercase', margin: '0 0 10px' },
  refBtn:     { background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
                fontSize: 13, padding: 0, float: 'right' },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: 11 },
  th:         { color: '#475569', fontWeight: 600, padding: '3px 4px', textAlign: 'left' as const,
                borderBottom: '1px solid #2d3148' },
  td:         { color: '#cbd5e1', padding: '4px 4px', borderBottom: '1px solid #1e2030' },
  groupHead:  { fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '6px 4px 2px',
                textTransform: 'uppercase' as const, borderBottom: '1px solid #2d3148' },
  errBox:     { color: '#f87171', fontSize: 12, padding: '8px 0' },
  overlayRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1',
                cursor: 'pointer', userSelect: 'none', marginTop: 8 },
  checkbox:   { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  metaBadge:  { fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#2d3148',
                color: '#94a3b8', marginLeft: 6 },
  card:       { background: '#141621', borderRadius: 6, padding: '10px 12px', marginBottom: 10 },
}

export default function SatellitePanel() {
  const { map } = useMapContext()
  const overpasses = useFetch(() => getSatelliteOverpasses(AOI))
  const solarTimes = useFetch(() => getSolarTimes(CENTER.lat, CENTER.lon))
  const [s2, setS2] = useState<S2State>(S2_INIT)

  const mountedRef  = useRef(true)
  const abortRef    = useRef<AbortController | null>(null)
  const blobUrlRef  = useRef<string | null>(null)
  // mapRef allows async callbacks to access the current map without stale closure issues.
  const mapRef      = useRef(map)
  mapRef.current    = map

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      if (mapRef.current) removeS2Layer(mapRef.current)
    }
  }, [])

  const toggleS2 = useCallback(async () => {
    if (!mapRef.current) return

    // Turn off if visible or blob cached
    if (s2.visible || blobUrlRef.current) {
      removeS2Layer(mapRef.current)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setS2(S2_INIT)
      return
    }

    // Cancel any previous in-flight fetch
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setS2(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Pass signal so the HTTP request is cancelled if user toggles off mid-fetch.
      const result = await getS2Overlay(AOI, 20, controller.signal)
      if (controller.signal.aborted || !mountedRef.current) return

      const blobUrl = URL.createObjectURL(result.blob)
      blobUrlRef.current = blobUrl

      // Use mapRef.current (not closed-over map) in case the map instance changed
      // during the 10–30 s fetch window.
      const doAdd = () => {
        if (!mountedRef.current) return
        const currentMap = mapRef.current
        if (currentMap) addS2Layer(currentMap, blobUrl, result.bbox)
      }

      const m = mapRef.current
      if (m && m.isStyleLoaded()) doAdd()
      else if (m) m.once('load', doAdd)

      setS2({
        visible: true,
        loading: false,
        error: null,
        meta: {
          sceneId:         result.sceneId,
          acquisitionTime: result.acquisitionTime,
          cloudCoverPct:   result.cloudCoverPct,
        },
      })
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return
      setS2(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Fetch failed',
      }))
    }
  }, [s2.visible])  // map read via mapRef — no need to list it as dep

  const groups = overpasses.data ? groupByPlatform(overpasses.data) : []
  const sunrise = solarTimes.data?.sunrise ?? null
  const sunset  = solarTimes.data?.sunset  ?? null

  function renderPassRow(p: Overpass, i: number) {
    const daylit = isDaylightPass(p.aos_utc, sunrise, sunset)
    return (
      <tr key={i} style={{ background: daylit ? '#1a2535' : undefined }}>
        <td style={S.td}>{toLocalDayTime(p.aos_utc)}</td>
        <td style={{ ...S.td, textAlign: 'center' as const }}>{p.duration_min.toFixed(0)} min</td>
        <td style={{ ...S.td, textAlign: 'center' as const,
          color: p.max_elevation_deg >= 20 ? '#22c55e' : '#94a3b8' }}>
          {p.max_elevation_deg.toFixed(0)}°
        </td>
      </tr>
    )
  }

  return (
    <section style={S.section}>
      <p style={S.heading}>
        Satellite
        <button style={S.refBtn} onClick={overpasses.refetch} title="Refresh">↻</button>
      </p>

      {overpasses.error && <p style={S.errBox}>⚠ {overpasses.error}</p>}
      {overpasses.loading && !groups.length && (
        <p style={{ color: '#64748b', fontSize: 12 }}>Loading…</p>
      )}

      {groups.length > 0 && (
        <div style={S.card}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>AOS (Berlin)</th>
                <th style={{ ...S.th, textAlign: 'center' as const }}>Dur</th>
                <th style={{ ...S.th, textAlign: 'center' as const }}>Elev</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(({ platform, passes }) => (
                <>
                  <tr key={platform}>
                    <td colSpan={3} style={{ ...S.groupHead, color: platformColor(platform) }}>
                      {platform}
                    </td>
                  </tr>
                  {passes.map(renderPassRow)}
                </>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
            Sat elev ≥ 20° in green · highlighted = daytime pass (today's sunrise–sunset)
          </div>
        </div>
      )}

      {/* Sentinel-2 overlay toggle */}
      <label style={S.overlayRow}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={s2.visible}
          disabled={s2.loading}
          onChange={toggleS2}
        />
        Show Sentinel-2 overlay on map
        {s2.loading && (
          <span style={{ marginLeft: 4, color: '#64748b', fontSize: 11 }}>⟳ fetching…</span>
        )}
        {s2.error && (
          <span style={{ fontSize: 11, color: '#f87171', marginLeft: 4 }}>⚠ failed</span>
        )}
      </label>

      {s2.meta && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, paddingLeft: 23 }}>
          <span style={S.metaBadge}>
            {s2.meta.acquisitionTime
              ? parseIso(s2.meta.acquisitionTime).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })
              : '—'}
          </span>
          {s2.meta.cloudCoverPct !== null && (
            <span style={{ ...S.metaBadge, marginLeft: 4 }}>
              ☁ {s2.meta.cloudCoverPct.toFixed(0)}%
            </span>
          )}
          {s2.meta.sceneId && (
            <div style={{ marginTop: 3, color: '#334155', fontSize: 10,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s2.meta.sceneId}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
