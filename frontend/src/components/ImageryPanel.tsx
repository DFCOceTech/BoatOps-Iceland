import { useCallback, useEffect, useRef, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { useSite } from '../context/SiteContext'
import { getS1Overlay, getS2Overlay } from '../api/client'
import type { S2OverlayResult } from '../api/client'

type Kind = 's1' | 's2'

const LAYER_ID: Record<Kind, string> = { s1: 'api-s1-overlay', s2: 'api-s2-overlay' }
const LOOKBACK_DAYS = [1, 3, 7, 14, 30]
const CLOUD_LIMITS = [10, 30, 60, 100]   // tile-wide cloud %, S2 only

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
             textTransform: 'uppercase', margin: '0 0 10px' },
  row:     { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1',
             userSelect: 'none', marginTop: 8, flexWrap: 'wrap' },
  checkbox:{ accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  select:  { background: '#0f111a', color: '#e2e8f0', border: '1px solid #2d3148', borderRadius: 4,
             fontSize: 11, padding: '2px 4px' },
  badge:   { fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#2d3148', color: '#94a3b8', marginRight: 4 },
  hint:    { fontSize: 10, color: '#475569', marginTop: 4, paddingLeft: 23, lineHeight: 1.5 },
}

interface State { visible: boolean; loading: boolean; error: string | null; meta: S2OverlayResult | null; days: number }
const INIT = (days: number): State => ({ visible: false, loading: false, error: null, meta: null, days })

function removeOverlay(map: maplibregl.Map, kind: Kind) {
  try {
    if (map.getLayer(LAYER_ID[kind]))  map.removeLayer(LAYER_ID[kind])
    if (map.getSource(LAYER_ID[kind])) map.removeSource(LAYER_ID[kind])
  } catch { /* teardown */ }
}

function addOverlay(map: maplibregl.Map, kind: Kind, url: string, bbox: [number, number, number, number]) {
  const [w, s, e, n] = bbox
  removeOverlay(map, kind)
  map.addSource(LAYER_ID[kind], { type: 'image', url, coordinates: [[w, n], [e, n], [e, s], [w, s]] })
  map.addLayer({ id: LAYER_ID[kind], type: 'raster', source: LAYER_ID[kind], paint: { 'raster-opacity': 0.85 } })
}

/**
 * Sentinel-1 SAR + Sentinel-2 optical imagery for the active work site.
 * SAR is the primary ice-finding layer (works through cloud and polar night); S2 is
 * clearer but needs a cloud-free overpass. Both are fetched for the site bbox only.
 */
export default function ImageryPanel() {
  const { map } = useMapContext()
  const { bbox } = useSite()
  const [st, setSt] = useState<Record<Kind, State>>({ s1: INIT(7), s2: INIT(14) })
  const urls = useRef<Record<Kind, string | null>>({ s1: null, s2: null })
  const cloudRef = useRef(30)
  const [cloudMax, setCloudMax] = useState(30)
  cloudRef.current = cloudMax
  const aborts = useRef<Record<Kind, AbortController | null>>({ s1: null, s2: null })
  const mapRef = useRef(map)
  mapRef.current = map
  const bboxRef = useRef(bbox)
  bboxRef.current = bbox

  const clear = useCallback((kind: Kind) => {
    aborts.current[kind]?.abort()
    const m = mapRef.current
    if (m) removeOverlay(m, kind)
    if (urls.current[kind]) { URL.revokeObjectURL(urls.current[kind]!); urls.current[kind] = null }
  }, [])

  const load = useCallback(async (kind: Kind, days: number) => {
    clear(kind)
    const ctl = new AbortController()
    aborts.current[kind] = ctl
    setSt(p => ({ ...p, [kind]: { ...p[kind], visible: true, loading: true, error: null, meta: null, days } }))
    try {
      const b = bboxRef.current
      const res = kind === 's1'
        ? await getS1Overlay(b, days, ctl.signal)
        : await getS2Overlay(b, cloudRef.current, days, ctl.signal)
      if (ctl.signal.aborted) return
      const url = URL.createObjectURL(res.blob)
      urls.current[kind] = url
      const m = mapRef.current
      if (m) addOverlay(m, kind, url, res.bbox)
      setSt(p => ({ ...p, [kind]: { ...p[kind], loading: false, meta: res } }))
    } catch (err) {
      if (ctl.signal.aborted) return
      setSt(p => ({ ...p, [kind]: { ...p[kind], loading: false,
        error: err instanceof Error ? err.message : 'Fetch failed' } }))
    }
  }, [clear])

  const toggle = (kind: Kind) => {
    if (st[kind].visible) { clear(kind); setSt(p => ({ ...p, [kind]: INIT(p[kind].days) })) }
    else load(kind, st[kind].days)
  }

  // The site moved (or radius changed): an overlay for the old bbox is stale — drop it.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    ;(['s1', 's2'] as Kind[]).forEach(clear)
    setSt(p => ({ s1: INIT(p.s1.days), s2: INIT(p.s2.days) }))
  }, [bbox.west, bbox.south, bbox.east, bbox.north, clear])

  useEffect(() => () => { (['s1', 's2'] as Kind[]).forEach(clear) }, [clear])

  const render = (kind: Kind, title: string, hint: string) => {
    const s = st[kind]
    return (
      <div>
        <div style={S.row}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={S.checkbox} checked={s.visible} disabled={s.loading && !s.visible}
              onChange={() => toggle(kind)} />
            {title}
          </label>
          <select aria-label={`${title} lookback`} style={S.select} value={s.days}
            onChange={e => {
              const days = Number(e.target.value)
              setSt(p => ({ ...p, [kind]: { ...p[kind], days } }))
              if (s.visible) load(kind, days)
            }}>
            {LOOKBACK_DAYS.map(d => <option key={d} value={d}>last {d} d</option>)}
          </select>
          {kind === 's2' && (
            <select aria-label="Sentinel-2 cloud limit" style={S.select} value={cloudMax}
              onChange={e => {
                const c = Number(e.target.value)
                cloudRef.current = c; setCloudMax(c)
                if (s.visible) load('s2', s.days)
              }}>
              {CLOUD_LIMITS.map(c => <option key={c} value={c}>≤{c}% cloud</option>)}
            </select>
          )}
          {s.loading && <span style={{ fontSize: 11, color: '#64748b' }}>⟳ fetching…</span>}
        </div>
        {s.error && <div style={{ ...S.hint, color: '#f87171' }}>⚠ {s.error}</div>}
        {s.meta && (
          <div style={{ ...S.hint, color: '#94a3b8' }}>
            <span style={S.badge}>{s.meta.acquisitionTime
              ? new Date(s.meta.acquisitionTime).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'}</span>
            {s.meta.cloudCoverPct !== null && <span style={S.badge}>☁ {s.meta.cloudCoverPct.toFixed(0)}% (tile)</span>}
            {s.meta.coveragePct !== null && (
              <span style={{ ...S.badge, color: s.meta.coveragePct >= 95 ? '#4ade80' : '#fbbf24' }}>
                {s.meta.coveragePct >= 95 ? '✓' : '⚠ partial'} covers {s.meta.coveragePct.toFixed(0)}% of area
              </span>
            )}
          </div>
        )}
        <div style={S.hint}>{hint}</div>
      </div>
    )
  }

  return (
    <section style={S.section}>
      <p style={S.heading}>Imagery (work-site area)</p>
      {render('s1', 'Sentinel-1 SAR (ice)',
        'Radar, day/night, through cloud. Calm open water is dark; ice and wind-roughened water are bright. Scene age is shown — ice moves, so check the timestamp.')}
      {render('s2', 'Sentinel-2 true colour',
        'Optical. Picks the most recent pass that fully covers the area; if none does, the best-covering one (flagged ⚠ partial). Cloud % is tile-wide, not for your site — raise the limit if no scene is found.')}
    </section>
  )
}
