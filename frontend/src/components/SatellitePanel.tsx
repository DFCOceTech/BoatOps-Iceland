import { useState, useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { useTimeContext } from '../context/TimeContext'
import { useFetch } from '../hooks/useFetch'
import { getSatelliteOverpasses, getS2Overlay, getSolarTimes } from '../api/client'
import type { Overpass } from '../api/client'

const CENTER = { lat: 54.18, lon: 12.08 }
const AOI = { west: 9.5, south: 53.5, east: 15.0, north: 56.0 }
const BERLIN_TZ = 'Europe/Berlin'
const S2_LAYER_ID       = 'api-s2-overlay'
const TRACK_SOURCE_ID   = 'sat-tracks-src'
const TRACK_LAYER_ID    = 'sat-tracks'
const HL_SOURCE_ID      = 'sat-track-hl-src'
const HL_LAYER_ID       = 'sat-track-hl'

function parseIso(iso: string): Date {
  return (iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso))
    ? new Date(iso)
    : new Date(iso + 'Z')
}

function toLocalDayTime(isoUtc: string): string {
  const d = parseIso(isoUtc)
  const day  = new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TZ, weekday: 'short' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TZ, hour: '2-digit', minute: '2-digit' }).format(d)
  return `${day} ${time}`
}

const PLATFORM_COLORS: Record<string, string> = {
  'Sentinel-1': '#4ade80', 'Sentinel-2': '#38bdf8', 'Sentinel-3': '#818cf8',
  'SNPP': '#a78bfa', 'NOAA-20': '#c084fc',
  'Landsat 8': '#fb923c', 'Landsat 9': '#f97316',
}

function platformColor(platform: string): string {
  for (const [key, color] of Object.entries(PLATFORM_COLORS)) {
    if (platform.includes(key)) return color
  }
  return '#94a3b8'
}

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

function isDaylightPass(aoUtc: string, sunrise: string | null, sunset: string | null): boolean {
  if (!sunrise || !sunset) return false
  const t    = parseIso(aoUtc).getTime()
  const rise = parseIso(sunrise).getTime()
  const set  = parseIso(sunset).getTime()
  return t >= rise && t <= set
}

function buildTracksGeoJSON(passes: Overpass[]) {
  return {
    type: 'FeatureCollection' as const,
    features: passes
      .filter(p => p.track_coords?.length >= 2)
      .map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: p.track_coords },
        properties: { platform: p.platform, aos_utc: p.aos_utc },
      })),
  }
}

function buildHighlightGeoJSON(pass: Overpass) {
  return {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: pass.track_coords },
      properties: { platform: pass.platform },
    }],
  }
}

// ── MapLibre helpers ──────────────────────────────────────────────────────────

function ensureTrackLayer(map: maplibregl.Map, passes: Overpass[]) {
  const geojson = buildTracksGeoJSON(passes)
  if (map.getSource(TRACK_SOURCE_ID)) {
    (map.getSource(TRACK_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson)
  } else {
    map.addSource(TRACK_SOURCE_ID, { type: 'geojson', data: geojson })
  }
  if (!map.getLayer(TRACK_LAYER_ID)) {
    map.addLayer({
      id: TRACK_LAYER_ID, type: 'line', source: TRACK_SOURCE_ID,
      paint: {
        'line-color': [
          'match', ['get', 'platform'],
          'Sentinel-1A', '#4ade80', 'Sentinel-1C', '#4ade80',
          'Sentinel-2A', '#38bdf8', 'Sentinel-2B', '#38bdf8',
          'Sentinel-3A', '#818cf8', 'Sentinel-3B', '#818cf8',
          'Landsat 8', '#fb923c', 'Landsat 9', '#f97316',
          'Suomi-NPP (VIIRS)', '#a78bfa', 'NOAA-20 (VIIRS)', '#c084fc',
          '#94a3b8',
        ],
        'line-width': 1.5,
        'line-opacity': 0.45,
      },
    })
  } else {
    map.setLayoutProperty(TRACK_LAYER_ID, 'visibility', 'visible')
  }
}

function ensureHighlightLayer(map: maplibregl.Map, pass: Overpass) {
  const geojson = buildHighlightGeoJSON(pass)
  if (map.getSource(HL_SOURCE_ID)) {
    (map.getSource(HL_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson)
    if (map.getLayer(HL_LAYER_ID)) map.setLayoutProperty(HL_LAYER_ID, 'visibility', 'visible')
  } else {
    map.addSource(HL_SOURCE_ID, { type: 'geojson', data: geojson })
    map.addLayer({
      id: HL_LAYER_ID, type: 'line', source: HL_SOURCE_ID,
      paint: {
        'line-color': '#ffffff',
        'line-width': 3,
        'line-opacity': 0.9,
      },
    })
  }
}

function removeLayer(map: maplibregl.Map, layerId: string, sourceId: string) {
  try {
    if (map.getLayer(layerId))  map.removeLayer(layerId)
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  } catch { /* teardown */ }
}

function hideLayer(map: maplibregl.Map, layerId: string) {
  try { if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none') } catch {}
}

// ── S2 helpers ────────────────────────────────────────────────────────────────

function addS2Layer(map: maplibregl.Map, blobUrl: string, bbox: [number, number, number, number]) {
  const [west, south, east, north] = bbox
  try {
    if (!map.getSource(S2_LAYER_ID)) {
      map.addSource(S2_LAYER_ID, {
        type: 'image', url: blobUrl,
        coordinates: [[west, north], [east, north], [east, south], [west, south]],
      })
    }
    if (!map.getLayer(S2_LAYER_ID))
      map.addLayer({ id: S2_LAYER_ID, type: 'raster', source: S2_LAYER_ID, paint: { 'raster-opacity': 0.85 } })
  } catch (err) { console.warn('[SatellitePanel] addS2Layer:', err) }
}

function removeS2Layer(map: maplibregl.Map) {
  try {
    if (map.getLayer(S2_LAYER_ID)) map.removeLayer(S2_LAYER_ID)
    if (map.getSource(S2_LAYER_ID)) map.removeSource(S2_LAYER_ID)
  } catch {}
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface S2State {
  visible: boolean; loading: boolean; error: string | null
  meta: { sceneId: string; acquisitionTime: string; cloudCoverPct: number | null } | null
}
const S2_INIT: S2State = { visible: false, loading: false, error: null, meta: null }

// ── Styles ────────────────────────────────────────────────────────────────────

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
  metaBadge:  { fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#2d3148', color: '#94a3b8', marginLeft: 6 },
  card:       { background: '#141621', borderRadius: 6, padding: '10px 12px', marginBottom: 10 },
  hint:       { fontSize: 10, color: '#334155', marginTop: 6 },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SatellitePanel() {
  const { map } = useMapContext()
  const { setForecastHour } = useTimeContext()
  const overpasses = useFetch(() => getSatelliteOverpasses(AOI))
  const solarTimes = useFetch(() => getSolarTimes(CENTER.lat, CENTER.lon))
  const [s2, setS2] = useState<S2State>(S2_INIT)
  const [tracksVisible,  setTracksVisible]  = useState(false)
  const [selectedAos,    setSelectedAos]    = useState<string | null>(null)

  const mountedRef  = useRef(true)
  const abortRef    = useRef<AbortController | null>(null)
  const blobUrlRef  = useRef<string | null>(null)
  const mapRef      = useRef(map)
  mapRef.current    = map

  const baseMs = useRef((() => {
    const d = new Date(); d.setUTCMinutes(0, 0, 0); return d.getTime()
  })())

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const m = mapRef.current
      if (m) {
        removeS2Layer(m)
        removeLayer(m, TRACK_LAYER_ID, TRACK_SOURCE_ID)
        removeLayer(m, HL_LAYER_ID, HL_SOURCE_ID)
      }
    }
  }, [])

  // ── Track layer: show/hide all tracks ────────────────────────────────────

  useEffect(() => {
    const m = mapRef.current
    const passes = overpasses.data
    if (!m || !passes) return

    const doToggle = () => {
      if (tracksVisible) {
        ensureTrackLayer(m, passes)
      } else {
        hideLayer(m, TRACK_LAYER_ID)
        hideLayer(m, HL_LAYER_ID)
      }
    }

    if (m.isStyleLoaded()) {
      doToggle()
    } else {
      m.once('load', doToggle)
      return () => { m.off('load', doToggle) }
    }
  }, [tracksVisible, overpasses.data])

  // ── Highlight layer: selected pass ───────────────────────────────────────

  useEffect(() => {
    const m = mapRef.current
    const passes = overpasses.data
    if (!m || !passes || !selectedAos) return

    const pass = passes.find(p => p.aos_utc === selectedAos)
    if (!pass || !pass.track_coords?.length) return

    const doHighlight = () => {
      ensureHighlightLayer(m, pass)
    }

    if (m.isStyleLoaded()) {
      doHighlight()
    } else {
      m.once('load', doHighlight)
      return () => { m.off('load', doHighlight) }
    }
  }, [selectedAos, overpasses.data])

  // ── Pass click: set time + show track ────────────────────────────────────

  const handlePassClick = useCallback((p: Overpass) => {
    const aosMs = parseIso(p.aos_utc).getTime()
    const hourOffset = Math.max(0, Math.min(167, Math.round((aosMs - baseMs.current) / 3600_000)))
    setForecastHour(hourOffset)
    setTracksVisible(true)      // auto-enable track layer
    setSelectedAos(p.aos_utc)  // highlight this pass
  }, [setForecastHour])

  // ── S2 toggle ────────────────────────────────────────────────────────────

  const toggleS2 = useCallback(async () => {
    if (!mapRef.current) return

    if (s2.visible || blobUrlRef.current) {
      removeS2Layer(mapRef.current)
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
      setS2(S2_INIT)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setS2(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await getS2Overlay(AOI, 20, controller.signal)
      if (controller.signal.aborted || !mountedRef.current) return

      const blobUrl = URL.createObjectURL(result.blob)
      blobUrlRef.current = blobUrl

      const doAdd = () => {
        if (!mountedRef.current) return
        const m = mapRef.current
        if (m) addS2Layer(m, blobUrl, result.bbox)
      }

      const m = mapRef.current
      if (m && m.isStyleLoaded()) doAdd()
      else if (m) m.once('load', doAdd)

      setS2({
        visible: true, loading: false, error: null,
        meta: { sceneId: result.sceneId, acquisitionTime: result.acquisitionTime,
                cloudCoverPct: result.cloudCoverPct },
      })
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return
      setS2(prev => ({ ...prev, loading: false,
        error: err instanceof Error ? err.message : 'Fetch failed' }))
    }
  }, [s2.visible])

  // ── Render ────────────────────────────────────────────────────────────────

  const groups  = overpasses.data ? groupByPlatform(overpasses.data) : []
  const sunrise = solarTimes.data?.sunrise ?? null
  const sunset  = solarTimes.data?.sunset  ?? null

  function renderPassRow(p: Overpass, i: number) {
    const daylit   = isDaylightPass(p.aos_utc, sunrise, sunset)
    const selected = p.aos_utc === selectedAos
    return (
      <tr key={i}
        onClick={() => handlePassClick(p)}
        style={{
          background: selected ? '#1e2d45' : daylit ? '#1a2535' : undefined,
          cursor: 'pointer',
          outline: selected ? '1px solid #38bdf8' : undefined,
        }}
        title="Click to set planning time and show track"
      >
        <td style={{ ...S.td, color: selected ? '#7dd3fc' : undefined }}>
          {toLocalDayTime(p.aos_utc)}
        </td>
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
          <p style={S.hint}>
            Click row → set plan time + show track · elev ≥ 20° green · highlighted = daytime
          </p>
        </div>
      )}

      {/* Track overlay toggle */}
      <label style={S.overlayRow}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={tracksVisible}
          disabled={!overpasses.data || overpasses.loading}
          onChange={() => {
            setTracksVisible(v => !v)
            if (tracksVisible) setSelectedAos(null)
          }}
        />
        Show all satellite tracks
      </label>

      {/* S2 imagery toggle */}
      <label style={{ ...S.overlayRow, marginTop: 6 }}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={s2.visible}
          disabled={s2.loading}
          onChange={toggleS2}
        />
        Show Sentinel-2 overlay on map
        {s2.loading && <span style={{ marginLeft: 4, color: '#64748b', fontSize: 11 }}>⟳ fetching…</span>}
        {s2.error  && <span style={{ fontSize: 11, color: '#f87171', marginLeft: 4 }}>⚠ failed</span>}
      </label>

      {s2.meta && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, paddingLeft: 23 }}>
          <span style={S.metaBadge}>
            {s2.meta.acquisitionTime
              ? parseIso(s2.meta.acquisitionTime).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric' })
              : '—'}
          </span>
          {s2.meta.cloudCoverPct !== null && (
            <span style={{ ...S.metaBadge, marginLeft: 4 }}>☁ {s2.meta.cloudCoverPct.toFixed(0)}%</span>
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
