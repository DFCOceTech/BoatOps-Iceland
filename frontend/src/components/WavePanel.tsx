import { useEffect } from 'react'
import { useMapContext } from '../context/MapContext'
import { useApiLayers } from '../hooks/useApiLayers'
import { useFetch } from '../hooks/useFetch'
import { getWaveForecast, getWaveOverlay } from '../api/client'
import type { ApiLayerDef } from '../config/oceanLayers'
import { useGoNoGo } from '../context/GoNoGoContext'

const AOI = { west: 9.5, south: 53.5, east: 15.0, north: 56.0 }
const CENTER = { lat: 54.18, lon: 12.08 }

// Wave height overlay layer definition (same pattern as OCEAN_LAYER_DEFS)
const WAVE_OVERLAY_DEF: ApiLayerDef = {
  id: 'api-wave-overlay',
  label: 'Wave Height Hs',
  unit: 'm',
  fetch: () => getWaveOverlay(AOI),
  // cmocean.amp: white (calm) → amber → dark red (rough)
  gradient: 'linear-gradient(to right, #fffbf5, #f5c842, #e06020, #8b1010, #1a0000)',
}

function hsStatus(hs: number): { color: string; label: string } {
  if (hs <= 0.4) return { color: '#22c55e', label: 'Go' }
  if (hs <= 0.8) return { color: '#f59e0b', label: 'Caution' }
  return { color: '#ef4444', label: 'No-Go' }
}

function bearingLabel(deg: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

const S: Record<string, React.CSSProperties> = {
  section:  { marginBottom: 24 },
  heading:  { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
              textTransform: 'uppercase', margin: '0 0 10px' },
  card:     { background: '#141621', borderRadius: 6, padding: '10px 12px', marginBottom: 10 },
  topRow:   { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  bigVal:   { fontSize: 24, fontWeight: 700, lineHeight: 1 },
  unit:     { fontSize: 12, color: '#64748b' },
  verdict:  { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              background: '#1e2030' },
  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 },
  metaKey:  { color: '#64748b' },
  metaVal:  { color: '#cbd5e1' },
  errBox:   { color: '#f87171', fontSize: 12, padding: '8px 0' },
  refBtn:   { background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
              fontSize: 13, padding: 0, float: 'right' },
  overlayRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1',
               cursor: 'pointer', userSelect: 'none', marginTop: 4 },
  checkbox: { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
}

export default function WavePanel() {
  const { map } = useMapContext()
  const { layers, toggle } = useApiLayers([WAVE_OVERLAY_DEF], map)
  const waveForecast = useFetch(() => getWaveForecast(CENTER.lat, CENTER.lon))
  const { update, refreshSignal } = useGoNoGo()

  const w = waveForecast.data
  useEffect(() => {
    if (w) update({ hsM: w.hs_m })
  }, [w, update])

  // Refresh when dashboard "↻" is clicked
  useEffect(() => {
    if (refreshSignal === 0) return
    waveForecast.refetch()
  }, [refreshSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = w ? hsStatus(w.hs_m) : null
  const overlayState = layers[WAVE_OVERLAY_DEF.id]

  return (
    <section style={S.section}>
      <p style={S.heading}>
        Waves
        <button style={S.refBtn} onClick={waveForecast.refetch} title="Refresh">↻</button>
      </p>

      {waveForecast.error && <p style={S.errBox}>⚠ {waveForecast.error}</p>}
      {waveForecast.loading && !w && (
        <p style={{ color: '#64748b', fontSize: 12 }}>Loading…</p>
      )}

      {w && status && (
        <div style={S.card}>
          <div style={S.topRow}>
            <span style={{ ...S.bigVal, color: status.color }}>
              {w.hs_m.toFixed(2)}
            </span>
            <span style={S.unit}>m Hs</span>
            <span style={{ ...S.verdict, color: status.color }}>{status.label}</span>
          </div>
          <div style={S.metaGrid}>
            <span style={S.metaKey}>Direction</span>
            <span style={S.metaVal}>
              {Math.round(w.vmdr_deg)}° {bearingLabel(w.vmdr_deg)}
            </span>
            <span style={S.metaKey}>Grid cell</span>
            <span style={S.metaVal}>
              {w.grid_lat.toFixed(2)}°N {w.grid_lon.toFixed(2)}°E
            </span>
            <span style={S.metaKey}>Valid</span>
            <span style={S.metaVal}>{w.timestamp.replace('T', ' ')} UTC</span>
          </div>
        </div>
      )}

      {/* Wave height overlay toggle */}
      <label style={S.overlayRow}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={overlayState?.visible ?? false}
          disabled={overlayState?.loading ?? false}
          onChange={() => toggle(WAVE_OVERLAY_DEF.id)}
        />
        Show wave height overlay on map
        {overlayState?.loading && <span style={{ marginLeft: 4 }}>⟳</span>}
        {overlayState?.error && (
          <span style={{ fontSize: 11, color: '#f87171', marginLeft: 4 }}>
            ⚠ failed
          </span>
        )}
      </label>
    </section>
  )
}
