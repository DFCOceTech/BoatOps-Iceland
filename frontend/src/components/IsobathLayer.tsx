import { useState, useEffect, useRef, useCallback } from 'react'
import { useMapContext } from '../context/MapContext'
import { getIsobaths } from '../api/client'

const SOURCE_ID = 'isobaths-src'
const LAYER_ID  = 'isobaths'

// Colors chosen to be legible on the dark basemap (land #090909, water #1e3278)
const DEPTH_STYLES: { depth: number; color: string; width: number }[] = [
  { depth: 10,  color: '#67e8f9', width: 0.8 },
  { depth: 25,  color: '#38bdf8', width: 1.2 },
  { depth: 100, color: '#818cf8', width: 1.8 },
]

const S: Record<string, React.CSSProperties> = {
  section:    { marginBottom: 24 },
  heading:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
                textTransform: 'uppercase', margin: '0 0 10px' },
  refBtn:     { background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
                fontSize: 13, padding: 0, float: 'right' },
  overlayRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1',
                cursor: 'pointer', userSelect: 'none' },
  checkbox:   { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  errBox:     { color: '#f87171', fontSize: 12, padding: '6px 0' },
  legend:     { paddingLeft: 23, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  legendRow:  { display: 'flex', alignItems: 'center', gap: 7 },
  legendText: { fontSize: 10, color: '#475569' },
}

export default function IsobathLayer() {
  const { map } = useMapContext()
  const [visible,  setVisible]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  const mapRef = useRef(map)
  mapRef.current = map

  // Load GeoJSON from backend, add MapLibre source + single data-driven line layer
  const loadLayer = useCallback(async () => {
    const m = mapRef.current
    if (!m) return
    setLoading(true)
    setError(null)
    try {
      const geojson = await getIsobaths()

      const addToMap = () => {
        const cur = mapRef.current
        if (!cur) return
        try {
          if (cur.getSource(SOURCE_ID)) {
            // Refresh data if source already exists
            (cur.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson as unknown as GeoJSON.FeatureCollection)
          } else {
            cur.addSource(SOURCE_ID, { type: 'geojson', data: geojson as unknown as GeoJSON.FeatureCollection })
          }
          if (!cur.getLayer(LAYER_ID)) {
            cur.addLayer({
              id: LAYER_ID,
              type: 'line',
              source: SOURCE_ID,
              paint: {
                // Color and width driven by depth_m property
                'line-color': [
                  'match', ['get', 'depth_m'],
                  10,  '#67e8f9',
                  25,  '#38bdf8',
                  100, '#818cf8',
                  '#94a3b8',
                ],
                'line-width': [
                  'match', ['get', 'depth_m'],
                  10,  0.8,
                  25,  1.2,
                  100, 1.8,
                  1.0,
                ],
                'line-opacity': 0.7,
              },
            })
          }
          setDataLoaded(true)
        } catch (err) {
          console.warn('[IsobathLayer] addToMap:', err)
        }
      }

      if (m.isStyleLoaded()) {
        addToMap()
      } else {
        m.once('load', addToMap)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = useCallback(() => {
    const m = mapRef.current
    if (visible) {
      if (m?.getLayer(LAYER_ID)) m.setLayoutProperty(LAYER_ID, 'visibility', 'none')
      setVisible(false)
    } else {
      if (!dataLoaded) {
        loadLayer()
      } else if (m?.getLayer(LAYER_ID)) {
        m.setLayoutProperty(LAYER_ID, 'visibility', 'visible')
      }
      setVisible(true)
    }
  }, [visible, dataLoaded, loadLayer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const m = mapRef.current
      if (!m) return
      try {
        if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID)
        if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
      } catch { /* map may already be removed */ }
    }
  }, [])

  return (
    <section style={S.section}>
      <p style={S.heading}>
        Isobaths
        {dataLoaded && (
          <button style={S.refBtn} onClick={loadLayer} title="Refresh isobaths" disabled={loading}>↻</button>
        )}
      </p>

      {error && <p style={S.errBox}>⚠ {error}</p>}

      <label style={S.overlayRow}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={visible}
          disabled={loading}
          onChange={toggle}
        />
        Depth contours (10 / 25 / 100 m)
        {loading && <span style={{ marginLeft: 4, color: '#64748b', fontSize: 11 }}>⟳</span>}
      </label>

      {visible && dataLoaded && (
        <div style={S.legend}>
          {DEPTH_STYLES.map(({ depth, color, width }) => (
            <div key={depth} style={S.legendRow}>
              <svg width={24} height={8} style={{ flexShrink: 0 }}>
                <line x1={0} y1={4} x2={24} y2={4}
                  stroke={color} strokeWidth={width * 1.5} strokeLinecap="round" />
              </svg>
              <span style={S.legendText}>{depth} m</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
