import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { getMarineForecast } from '../api/client'
import { useSite } from '../context/SiteContext'
import { useTimeContext } from '../context/TimeContext'
import { findExtrema } from '../utils/tide'

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
             textTransform: 'uppercase', margin: '0 0 8px' },
  card:    { background: '#141621', borderRadius: 6, padding: '10px 12px' },
  day:     { display: 'grid', gridTemplateColumns: '46px 1fr', gap: 8, fontSize: 11, color: '#cbd5e1',
             padding: '4px 0', borderBottom: '1px solid #1e2030' },
  hint:    { fontSize: 10, color: '#475569', marginTop: 6, lineHeight: 1.5 },
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayLabel = (iso: string) => DAYS[new Date(iso + 'Z').getUTCDay()]

/**
 * 7-day tide curve for the active site's coastal reference point, with high/low times.
 * The "now" line follows the global plan-time slider.
 */
export default function TidePanel() {
  const { active } = useSite()
  const { forecastHour } = useTimeContext()
  const marine = useFetch(() => getMarineForecast(active.lat, active.lon))
  const d = marine.data

  const view = useMemo(() => {
    if (!d) return null
    const nowIso = new Date().toISOString().slice(0, 13) + ':00'
    const nowIdx = d.times.findIndex(t => t >= nowIso)
    const data = d.times.map((t, i) => ({ time: t, level: d.sea_level_m[i] }))
    const ticks = d.times.filter(t => t.endsWith('T00:00'))
    const ext = findExtrema(d.times, d.sea_level_m, d.times[0], d.times.length)
    const byDay = new Map<string, typeof ext>()
    ext.filter(e => nowIdx < 0 || e.time >= nowIso.slice(0, 11) + '00:00').forEach(e => {
      const k = e.time.slice(0, 10)
      byDay.set(k, [...(byDay.get(k) ?? []), e])
    })
    const planTime = nowIdx >= 0 ? d.times[Math.min(nowIdx + forecastHour, d.times.length - 1)] : null
    return { data, ticks, byDay, planTime, expired: nowIdx < 0 }
  }, [d, forecastHour])

  return (
    <section style={S.section}>
      <p style={S.heading}>Tides — 7 day</p>
      <div style={S.card}>
        {marine.loading && !d && <div style={{ fontSize: 12, color: '#64748b' }}>Loading…</div>}
        {marine.error && <div style={{ fontSize: 12, color: '#f87171' }}>{marine.error}</div>}
        {view?.expired && <div style={{ fontSize: 12, color: '#f59e0b' }}>Forecast has expired — reload the page.</div>}
        {view && !view.expired && (
          <>
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={view.data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                <XAxis dataKey="time" ticks={view.ticks} tickFormatter={dayLabel}
                  tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} unit=" m" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#1e2030', border: '1px solid #2d3148', fontSize: 11 }}
                  labelFormatter={(l) => { const t = String(l); return `${dayLabel(t)} ${t.slice(5, 10)} ${t.slice(11, 16)} UTC` }}
                  formatter={(v) => [`${Number(v).toFixed(2)} m`, 'Sea level']} />
                <ReferenceLine y={0} stroke="#334155" />
                {view.ticks.map(t => <ReferenceLine key={t} x={t} stroke="#1e2030" />)}
                {view.planTime && <ReferenceLine x={view.planTime} stroke="#22d3ee" strokeDasharray="3 3" />}
                <Area type="monotone" dataKey="level" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.18}
                  strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 6 }}>
              {[...view.byDay.entries()].map(([day, list]) => (
                <div key={day} style={S.day}>
                  <b>{dayLabel(day)} {day.slice(8)}</b>
                  <span>
                    {list.map(e => `${e.kind === 'High' ? '▲' : '▼'} ${e.time.slice(11, 16)} ${e.level.toFixed(1)} m`).join('   ')}
                  </span>
                </div>
              ))}
            </div>
            <p style={S.hint}>
              Heights are relative to mean sea level at the ~8 km offshore model point ({d?.grid_lat?.toFixed(2)}°N,
              {' '}{d?.grid_lon?.toFixed(2)}°E); includes surge. Use for tidal timing and range at the outlet,
              not lagoon water level. Times UTC. Dashed line = plan time.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
