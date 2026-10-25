import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { useFetch } from '../hooks/useFetch'
import { getNearbyStations, type WeatherStation } from '../api/client'
import { useSite } from '../context/SiteContext'
import { useMapContext } from '../context/MapContext'

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

const summary = (s: WeatherStation) =>
  `${fmt(s.t, 1, ' °C')} · wind ${fmt(s.f, 1)} (gust ${fmt(s.fg, 1)}) m/s ${s.d_txt ?? ''}`.trim()

export default function LocalConditionsPanel() {
  const { active } = useSite()
  const { map } = useMapContext()
  const st = useFetch(() => getNearbyStations(active.lat, active.lon))

  // One orange square per station; the panel is re-keyed per site, so cleanup clears them.
  useEffect(() => {
    if (!map || !st.data) return
    const markers = st.data.stations.map(s => {
      const el = document.createElement('div')
      el.className = 'station-marker'
      el.title = `${s.name} — ${summary(s)}`
      el.style.cssText = 'width:12px;height:12px;background:#f59e0b;border:2px solid #0f172a;' +
        `border-radius:2px;cursor:pointer;opacity:${s.age_min == null || s.age_min > STALE_MIN ? 0.5 : 1}`
      const pop = document.createElement('div')
      pop.style.cssText = 'color:#0f172a;font-size:12px;line-height:1.4'
      const b = document.createElement('b'); b.textContent = s.name
      pop.append(b, document.createElement('br'), document.createTextNode(summary(s)),
        document.createElement('br'),
        document.createTextNode(s.time ? `${s.time.slice(11, 16)} UTC (${s.age_min ?? '?'} min ago)` : 'no time'))
      return new maplibregl.Marker({ element: el })
        .setLngLat([s.lon, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setDOMContent(pop))
        .addTo(map)
    })
    return () => markers.forEach(m => m.remove())
  }, [map, st.data])

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
