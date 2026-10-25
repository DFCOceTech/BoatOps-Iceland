import { useFetch } from '../hooks/useFetch'
import { getMarineForecast } from '../api/client'
import { useSite } from '../context/SiteContext'
import { findExtrema } from '../utils/tide'

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
             textTransform: 'uppercase', margin: '0 0 8px' },
  card:    { background: '#141621', borderRadius: 6, padding: '10px 12px' },
  line:    { fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 },
  hint:    { fontSize: 10, color: '#475569', marginTop: 6, lineHeight: 1.5 },
}

export default function MarinePanel() {
  const { active } = useSite()
  const marine = useFetch(() => getMarineForecast(active.lat, active.lon))
  const nowIso = new Date().toISOString().slice(0, 13) + ':00'

  return (
    <section style={S.section}>
      <p style={S.heading}>Tide &amp; Sea State (coastal reference)</p>
      <div style={S.card}>
        {marine.loading && <div style={S.line}>Loading…</div>}
        {marine.error && <div style={{ ...S.line, color: '#f87171' }}>{marine.error}</div>}
        {marine.data && (() => {
          const d = marine.data
          const idx = d.times.findIndex(t => t >= nowIso)
          if (idx < 0) return <div style={S.line}>Forecast has expired — reload the page.</div>
          const i = idx
          const ext = findExtrema(d.times, d.sea_level_m, nowIso).slice(0, 4)
          const fmt = (v: number | null | undefined, u: string, dp = 2) => v == null ? '—' : `${v.toFixed(dp)} ${u}`
          return (
            <>
              <div style={S.line}>
                Sea level now: <b>{fmt(d.sea_level_m[i], 'm')}</b> &nbsp;·&nbsp; Offshore Hs: <b>{fmt(d.wave_height_m[i], 'm')}</b>
                &nbsp;·&nbsp; SST: <b>{fmt(d.sst_c[i], '°C', 1)}</b>
              </div>
              {ext.map(e => (
                <div key={e.time} style={S.line}>
                  {e.kind} tide {e.time.slice(11, 16)} UTC ({e.time.slice(5, 10)}): {e.level.toFixed(2)} m
                </div>
              ))}
              <p style={S.hint}>
                Model grid {d.grid_lat?.toFixed(2)}°N {d.grid_lon?.toFixed(2)}°E — open Atlantic, ~8 km. It gives tidal
                <i> phase and range</i> for the outlet channel (flow reverses with the tide), not conditions inside the lagoon.
                Times are UTC (Iceland is UTC year-round).
              </p>
            </>
          )
        })()}
      </div>
    </section>
  )
}
