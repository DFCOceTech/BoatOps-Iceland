import { useEffect, useRef } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getSolarTimes, getSolarElevation } from '../api/client'
import { useGoNoGo } from '../context/GoNoGoContext'

const CENTER = { lat: 54.18, lon: 12.08 }
const BERLIN_TZ = 'Europe/Berlin'

// Python isoformat() emits "+00:00" not "Z"; new Date() handles both correctly.
// Only bare strings (no timezone) need a "Z" appended to be treated as UTC.
function parseIso(iso: string): Date {
  return (iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso))
    ? new Date(iso)
    : new Date(iso + 'Z')
}

function toLocalTime(isoUtc: string | null): string {
  if (!isoUtc) return '—'
  const d = parseIso(isoUtc)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN_TZ, hour: '2-digit', minute: '2-digit',
  }).format(d)
}

const PERIOD_LABELS: Record<string, string> = {
  day:                   'Day',
  civil_twilight:        'Civil twilight',
  nautical_twilight:     'Nautical twilight',
  astronomical_twilight: 'Astronomical twilight',
  night:                 'Night',
}

const PERIOD_COLORS: Record<string, string> = {
  day:                   '#fbbf24',
  civil_twilight:        '#60a5fa',
  nautical_twilight:     '#818cf8',
  astronomical_twilight: '#6d28d9',
  night:                 '#475569',
}

function ElevationGauge({ elevation_deg }: { elevation_deg: number }) {
  const cx = 70, cy = 78, r = 60
  // Map elevation (0°=horizon, 90°=zenith) to SVG arc angle (180°=left, 90°=top)
  const fillEl = Math.max(0, elevation_deg)
  const pointerEl = Math.max(0, Math.min(90, elevation_deg))
  const pointerRad = (180 - pointerEl) * Math.PI / 180
  const px = cx + r * 0.85 * Math.cos(pointerRad)
  const py = cy - r * 0.85 * Math.sin(pointerRad)
  const fillRad = (180 - fillEl) * Math.PI / 180
  const fx = cx + r * Math.cos(fillRad)
  const fy = cy - r * Math.sin(fillRad)
  const below = elevation_deg < 0
  const arcColor = below ? '#475569' : '#fbbf24'

  return (
    <svg width={140} height={92} aria-label={`Solar elevation ${elevation_deg.toFixed(1)}°`}>
      {/* Background semicircle */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#2d3148" strokeWidth={7} strokeLinecap="round" />
      {/* Filled arc from 0° to current elevation */}
      {fillEl > 1 && (
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${fx} ${fy}`}
          fill="none" stroke="#fbbf24" strokeWidth={7} strokeLinecap="round" />
      )}
      {/* Tick marks at 0, 30, 60, 90° */}
      {[0, 30, 60, 90].map(el => {
        const a = (180 - el) * Math.PI / 180
        return (
          <line key={el}
            x1={cx + (r - 4) * Math.cos(a)} y1={cy - (r - 4) * Math.sin(a)}
            x2={cx + (r + 5) * Math.cos(a)} y2={cy - (r + 5) * Math.sin(a)}
            stroke="#475569" strokeWidth={1.5} />
        )
      })}
      {/* Horizon baseline */}
      <line x1={cx - r - 6} y1={cy} x2={cx + r + 6} y2={cy}
        stroke="#334155" strokeWidth={1} />
      {/* Pointer */}
      <line x1={cx} y1={cy}
        x2={below ? cx - r * 0.7 : px} y2={below ? cy : py}
        stroke={arcColor} strokeWidth={2.5} strokeLinecap="round" />
      {/* Center pivot */}
      <circle cx={cx} cy={cy} r={3} fill="#94a3b8" />
      {/* Elevation readout */}
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={12} fontWeight={700}
        fill={arcColor}>
        {elevation_deg.toFixed(1)}°
      </text>
    </svg>
  )
}

const S: Record<string, React.CSSProperties> = {
  section:  { marginBottom: 24 },
  heading:  { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
              textTransform: 'uppercase', margin: '0 0 10px' },
  refBtn:   { background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
              fontSize: 13, padding: 0, float: 'right' },
  card:     { background: '#141621', borderRadius: 6, padding: '10px 12px', marginBottom: 10 },
  timeGrid: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 12 },
  timeKey:  { color: '#64748b' },
  timeVal:  { color: '#cbd5e1', textAlign: 'right' as const },
  badge:    { display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 10,
              fontWeight: 700, letterSpacing: '0.06em' },
  errBox:   { color: '#f87171', fontSize: 12, padding: '8px 0' },
}

export default function SolarPanel() {
  const times = useFetch(() => getSolarTimes(CENTER.lat, CENTER.lon))
  const elevation = useFetch(() => getSolarElevation(CENTER.lat, CENTER.lon))
  const { update, refreshSignal } = useGoNoGo()

  // Auto-refresh elevation every 60 s — use a ref so the effect doesn't re-run
  const refetchRef = useRef(elevation.refetch)
  refetchRef.current = elevation.refetch
  useEffect(() => {
    const id = setInterval(() => refetchRef.current(), 60_000)
    return () => clearInterval(id)
  }, [])

  // Push solar elevation to Go/No-Go context (updates every 60 s via refetch)
  const e = elevation.data
  useEffect(() => {
    if (e) update({ solarElevDeg: e.elevation_deg })
  }, [e, update])

  // Refresh when dashboard "↻" is clicked
  useEffect(() => {
    if (refreshSignal === 0) return
    times.refetch()
    elevation.refetch()
  }, [refreshSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = times.data
  const period = e?.period ?? 'night'
  const periodColor = PERIOD_COLORS[period] ?? '#94a3b8'
  const periodLabel = PERIOD_LABELS[period] ?? period

  return (
    <section style={S.section}>
      <p style={S.heading}>
        Solar
        <button style={S.refBtn} onClick={times.refetch} title="Refresh">↻</button>
      </p>

      {(times.error || elevation.error) && (
        <p style={S.errBox}>⚠ {times.error ?? elevation.error}</p>
      )}

      {e && (
        <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <ElevationGauge elevation_deg={e.elevation_deg} />
          <div>
            <span style={{ ...S.badge, background: periodColor + '33', color: periodColor }}>
              {periodLabel}
            </span>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              Az {Math.round(e.azimuth_deg)}°
            </div>
          </div>
        </div>
      )}

      {t && (
        <div style={S.card}>
          <div style={S.timeGrid}>
            <span style={S.timeKey}>Sunrise</span>
            <span style={S.timeVal}>{toLocalTime(t.sunrise)}</span>
            <span style={S.timeKey}>Solar noon</span>
            <span style={S.timeVal}>{toLocalTime(t.solar_noon)}</span>
            <span style={S.timeKey}>Sunset</span>
            <span style={S.timeVal}>{toLocalTime(t.sunset)}</span>
            <span style={S.timeKey}>Civil dawn / dusk</span>
            <span style={S.timeVal}>
              {toLocalTime(t.dawn_civil)} / {toLocalTime(t.dusk_civil)}
            </span>
            <span style={S.timeKey}>Nautical dawn / dusk</span>
            <span style={S.timeVal}>
              {toLocalTime(t.dawn_nautical)} / {toLocalTime(t.dusk_nautical)}
            </span>
            <span style={S.timeKey}>Astronomical dawn / dusk</span>
            <span style={S.timeVal}>
              {toLocalTime(t.dawn_astronomical)} / {toLocalTime(t.dusk_astronomical)}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 6, textAlign: 'right' }}>
            Local time (Berlin / CET/CEST)
          </div>
        </div>
      )}

      {times.loading && !t && (
        <p style={{ color: '#64748b', fontSize: 12 }}>Loading…</p>
      )}
    </section>
  )
}
