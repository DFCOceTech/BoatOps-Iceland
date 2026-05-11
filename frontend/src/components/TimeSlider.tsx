import { useMemo } from 'react'
import { useTimeContext } from '../context/TimeContext'

const HOURS = 167  // 7 days, 0-indexed

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatSliderTime(baseMs: number, offsetHours: number): string {
  const d = new Date(baseMs + offsetHours * 3600_000)
  return `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]} ` +
         `${pad2(d.getUTCDate())} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]} ` +
         `${pad2(d.getUTCHours())}:00 UTC`
}

export default function TimeSlider() {
  const { forecastHour, setForecastHour } = useTimeContext()

  // Snap the base time to the current UTC hour at component mount
  const baseMs = useMemo(() => {
    const now = new Date()
    now.setUTCMinutes(0, 0, 0)
    return now.getTime()
  }, [])

  // Build day-boundary tick marks (every 24 h, starting at h=24)
  const dayTicks = useMemo(() => {
    const ticks: { hour: number; label: string }[] = []
    for (let h = 24; h <= HOURS; h += 24) {
      const d = new Date(baseMs + h * 3600_000)
      ticks.push({
        hour: h,
        label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()],
      })
    }
    return ticks
  }, [baseMs])

  const selectedLabel = formatSliderTime(baseMs, forecastHour)

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 380,    // sidebar width — keeps slider in the map area
      background: 'rgba(14,15,22,0.92)',
      borderTop: '1px solid #2d3148',
      padding: '6px 16px 8px',
      zIndex: 10,
      userSelect: 'none',
    }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#475569',
          letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Plan time
        </span>
        <span style={{ fontSize: 11, color: forecastHour === 0 ? '#22c55e' : '#38bdf8', fontWeight: 600 }}>
          {forecastHour === 0 ? 'Now' : selectedLabel}
        </span>
        {forecastHour > 0 && (
          <button
            onClick={() => setForecastHour(0)}
            style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none',
              cursor: 'pointer', padding: '0 4px', marginLeft: 'auto' }}
            title="Jump to now"
          >
            ↺ Now
          </button>
        )}
      </div>

      {/* Slider + day tick marks */}
      <div style={{ position: 'relative' }}>
        <input
          type="range"
          min={0}
          max={HOURS}
          step={1}
          value={forecastHour}
          onChange={e => setForecastHour(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', margin: 0 }}
          aria-label="Planning time"
        />
        {/* Day labels positioned below the track */}
        <div style={{ position: 'relative', height: 14, marginTop: 1 }}>
          {dayTicks.map(tick => (
            <span
              key={tick.hour}
              style={{
                position: 'absolute',
                left: `${(tick.hour / HOURS) * 100}%`,
                transform: 'translateX(-50%)',
                fontSize: 9,
                color: Math.abs(tick.hour - forecastHour) < 12 ? '#38bdf8' : '#334155',
                fontWeight: 600,
                letterSpacing: '0.04em',
                pointerEvents: 'none',
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
