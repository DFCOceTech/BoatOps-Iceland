import { useMemo, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { getWeatherForecast, getWeatherAdvisories } from '../api/client'
import { useGoNoGo } from '../context/GoNoGoContext'
import { useTimeContext } from '../context/TimeContext'

const CENTER = { lat: 54.18, lon: 12.08 }

function WindArrow({ degrees }: { degrees: number }) {
  const rad = (degrees * Math.PI) / 180
  const tx = Math.sin(rad) * 8
  const ty = -Math.cos(rad) * 8
  return (
    <svg width={22} height={22} viewBox="-11 -11 22 22" aria-hidden>
      <circle r={10} fill="none" stroke="#2d3148" strokeWidth={1.5} />
      <line x1={0} y1={0} x2={tx} y2={ty}
        stroke="#38bdf8" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={tx} cy={ty} r={1.8} fill="#38bdf8" />
    </svg>
  )
}

function formatXLabel(isoTime: string): string {
  const d = new Date(isoTime + 'Z')
  const h = d.getUTCHours()
  if (h === 0) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]
  return `${h.toString().padStart(2, '0')}h`
}

// Thresholds in m/s: Bft 4 ≈ 7.9 m/s (caution), Bft 6 ≈ 12.5 m/s (no-go)
function windClass(ms: number): string {
  if (ms <= 8)  return '#22c55e'
  if (ms <= 13) return '#f59e0b'
  return '#ef4444'
}

const S: Record<string, React.CSSProperties> = {
  section:    { marginBottom: 24 },
  heading:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
                textTransform: 'uppercase', margin: '0 0 10px' },
  card:       { background: '#141621', borderRadius: 6, padding: '10px 12px', marginBottom: 10 },
  cardRow:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  bigVal:     { fontSize: 22, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 },
  unit:       { fontSize: 12, color: '#64748b', marginLeft: 2 },
  metaGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 },
  metaKey:    { color: '#64748b' },
  metaVal:    { color: '#cbd5e1' },
  errBox:     { color: '#f87171', fontSize: 12, padding: '8px 0' },
  subHead:    { fontSize: 11, color: '#64748b', margin: '0 0 6px', fontWeight: 600 },
  refBtn:     { background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
                fontSize: 13, padding: 0, float: 'right' },
  badge:      { fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#2d3148',
                color: '#64748b', float: 'right', marginTop: 2 },
  timeBadge:  { fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#1a2035',
                color: '#38bdf8', marginLeft: 6, verticalAlign: 'middle' },
}

export default function WeatherPanel() {
  const forecast = useFetch(() => getWeatherForecast(CENTER.lat, CENTER.lon))
  const advisories = useFetch(() => getWeatherAdvisories('DE'))
  const { update, refreshSignal } = useGoNoGo()
  const { forecastHour } = useTimeContext()

  const cur = forecast.data

  // Push conditions at selected hour to Go/No-Go context
  useEffect(() => {
    if (!cur) return
    const h = Math.min(forecastHour, cur.wind_speed_ms.length - 1)
    update({
      windKt:   cur.wind_speed_kt[h],
      gustKt:   cur.gust_speed_kt[h],
      cloudPct: cur.cloud_cover_pct[h],
    })
  }, [cur, forecastHour, update])

  useEffect(() => {
    if (refreshSignal === 0) return
    forecast.refetch()
    advisories.refetch()
  }, [refreshSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const h = cur ? Math.min(forecastHour, cur.wind_speed_ms.length - 1) : 0
  const current = cur ? {
    wind_ms:   cur.wind_speed_ms[h],
    wind_dir:  cur.wind_dir_deg[h],
    gust_ms:   cur.gust_speed_ms[h],
    temp_c:    cur.temperature_c[h],
    cloud_pct: cur.cloud_cover_pct[h],
    precip_mm: cur.precipitation_mm[h],
    time:      cur.times[h],
  } : null

  // Chart: thin to every 6 hours for readability
  const chartData = useMemo(() => {
    if (!cur) return []
    return cur.times
      .map((t, i) => ({
        time: formatXLabel(t),
        wind:  parseFloat((cur.wind_speed_ms[i] ?? 0).toFixed(1)),
        gust:  parseFloat((cur.gust_speed_ms[i] ?? 0).toFixed(1)),
        cloud: Math.round(cur.cloud_cover_pct[i] ?? 0),
      }))
      .filter((_, i) => i % 6 === 0)
  }, [cur])

  const advisoryCount = advisories.data?.features.length ?? 0

  return (
    <section style={S.section}>
      <p style={S.heading}>
        Weather
        {advisoryCount > 0 && (
          <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 700 }}>
            ⚠ {advisoryCount} {advisoryCount === 1 ? 'advisory' : 'advisories'}
          </span>
        )}
        <button style={S.refBtn} onClick={forecast.refetch} title="Refresh">↻</button>
      </p>

      {forecast.error && <p style={S.errBox}>⚠ {forecast.error}</p>}
      {forecast.loading && !forecast.data && (
        <p style={{ color: '#64748b', fontSize: 12 }}>Loading…</p>
      )}

      {current && (
        <div style={S.card}>
          {forecastHour > 0 && (
            <div style={{ fontSize: 10, color: '#38bdf8', marginBottom: 6 }}>
              {new Date(current.time + 'Z').toLocaleString('en-GB', {
                weekday: 'short', month: 'short', day: '2-digit',
                hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
              })} UTC
            </div>
          )}
          <div style={S.cardRow}>
            <WindArrow degrees={current.wind_dir} />
            <span style={{ ...S.bigVal, color: windClass(current.wind_ms) }}>
              {current.wind_ms.toFixed(1)}
            </span>
            <span style={S.unit}>m/s</span>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 4 }}>
              gusts {current.gust_ms.toFixed(1)} m/s
            </span>
          </div>
          <div style={S.metaGrid}>
            <span style={S.metaKey}>Temperature</span>
            <span style={S.metaVal}>{current.temp_c.toFixed(1)} °C</span>
            <span style={S.metaKey}>Cloud cover</span>
            <span style={S.metaVal}>{Math.round(current.cloud_pct)} %</span>
            <span style={S.metaKey}>Precipitation</span>
            <span style={S.metaVal}>{current.precip_mm.toFixed(1)} mm/h</span>
            <span style={S.metaKey}>Wind from</span>
            <span style={S.metaVal}>{Math.round(current.wind_dir)}°</span>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <>
          <p style={S.subHead}>
            7-day forecast
            {cur?.last_updated && (
              <span style={S.badge}>{cur.last_updated}</span>
            )}
          </p>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} interval={3} />
              <YAxis yAxisId="w" domain={[0, 25]} tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis yAxisId="c" orientation="right" domain={[0, 100]}
                tick={{ fontSize: 9, fill: '#475569' }} />
              <Tooltip
                contentStyle={{ background: '#141621', border: '1px solid #2d3148',
                  fontSize: 11, color: '#cbd5e1' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(val, name) => [
                  name === 'Cloud %' ? `${val}%` : `${val} m/s`, name
                ]}
              />
              <Area yAxisId="c" dataKey="cloud" fill="#334155" stroke="none"
                opacity={0.5} name="Cloud %" />
              <Area yAxisId="w" dataKey="gust" fill="#38bdf8" stroke="none"
                opacity={0.12} name="Gusts (m/s)" />
              <Line yAxisId="w" dataKey="wind" stroke="#38bdf8" dot={false}
                strokeWidth={2} name="Wind (m/s)" />
              {/* Bft 4 ≈ 7.9 m/s (caution), Bft 6 ≈ 12.5 m/s (no-go) */}
              <ReferenceLine yAxisId="w" y={8}  stroke="#f59e0b"
                strokeDasharray="4 3" strokeWidth={1} />
              <ReferenceLine yAxisId="w" y={13} stroke="#ef4444"
                strokeDasharray="4 3" strokeWidth={1} />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  )
}
