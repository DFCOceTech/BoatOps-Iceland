import { useState, useEffect } from 'react'
import { useGoNoGo } from '../context/GoNoGoContext'

// ── Thresholds ────────────────────────────────────────────────────────────────

export interface Thresholds {
  windGreenMax:   number   // kt
  windAmberMax:   number
  gustGreenMax:   number   // kt
  gustAmberMax:   number
  cloudGreenMax:  number   // %
  cloudAmberMax:  number
  solarGreenMin:  number   // degrees elevation (higher = better)
  solarAmberMin:  number
}

const DEFAULTS: Thresholds = {
  windGreenMax: 15, windAmberMax: 25,
  gustGreenMax: 20, gustAmberMax: 30,
  cloudGreenMax: 20, cloudAmberMax: 50,
  solarGreenMin: 10, solarAmberMin: 3,   // high-latitude: low sun is normal
}

const LS_KEY = 'boatops-iceland-thresholds'

function loadThresholds(): Thresholds {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch { return DEFAULTS }
}

// ── Status logic ──────────────────────────────────────────────────────────────

type Status = 'green' | 'amber' | 'red' | 'pending'

const STATUS_COLOR: Record<Status, string> = {
  green:   '#22c55e',
  amber:   '#f59e0b',
  red:     '#ef4444',
  pending: '#475569',
}

function lowerIsBetter(value: number | null, greenMax: number, amberMax: number): Status {
  if (value === null) return 'pending'
  if (value <= greenMax) return 'green'
  if (value <= amberMax) return 'amber'
  return 'red'
}

function higherIsBetter(value: number | null, greenMin: number, amberMin: number): Status {
  if (value === null) return 'pending'
  if (value >= greenMin) return 'green'
  if (value >= amberMin) return 'amber'
  return 'red'
}

type Verdict = 'go' | 'caution' | 'nogo' | 'pending'

function overallVerdict(statuses: Status[]): Verdict {
  if (statuses.some(s => s === 'pending')) return 'pending'
  if (statuses.some(s => s === 'red'))     return 'nogo'
  if (statuses.some(s => s === 'amber'))   return 'caution'
  return 'go'
}

const VERDICT_LABEL: Record<Verdict, string>  = {
  go: 'GO', caution: 'CAUTION', nogo: 'NO-GO', pending: 'AWAITING DATA',
}
const VERDICT_COLOR: Record<Verdict, string>  = {
  go: '#22c55e', caution: '#f59e0b', nogo: '#ef4444', pending: '#475569',
}
const VERDICT_BG: Record<Verdict, string>  = {
  go: '#052e16', caution: '#292524', nogo: '#2d0a0a', pending: '#1e2030',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  section:    { marginBottom: 24 },
  heading:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
                textTransform: 'uppercase', margin: '0 0 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn:    { background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
                fontSize: 14, padding: '0 2px', lineHeight: 1 },
  verdictBox: { borderRadius: 6, padding: '10px 14px', marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  verdictText:{ fontSize: 20, fontWeight: 800, letterSpacing: '0.06em' },
  subText:    { fontSize: 10, opacity: 0.6, marginTop: 2 },
  card:       { background: '#141621', borderRadius: 6, padding: '8px 12px', marginBottom: 8 },
  row:        { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                borderBottom: '1px solid #1e2030', fontSize: 12 },
  rowLast:    { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 },
  rowIcon:    { width: 16, textAlign: 'center' as const, flexShrink: 0 },
  rowLabel:   { flex: 1, color: '#94a3b8' },
  rowValue:   { color: '#cbd5e1', minWidth: 60, textAlign: 'right' as const },
  statusDot:  { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  aiRow:      { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                fontSize: 11, color: '#334155', fontStyle: 'italic' },
  timestamp:  { fontSize: 10, color: '#334155', textAlign: 'right' as const,
                marginTop: 4, paddingRight: 2 },
  // Settings modal
  overlay:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#1e2030', border: '1px solid #2d3148', borderRadius: 8,
                padding: 20, minWidth: 320, maxWidth: 360 },
  mHeading:   { fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: '0 0 14px' },
  mTable:     { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  mTh:        { color: '#475569', fontWeight: 600, padding: '4px 6px',
                textAlign: 'left' as const, borderBottom: '1px solid #2d3148' },
  mTd:        { padding: '5px 6px', color: '#94a3b8', borderBottom: '1px solid #1e2030' },
  mInput:     { width: 52, background: '#141621', border: '1px solid #334155',
                borderRadius: 4, color: '#e2e8f0', fontSize: 12, padding: '2px 6px',
                textAlign: 'right' as const },
  mUnit:      { color: '#475569', paddingLeft: 4 },
  mActions:   { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
  mBtn:       { background: '#2d3148', border: 'none', borderRadius: 4,
                color: '#94a3b8', cursor: 'pointer', fontSize: 12, padding: '5px 12px' },
  mBtnPrimary:{ background: '#38bdf8', border: 'none', borderRadius: 4,
                color: '#0c1a29', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                padding: '5px 12px' },
}

// ── Settings modal ────────────────────────────────────────────────────────────

function SettingsModal({
  thresholds,
  onSave,
  onClose,
}: {
  thresholds: Thresholds
  onSave: (t: Thresholds) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(thresholds)

  function num(field: keyof Thresholds) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value)
      if (!isNaN(v)) setDraft(d => ({ ...d, [field]: v }))
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <p style={S.mHeading}>Threshold Settings</p>
        <table style={S.mTable}>
          <thead>
            <tr>
              <th style={S.mTh}>Capability</th>
              <th style={{ ...S.mTh, textAlign: 'center' as const }}>Go (green)</th>
              <th style={{ ...S.mTh, textAlign: 'center' as const }}>Caution (amber)</th>
            </tr>
          </thead>
          <tbody>
            {([
              ['Wind',   'windGreenMax',  'windAmberMax',  'kt',  '≤',  '≤'],
              ['Gusts',  'gustGreenMax',  'gustAmberMax',  'kt',  '≤',  '≤'],
              ['Cloud',  'cloudGreenMax', 'cloudAmberMax', '%',   '≤',  '≤'],
              ['Solar',  'solarGreenMin', 'solarAmberMin', '°',   '≥',  '≥'],
            ] as const).map(([label, gField, aField, unit, gOp, aOp]) => (
              <tr key={label}>
                <td style={S.mTd}>{label}</td>
                <td style={{ ...S.mTd, textAlign: 'center' as const }}>
                  {gOp}&nbsp;
                  <input style={S.mInput} type="number" step="any"
                    value={draft[gField as keyof Thresholds]}
                    onChange={num(gField as keyof Thresholds)} />
                  <span style={S.mUnit}>{unit}</span>
                </td>
                <td style={{ ...S.mTd, textAlign: 'center' as const }}>
                  {aOp}&nbsp;
                  <input style={S.mInput} type="number" step="any"
                    value={draft[aField as keyof Thresholds]}
                    onChange={num(aField as keyof Thresholds)} />
                  <span style={S.mUnit}>{unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={S.mActions}>
          <button style={S.mBtn} onClick={() => { setDraft(DEFAULTS) }}>
            Reset defaults
          </button>
          <button style={S.mBtn} onClick={onClose}>Cancel</button>
          <button style={S.mBtnPrimary} onClick={() => { onSave(draft); onClose() }}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard panel ───────────────────────────────────────────────────────────

export default function GoNoDashboard() {
  const { values, triggerRefresh } = useGoNoGo()
  const [thresholds, setThresholds] = useState<Thresholds>(loadThresholds)
  const [showSettings, setShowSettings] = useState(false)

  // Persist thresholds whenever they change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(thresholds)) }
    catch { /* storage unavailable */ }
  }, [thresholds])

  const statuses = {
    wind:  lowerIsBetter(values.windKt,       thresholds.windGreenMax,  thresholds.windAmberMax),
    gust:  lowerIsBetter(values.gustKt,       thresholds.gustGreenMax,  thresholds.gustAmberMax),
    cloud: lowerIsBetter(values.cloudPct,     thresholds.cloudGreenMax, thresholds.cloudAmberMax),
    solar: higherIsBetter(values.solarElevDeg, thresholds.solarGreenMin, thresholds.solarAmberMin),
  }

  const verdict = overallVerdict(Object.values(statuses))
  const verdictColor = VERDICT_COLOR[verdict]
  const verdictBg    = VERDICT_BG[verdict]

  const rows: {
    icon: string; label: string; status: Status; display: string
  }[] = [
    {
      icon: '💨', label: 'Wind',
      status: statuses.wind,
      display: values.windKt !== null ? `${values.windKt.toFixed(1)} kt` : '—',
    },
    {
      icon: '💨', label: 'Gusts',
      status: statuses.gust,
      display: values.gustKt !== null ? `${values.gustKt.toFixed(1)} kt` : '—',
    },
    {
      icon: '☁', label: 'Cloud',
      status: statuses.cloud,
      display: values.cloudPct !== null ? `${Math.round(values.cloudPct)} %` : '—',
    },
    {
      icon: '☀', label: 'Solar',
      status: statuses.solar,
      display: values.solarElevDeg !== null ? `${values.solarElevDeg.toFixed(1)}°` : '—',
    },
  ]

  const lastUpdatedStr = values.lastUpdated
    ? new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).format(values.lastUpdated) + ' local'
    : 'awaiting data'

  return (
    <>
      <section style={S.section}>
        <div style={S.heading}>
          <span>Go / No-Go</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={S.iconBtn} onClick={triggerRefresh} title="Refresh all data">
              ↻
            </button>
            <button style={S.iconBtn} onClick={() => setShowSettings(true)} title="Threshold settings">
              ⚙
            </button>
          </div>
        </div>

        {/* Overall verdict */}
        <div style={{ ...S.verdictBox, background: verdictBg }}>
          <div>
            <div style={{ ...S.verdictText, color: verdictColor }}>
              {VERDICT_LABEL[verdict]}
            </div>
            <div style={{ ...S.subText, color: verdictColor }}>
              {verdict === 'pending'
                ? 'Loading data…'
                : verdict === 'go'
                  ? 'All conditions within limits'
                  : verdict === 'caution'
                    ? 'One or more conditions marginal'
                    : 'One or more conditions exceeded'}
            </div>
          </div>
        </div>

        {/* Per-capability rows */}
        <div style={S.card}>
          {rows.map((r, i) => (
            <div key={r.label} style={i < rows.length - 1 ? S.row : S.rowLast}>
              <span style={S.rowIcon}>{r.icon}</span>
              <span style={S.rowLabel}>{r.label}</span>
              <span style={{ ...S.rowValue,
                color: r.status === 'pending' ? '#475569' : STATUS_COLOR[r.status] }}>
                {r.display}
              </span>
              <span style={{
                ...S.statusDot,
                background: STATUS_COLOR[r.status],
                opacity: r.status === 'pending' ? 0.3 : 1,
              }} />
            </div>
          ))}
          {/* FR-16 AI synthesis placeholder */}
          <div style={S.aiRow}>
            <span style={S.rowIcon}>🤖</span>
            AI assessment: coming soon
          </div>
        </div>

        <div style={S.timestamp}>Updated {lastUpdatedStr}</div>
      </section>

      {showSettings && (
        <SettingsModal
          thresholds={thresholds}
          onSave={setThresholds}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}
