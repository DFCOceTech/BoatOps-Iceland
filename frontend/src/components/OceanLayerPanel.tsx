import { useMapContext } from '../context/MapContext'
import { useTimeContext } from '../context/TimeContext'
import { useApiLayers } from '../hooks/useApiLayers'
import { OCEAN_LAYER_DEFS } from '../config/oceanLayers'
import ColorscaleLegend from './ColorscaleLegend'

const S: Record<string, React.CSSProperties> = {
  section:   { marginBottom: 24 },
  heading:   { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
               textTransform: 'uppercase', margin: '0 0 10px' },
  row:       { paddingBottom: 10, borderBottom: '1px solid #2d3148', marginBottom: 6 },
  topLine:   { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  checkbox:  { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  label:     { fontSize: 13, color: '#cbd5e1', flex: 1, userSelect: 'none' },
  badge:     { fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#2d3148', color: '#64748b' },
  error:     { fontSize: 11, color: '#f87171', margin: '4px 0' },
  slider:    { width: '100%', accentColor: '#38bdf8', margin: '4px 0 0', cursor: 'pointer' },
  metaRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  refreshBtn:{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
               fontSize: 14, padding: 0, lineHeight: 1 },
  spinner:   { display: 'inline-block', animation: 'spin 1s linear infinite', marginLeft: 4 },
}

// Inject spinner keyframes once.
if (typeof document !== 'undefined' && !document.getElementById('spin-kf')) {
  const s = document.createElement('style')
  s.id = 'spin-kf'
  s.textContent = '@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }'
  document.head.appendChild(s)
}

export default function OceanLayerPanel() {
  const { map } = useMapContext()
  const { forecastHour } = useTimeContext()
  const { layers, toggle, setOpacity, refresh } = useApiLayers(OCEAN_LAYER_DEFS, map, forecastHour)

  return (
    <section style={S.section}>
      <p style={S.heading}>Oceanographic Layers</p>
      {OCEAN_LAYER_DEFS.map(def => {
        const state = layers[def.id]
        if (!state) return null
        const hasData = !!state.blobUrl
        const showDetail = state.visible && (hasData || !!state.error)

        return (
          <div key={def.id} style={S.row}>
            {/* Toggle row */}
            <label style={S.topLine}>
              <input
                type="checkbox"
                style={S.checkbox}
                checked={state.visible}
                disabled={state.loading && !state.blobUrl}
                onChange={() => toggle(def.id)}
              />
              <span style={S.label}>{def.label}</span>
              {state.loading && <span style={S.spinner}>⟳</span>}
            </label>

            {/* Error state */}
            {state.error && (
              <div style={S.error}>
                ⚠ {state.error.length > 60 ? state.error.slice(0, 60) + '…' : state.error}
                <button style={{ ...S.refreshBtn, marginLeft: 8 }} onClick={() => refresh(def.id)}>
                  Retry
                </button>
              </div>
            )}

            {/* Data detail: legend + opacity + timestamp */}
            {showDetail && hasData && (
              <>
                <ColorscaleLegend
                  colorscale={state.colorscale}
                  gradient={def.gradient}
                  unit={def.unit}
                />
                <div style={S.metaRow}>
                  {state.timestamp
                    ? <span style={S.badge}>{state.timestamp.replace('T', ' ').slice(0, 16)}</span>
                    : <span />}
                  <button style={S.refreshBtn} title="Refresh layer" onClick={() => refresh(def.id)}>↻</button>
                </div>
                <input
                  type="range"
                  min={0} max={100}
                  value={Math.round(state.opacity * 100)}
                  style={S.slider}
                  aria-label={`${def.label} opacity`}
                  onChange={e => setOpacity(def.id, Number(e.target.value) / 100)}
                />
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}
