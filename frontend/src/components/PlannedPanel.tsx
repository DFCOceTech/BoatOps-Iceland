import { usePlanned } from '../context/PlannedContext'
import type { PlannedAcquisition } from '../context/PlannedContext'

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
             textTransform: 'uppercase', margin: '0 0 8px' },
  card:    { background: '#141621', borderRadius: 6, padding: '8px 12px', marginBottom: 8 },
  row:     { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  btn:     { fontSize: 11, padding: '3px 8px', background: '#2d3148', color: '#e2e8f0',
             border: '1px solid #3b4160', borderRadius: 4, cursor: 'pointer' },
  link:    { fontSize: 11, color: '#38bdf8', textDecoration: 'none' },
  hint:    { fontSize: 10, color: '#475569', lineHeight: 1.5, marginTop: 4 },
}

const fmt = (iso: string) => new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

function download(name: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

export function toCsv(list: PlannedAcquisition[]): string {
  const head = ['platform', 'aos_utc', 'los_utc', 'max_elev_deg', 'site', 'lat', 'lon', 'west', 'south', 'east', 'north',
                'availability', 'access', 'query_label', 'query_url']
  const rows = list.flatMap(p => (p.queries.length ? p.queries : [{ label: '', url: '' }]).map(q => [
    p.platform, p.aos_utc, p.los_utc, p.max_elevation_deg, p.site.name, p.site.lat, p.site.lon,
    p.bbox.west, p.bbox.south, p.bbox.east, p.bbox.north, p.availability, p.access, q.label, q.url,
  ]))
  return [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
}

/** Overpasses ticked in the Satellite table, with the queries needed to fetch each product later. */
export default function PlannedPanel() {
  const { planned, remove, clear, error } = usePlanned()
  const now = Date.now()

  return (
    <section style={S.section}>
      <p style={S.heading}>Planned acquisitions ({planned.length})</p>
      {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 6 }}>⚠ {error}</div>}
      {planned.length === 0 && (
        <div style={S.hint}>Tick the box on a satellite pass to save what's needed to find and download it after it has been acquired.</div>
      )}
      {planned.map(p => {
        const passed = new Date(p.los_utc).getTime() + 10 * 60_000 < now
        return (
          <div key={p.key} style={S.card}>
            <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 700 }}>
              {p.platform} <span style={{ color: passed ? '#4ade80' : '#fbbf24', fontWeight: 400 }}>
                {passed ? '· acquired — check for data' : '· upcoming'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {fmt(p.aos_utc)} · max elev {p.max_elevation_deg.toFixed(0)}° · {p.site.name} ({p.site.lat.toFixed(3)}, {p.site.lon.toFixed(3)})
            </div>
            <div style={S.hint}>Availability: {p.availability}. Access: {p.access}.</div>
            <div style={S.row}>
              {p.queries.map(q => (
                <a key={q.url} href={q.url} target="_blank" rel="noopener noreferrer" style={S.link} title={q.note ?? q.label}>
                  ↗ {q.label.split(' — ')[0]}
                </a>
              ))}
              <button style={S.btn} onClick={() => remove(p.key)} aria-label={`Remove ${p.platform} ${p.aos_utc}`}>Remove</button>
            </div>
          </div>
        )
      })}
      {planned.length > 0 && (
        <div style={S.row}>
          <button style={S.btn} onClick={() => download('boatops-iceland-acquisitions.json', 'application/json', JSON.stringify(planned, null, 2))}>
            Export JSON
          </button>
          <button style={S.btn} onClick={() => download('boatops-iceland-acquisitions.csv', 'text/csv', toCsv(planned))}>
            Export CSV
          </button>
          <button style={S.btn} onClick={clear}>Clear all</button>
        </div>
      )}
    </section>
  )
}
