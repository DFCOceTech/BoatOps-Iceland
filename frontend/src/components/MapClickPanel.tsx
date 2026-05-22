import { useState, useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { useTimeContext } from '../context/TimeContext'
import { getWaveForecast, getWeatherForecast } from '../api/client'
import { injectDarkPopupStyles } from '../utils/popupStyles'

// ── Thresholds (mirrors GoNoDashboard defaults + localStorage) ────────────────

const LS_KEY = 'boatops-thresholds'
const THRESH_DEFAULTS = { windGreenMax: 15, windAmberMax: 25, gustGreenMax: 20, gustAmberMax: 30, hsGreenMax: 0.4, hsAmberMax: 0.8 }

function loadThresholds() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...THRESH_DEFAULTS, ...JSON.parse(raw) } : THRESH_DEFAULTS
  } catch { return THRESH_DEFAULTS }
}

function scoreVal(v: number, greenMax: number, amberMax: number): 'green' | 'amber' | 'red' {
  return v <= greenMax ? 'green' : v <= amberMax ? 'amber' : 'red'
}

const DOT_COLOR = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }
const VERDICT_LABEL = { green: 'GO', amber: 'CAUTION', red: 'NO-GO' }
const VERDICT_BG    = { green: '#052e16', amber: '#292524', red: '#2d0a0a' }

// ── Popup HTML builder ────────────────────────────────────────────────────────

interface AssessmentData {
  lat: number; lon: number
  hs: number; waveTimestamp: string; gridLat: number; gridLon: number
  windKt: number; gustKt: number; forecastTimestamp: string
}

function buildPopupHTML(d: AssessmentData): string {
  const t = loadThresholds()
  const sWave = scoreVal(d.hs,     t.hsGreenMax,   t.hsAmberMax)
  const sWind = scoreVal(d.windKt, t.windGreenMax,  t.windAmberMax)
  const sGust = scoreVal(d.gustKt, t.gustGreenMax,  t.gustAmberMax)
  const worst = [sWave, sWind, sGust].includes('red') ? 'red' : [sWave, sWind, sGust].includes('amber') ? 'amber' : 'green'

  const dot = (s: 'green'|'amber'|'red') =>
    `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${DOT_COLOR[s]};margin-right:6px;flex-shrink:0"></span>`

  const row = (label: string, value: string, s: 'green'|'amber'|'red') =>
    `<div style="display:flex;align-items:center;padding:3px 0;font-size:12px">
      ${dot(s)}<span style="flex:1;color:#94a3b8">${label}</span>
      <span style="color:${DOT_COLOR[s]};font-weight:600">${value}</span>
    </div>`

  return `
    <div style="padding:10px 12px;min-width:200px">
      <div style="font-size:11px;color:#64748b;margin-bottom:6px">
        ${d.lat.toFixed(4)}°N &nbsp;${d.lon.toFixed(4)}°E
      </div>
      <div style="background:${VERDICT_BG[worst]};color:${DOT_COLOR[worst]};
        padding:5px 10px;border-radius:4px;font-weight:800;font-size:14px;
        text-align:center;letter-spacing:.05em;margin-bottom:8px">
        ${VERDICT_LABEL[worst]}
      </div>
      <div style="border-top:1px solid #2d3148;padding-top:6px">
        ${row('Waves Hs', d.hs.toFixed(2)+' m', sWave)}
        ${row('Wind', d.windKt.toFixed(1)+' kt', sWind)}
        ${row('Gusts', d.gustKt.toFixed(1)+' kt', sGust)}
      </div>
      <div style="font-size:10px;color:#334155;margin-top:6px;line-height:1.5">
        Wind: ${d.forecastTimestamp}<br>
        Waves: ${d.waveTimestamp} · nearest wet cell ${d.gridLat.toFixed(2)}°N ${d.gridLon.toFixed(2)}°E
      </div>
    </div>`
}

const LOADING_HTML = `
  <div style="padding:12px;font-size:12px;color:#94a3b8;min-width:160px;text-align:center">
    ⟳ Fetching assessment…
  </div>`

const ERROR_HTML = (msg: string) => `
  <div style="padding:10px 12px;font-size:12px;color:#f87171;min-width:160px">
    ⚠ ${msg}
  </div>`

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  section:  { marginBottom: 24 },
  heading:  { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
              textTransform: 'uppercase', margin: '0 0 8px' },
  row:      { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1',
              cursor: 'pointer', userSelect: 'none' },
  checkbox: { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  hint:     { fontSize: 10, color: '#334155', marginTop: 6, paddingLeft: 23 },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapClickPanel() {
  const { map } = useMapContext()
  const { forecastHour } = useTimeContext()
  const [enabled, setEnabled] = useState(false)

  const popupRef        = useRef<maplibregl.Popup | null>(null)
  const abortRef        = useRef<AbortController | null>(null)
  const forecastHourRef = useRef(forecastHour)
  forecastHourRef.current = forecastHour

  useEffect(() => { injectDarkPopupStyles() }, [])

  const handleClick = useCallback(async (e: maplibregl.MapMouseEvent) => {
    if (!map) return
    const { lng, lat } = e.lngLat

    // Abort any in-flight fetch
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    // Close old popup, open new one at click location with loading state
    popupRef.current?.remove()
    const popup = new maplibregl.Popup({
      className: 'boatops-popup',
      maxWidth: '280px',
      closeButton: true,
      closeOnClick: false,
    })
      .setLngLat([lng, lat])
      .setHTML(LOADING_HTML)
      .addTo(map)
    popupRef.current = popup

    try {
      const [wave, wx] = await Promise.all([
        getWaveForecast(lat, lng),
        getWeatherForecast(lat, lng),
      ])
      if (signal.aborted) return

      const h = Math.min(forecastHourRef.current, wx.wind_speed_kt.length - 1)
      const wxTime = wx.times[h] ?? ''
      const data: AssessmentData = {
        lat, lon: lng,
        hs: wave.hs_m,
        waveTimestamp: wave.timestamp.replace('T', ' ').slice(0, 16),
        gridLat: wave.grid_lat,
        gridLon: wave.grid_lon,
        windKt: wx.wind_speed_kt[h],
        gustKt: wx.gust_speed_kt[h],
        forecastTimestamp: wxTime.replace('T', ' ').slice(0, 16) + ' UTC',
      }
      if (!signal.aborted) popup.setHTML(buildPopupHTML(data))
    } catch (err) {
      if (!signal.aborted) popup.setHTML(ERROR_HTML(err instanceof Error ? err.message : 'fetch failed'))
    }
  }, [map])

  // Register / deregister click handler and cursor
  useEffect(() => {
    if (!map) return
    if (enabled) {
      map.getCanvas().style.cursor = 'crosshair'
      map.on('click', handleClick)
      return () => {
        map.getCanvas().style.cursor = ''
        map.off('click', handleClick)
        popupRef.current?.remove()
        abortRef.current?.abort()
      }
    } else {
      map.getCanvas().style.cursor = ''
      popupRef.current?.remove()
      abortRef.current?.abort()
    }
  }, [map, enabled, handleClick])

  return (
    <section style={S.section}>
      <p style={S.heading}>Location Assessment</p>
      <label style={S.row}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={enabled}
          onChange={() => setEnabled(v => !v)}
        />
        Click map for Go/No-Go assessment
      </label>
      {enabled && (
        <p style={S.hint}>
          Click anywhere — shows waves, wind &amp; verdict at current planning hour
        </p>
      )}
    </section>
  )
}
