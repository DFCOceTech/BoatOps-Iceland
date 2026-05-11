/**
 * Renders GBIF species occurrence records as MapLibre circle features.
 *
 * Uses GET /api/map/gbif-occurrences (filtered to HUMAN_OBSERVATION +
 * MACHINE_OBSERVATION + hasGeospatialIssue=false) so records with imprecise
 * herbarium/museum coordinates that fall on land are excluded.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'

const AOI = { west: 9.5, south: 53.5, east: 15.0, north: 56.0 }

interface Props {
  taxonKey: number
  label: string
  color: string        // circle fill colour
  gbifUrl: string      // link to GBIF species page
}

interface OccurrenceGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: Record<string, string | number | null>
  }>
  total_gbif: number
  returned: number
}

const S: Record<string, React.CSSProperties> = {
  section:  { marginBottom: 16 },
  row:      { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
               color: '#cbd5e1', cursor: 'pointer', userSelect: 'none', padding: '4px 0' },
  checkbox: { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  dot:      { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  meta:     { fontSize: 10, color: '#475569', paddingLeft: 23, marginTop: 2 },
  err:      { fontSize: 11, color: '#f87171', paddingLeft: 23 },
}

export default function GbifLayer({ taxonKey, label, color, gbifUrl }: Props) {
  const { map } = useMapContext()
  const [visible,  setVisible]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [loaded,   setLoaded]   = useState(false)
  const [meta,     setMeta]     = useState<{ total: number; returned: number } | null>(null)

  const mapRef   = useRef(map)
  mapRef.current = map

  const SOURCE_ID = `gbif-${taxonKey}-src`
  const LAYER_ID  = `gbif-${taxonKey}`

  const fetchAndAdd = useCallback(async () => {
    const m = mapRef.current
    if (!m) return
    setLoading(true)
    setError(null)
    try {
      const url = `/api/map/gbif-occurrences?taxon_key=${taxonKey}` +
        `&west=${AOI.west}&south=${AOI.south}&east=${AOI.east}&north=${AOI.north}`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`)
      const geojson: OccurrenceGeoJSON = await resp.json()
      setMeta({ total: geojson.total_gbif, returned: geojson.returned })

      const addToMap = () => {
        const cur = mapRef.current
        if (!cur) return
        try {
          if (cur.getSource(SOURCE_ID)) {
            (cur.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson)
          } else {
            cur.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
          }
          if (!cur.getLayer(LAYER_ID)) {
            cur.addLayer({
              id: LAYER_ID,
              type: 'circle',
              source: SOURCE_ID,
              paint: {
                'circle-color': color,
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  7,  4,
                  10, 7,
                  13, 11,
                ],
                'circle-opacity': 0.85,
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 0.8,
                'circle-stroke-opacity': 0.4,
              },
            })
          }
          setLoaded(true)
        } catch (err) {
          console.warn('[GbifLayer] addToMap:', err)
        }
      }

      if (m.isStyleLoaded()) addToMap()
      else m.once('load', addToMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setLoading(false)
    }
  }, [taxonKey, SOURCE_ID, LAYER_ID, color])

  const toggle = useCallback(() => {
    const m = mapRef.current
    if (visible) {
      if (m?.getLayer(LAYER_ID)) m.setLayoutProperty(LAYER_ID, 'visibility', 'none')
      setVisible(false)
    } else {
      if (!loaded) {
        fetchAndAdd()
      } else if (m?.getLayer(LAYER_ID)) {
        m.setLayoutProperty(LAYER_ID, 'visibility', 'visible')
      }
      setVisible(true)
    }
  }, [visible, loaded, fetchAndAdd, LAYER_ID])

  useEffect(() => {
    return () => {
      const m = mapRef.current
      if (!m) return
      try {
        if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID)
        if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
      } catch { /* map teardown */ }
    }
  }, [LAYER_ID, SOURCE_ID])

  return (
    <div style={S.section}>
      <label style={S.row}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={visible}
          disabled={loading}
          onChange={toggle}
        />
        <span style={{ ...S.dot, background: color }} />
        <span style={{ flex: 1 }}>{label}</span>
        {loading && <span style={{ fontSize: 11, color: '#64748b' }}>⟳</span>}
      </label>

      {error && <p style={S.err}>⚠ {error}</p>}

      {meta && visible && (
        <p style={S.meta}>
          {meta.returned} field obs · {meta.total.toLocaleString()} total in GBIF ·{' '}
          <a href={gbifUrl} target="_blank" rel="noopener noreferrer"
             style={{ color: '#38bdf8', textDecoration: 'none' }}>
            GBIF ↗
          </a>
        </p>
      )}
    </div>
  )
}
