import { useState, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { injectDarkPopupStyles } from '../utils/popupStyles'

interface Station {
  id:    string
  name:  string
  lat:   number
  lon:   number
  color: string
  type:  'marnet' | 'fino'
}

// Positions from BSH/PTB public data
const STATIONS: Station[] = [
  { id: 'marnet-fehmarnbelt', name: 'MARNET Fehmarnbelt',     lat: 54.595, lon: 11.183, color: '#38bdf8', type: 'marnet' },
  { id: 'marnet-darss',       name: 'MARNET Darßer Schwelle', lat: 54.700, lon: 12.700, color: '#38bdf8', type: 'marnet' },
  { id: 'marnet-oder-bank',   name: 'MARNET Oder Bank',       lat: 54.067, lon: 14.152, color: '#38bdf8', type: 'marnet' },
  { id: 'fino2',              name: 'FINO2',                   lat: 55.010, lon: 13.157, color: '#fbbf24', type: 'fino'   },
]

const S: Record<string, React.CSSProperties> = {
  section:  { marginBottom: 24 },
  heading:  { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
              textTransform: 'uppercase', margin: '0 0 8px' },
  row:      { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1',
              cursor: 'pointer', userSelect: 'none', marginBottom: 4 },
  checkbox: { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  legend:   { fontSize: 11, color: '#475569', marginTop: 6, paddingLeft: 23, lineHeight: 1.6 },
  dot:      { display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.4)', marginRight: 5, verticalAlign: 'middle' },
}

export default function StationMarkers() {
  const { map } = useMapContext()
  const [visible, setVisible] = useState(false)
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => { injectDarkPopupStyles() }, [])

  useEffect(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (!map || !visible) return

    const added: maplibregl.Marker[] = []

    for (const st of STATIONS) {
      const el = document.createElement('div')
      el.style.cssText = [
        `width:16px;height:16px;border-radius:50%;`,
        `background:${st.color};border:2px solid rgba(255,255,255,0.7);`,
        `cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.6);`,
        st.type === 'fino' ? 'border-radius:3px;' : '',
      ].join('')

      const popup = new maplibregl.Popup({
        className: 'boatops-popup',
        offset: 12,
        closeButton: true,
        maxWidth: '220px',
      }).setHTML(`
        <div style="padding:8px 10px;font-size:12px;line-height:1.6">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${st.name}</div>
          <div style="color:#94a3b8">${st.lat.toFixed(3)}°N &nbsp;${st.lon.toFixed(3)}°E</div>
          <div style="color:#475569;font-size:11px;margin-top:4px">${st.type === 'marnet' ? 'BSH MARNET monitoring buoy' : 'Offshore research platform (BSH/PTB)'}</div>
        </div>
      `)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([st.lon, st.lat])
        .setPopup(popup)
        .addTo(map)
      added.push(marker)
    }

    markersRef.current = added
    return () => { added.forEach(m => m.remove()); markersRef.current = [] }
  }, [map, visible])

  return (
    <section style={S.section}>
      <p style={S.heading}>Monitoring Stations</p>
      <label style={S.row}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={visible}
          onChange={() => setVisible(v => !v)}
        />
        MARNET buoys &amp; FINO2
      </label>
      {visible && (
        <div style={S.legend}>
          <span style={{ ...S.dot, background: '#38bdf8' }} />Fehmarnbelt · Darßer Schwelle · Oder Bank
          <br />
          <span style={{ ...S.dot, background: '#fbbf24', borderRadius: 2 }} />FINO2 (click marker for details)
        </div>
      )}
    </section>
  )
}
