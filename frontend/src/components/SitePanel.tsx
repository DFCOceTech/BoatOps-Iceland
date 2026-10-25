import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { PRESET_SITES, useSite, validLat, validLon } from '../context/SiteContext'

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
             textTransform: 'uppercase', margin: '0 0 8px' },
  card:    { background: '#141621', borderRadius: 6, padding: '10px 12px', marginBottom: 8 },
  name:    { fontSize: 13, fontWeight: 700, color: '#f1f5f9' },
  coords:  { fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 },
  row:     { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  btn:     { fontSize: 11, padding: '4px 8px', background: '#2d3148', color: '#e2e8f0',
             border: '1px solid #3b4160', borderRadius: 4, cursor: 'pointer' },
  btnOn:   { background: '#0e7490', borderColor: '#22d3ee' },
  input:   { background: '#0f111a', color: '#e2e8f0', border: '1px solid #2d3148', borderRadius: 4,
             padding: '4px 6px', fontSize: 12, width: 92 },
  hint:    { fontSize: 10, color: '#475569', marginTop: 6, lineHeight: 1.5 },
  item:    { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1',
             padding: '4px 0', borderBottom: '1px solid #2d3148' },
}

function dot(color: string, size: number, ring = false): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    `width:${size}px;height:${size}px;border-radius:50%;background:${ring ? 'rgba(34,211,238,0.25)' : color};` +
    `border:2px solid ${color};box-shadow:0 1px 5px rgba(0,0,0,0.7);cursor:pointer;`
  return el
}

export default function SitePanel() {
  const { map } = useMapContext()
  const { active, saved, radiusKm, picking, setRadiusKm, setPicking, setActive, saveActive, remove } = useSite()
  // Drafts hold in-progress typing; null = show the live site value
  const [latDraft, setLatDraft] = useState<string | null>(null)
  const [lonDraft, setLonDraft] = useState<string | null>(null)
  const latTxt = latDraft ?? active.lat.toFixed(5)
  const lonTxt = lonDraft ?? active.lon.toFixed(5)
  const [nameTxt, setNameTxt] = useState('')
  const activeMarker = useRef<maplibregl.Marker | null>(null)

  // Active-site marker (draggable: nudge the work site as the ice moves)
  useEffect(() => {
    if (!map) return
    const marker = new maplibregl.Marker({ element: dot('#22d3ee', 20, true), draggable: true })
      .setLngLat([active.lon, active.lat])
      .addTo(map)
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat()
      setActive(lat, lng, active.name)
    })
    activeMarker.current = marker
    return () => { marker.remove(); activeMarker.current = null }
  }, [map, active.lat, active.lon, active.name, setActive])

  // Saved-site markers
  useEffect(() => {
    if (!map) return
    const markers = saved.map(s => {
      const el = dot('#fbbf24', 12)
      el.title = s.name
      el.addEventListener('click', e => { e.stopPropagation(); setActive(s.lat, s.lon, s.name) })
      return new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map)
    })
    return () => markers.forEach(m => m.remove())
  }, [map, saved, setActive])

  // Pick-on-map mode
  useEffect(() => {
    if (!map || !picking) return
    const canvas = map.getCanvas()
    const prev = canvas.style.cursor
    canvas.style.cursor = 'crosshair'
    const onClick = (e: maplibregl.MapMouseEvent) => {
      setActive(e.lngLat.lat, e.lngLat.lng)
      setPicking(false)
    }
    map.once('click', onClick)
    return () => { canvas.style.cursor = prev; map.off('click', onClick) }
  }, [map, picking, setActive, setPicking])

  const flyTo = (lat: number, lon: number) => map?.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 12) })

  const applyCoords = () => {
    const lat = parseFloat(latTxt), lon = parseFloat(lonTxt)
    if (!validLat(lat) || !validLon(lon)) return
    setActive(lat, lon); flyTo(lat, lon)
    setLatDraft(null); setLonDraft(null)
  }

  const exportGeoJson = () => {
    const fc = {
      type: 'FeatureCollection',
      features: [active, ...saved].map(s => ({
        type: 'Feature', properties: { name: s.name },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'boatops-iceland-sites.geojson'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section style={S.section}>
      <p style={S.heading}>Work Site</p>
      <div style={S.card}>
        <div style={S.name}>{active.name}</div>
        <div style={S.coords}>{active.lat.toFixed(5)}°N&nbsp; {active.lon.toFixed(5)}°E</div>
        <div style={S.row}>
          <input aria-label="Latitude" style={S.input} value={latTxt} onChange={e => setLatDraft(e.target.value)} />
          <input aria-label="Longitude" style={S.input} value={lonTxt} onChange={e => setLonDraft(e.target.value)} />
          <button style={S.btn} onClick={applyCoords}>Go</button>
        </div>
        <div style={S.row}>
          <button style={{ ...S.btn, ...(picking ? S.btnOn : {}) }} onClick={() => setPicking(!picking)}>
            {picking ? 'Click the map…' : 'Pick on map'}
          </button>
          <button style={S.btn} onClick={() => { if (map) { const c = map.getCenter(); setActive(c.lat, c.lng) } }}>
            Use map centre
          </button>
        </div>
        <div style={S.row}>
          <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>Imagery radius</span>
          {[3, 6, 12].map(r => (
            <button key={r} style={{ ...S.btn, ...(radiusKm === r ? S.btnOn : {}) }} onClick={() => setRadiusKm(r)}>
              {r} km
            </button>
          ))}
        </div>
        <p style={S.hint}>
          Drag the cyan marker to move the site as the ice moves. Weather, sun, tide and satellite
          panels follow it. The URL carries the site — share it with the team.
        </p>
      </div>

      <div style={S.row}>
        <input aria-label="Site name" style={{ ...S.input, width: 150 }} placeholder="Name this site…"
          value={nameTxt} onChange={e => setNameTxt(e.target.value)} />
        <button style={S.btn} onClick={() => { saveActive(nameTxt); setNameTxt('') }}>Save site</button>
        <button style={S.btn} onClick={exportGeoJson}>Export</button>
      </div>

      <div style={{ marginTop: 8 }}>
        {[...PRESET_SITES, ...saved].map(s => (
          <div key={s.id} style={S.item}>
            <button style={{ ...S.btn, flex: 1, textAlign: 'left', background: 'transparent', border: 'none', color: '#cbd5e1' }}
              onClick={() => { setActive(s.lat, s.lon, s.name); flyTo(s.lat, s.lon) }}>
              {s.name}
            </button>
            {!s.id.startsWith('preset-') && (
              <button style={S.btn} aria-label={`Delete ${s.name}`} onClick={() => remove(s.id)}>✕</button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
