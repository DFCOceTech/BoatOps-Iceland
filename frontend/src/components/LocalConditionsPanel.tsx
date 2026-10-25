import { useFetch } from '../hooks/useFetch'
import { getNearbyStations } from '../api/client'
import { useSite } from '../context/SiteContext'

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
             textTransform: 'uppercase', margin: '0 0 8px' },
  card:    { background: '#141621', borderRadius: 6, padding: '10px 12px' },
  line:    { fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 },
  hint:    { fontSize: 10, color: '#475569', marginTop: 6, lineHeight: 1.5 },
}

const STALE_MIN = 60
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8]
const fmt = (v: number | null, dp = 0, u = '') => v == null ? '—' : `${v.toFixed(dp)}${u}`

export default function LocalConditionsPanel() {
  const { active } = useSite()
  const st = useFetch(() => getNearbyStations(active.lat, active.lon))

  return (
    <section style={S.section}>
      <p style={S.heading}>Local Conditions (nearest stations)</p>
      <div style={S.card}>
        {st.loading && <div style={S.line}>Loading…</div>}
        {st.error && <div style={{ ...S.line, color: '#f87171' }}>{st.error}</div>}
        {st.data && st.data.stations.length === 0 && (
          <div style={S.line}>No automatic stations with a current reading within 60 km.</div>
        )}
        {st.data?.stations.map(s => {
          const stale = s.age_min == null || s.age_min > STALE_MIN
          return (
            <div key={s.id} style={{ ...S.line, marginBottom: 6, opacity: stale ? 0.55 : 1 }}
                 data-testid="station-row">
              <b>{s.name}</b>{' '}
              <span style={{ color: '#64748b' }}>
                {s.distance_km.toFixed(0)} km {compass(s.bearing_deg)}
                {s.elevation_m != null && ` · ${s.elevation_m.toFixed(0)} m`}
              </span>
              <br />
              {fmt(s.t, 1, ' °C')} · wind <b>{fmt(s.f, 1)}</b> (gust {fmt(s.fg, 1)}) m/s {s.d_txt ?? ''}
              {s.p != null && ` · ${s.p.toFixed(0)} hPa`}
              {s.rh != null && ` · RH ${s.rh.toFixed(0)}%`}
              {s.r != null && ` · ${s.r.toFixed(1)} mm/h`}
              <br />
              <span style={{ fontSize: 10, color: stale ? '#fbbf24' : '#475569' }}>
                {s.time ? `${s.time.slice(11, 16)} UTC` : 'no time'}
                {s.age_min != null && ` (${s.age_min} min ago)`}{stale && ' — STALE'}
              </span>
            </div>
          )
        })}
        <p style={S.hint}>
          Icelandic Met Office and Road Administration (umferdin.is) automatic stations, 10-min observations.
          Land sites, not the lagoon — wind at the water can differ, especially off the glacier.
        </p>
      </div>
    </section>
  )
}
