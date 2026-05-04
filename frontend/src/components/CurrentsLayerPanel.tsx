import { useState, useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { getCurrentsGrid } from '../api/client'
import type { WindGrid } from '../api/client'

const AOI = { west: 9.5, south: 53.5, east: 15.0, north: 56.0 }
const PARTICLE_COUNT  = 500
const TARGET_PX_PER_S = 80    // slower than wind — ocean currents are subtle
const MIN_SPEED_FRAC  = 0.20
const FADE_ALPHA      = 0.030
const MS_TO_KT        = 1.944

function getCurrentAt(lat: number, lon: number, g: WindGrid): [number, number] {
  const [west, south, east, north] = g.bbox
  const fx = ((lon - west)  / (east  - west))  * (g.width  - 1)
  const fy = ((lat - south) / (north - south)) * (g.height - 1)
  const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(x0 + 1, g.width  - 1)
  const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(y0 + 1, g.height - 1)
  const tx = fx - x0, ty = fy - y0
  const bi = (arr: number[][]): number =>
    (arr[y0][x0] ?? 0) * (1 - tx) * (1 - ty) +
    (arr[y0][x1] ?? 0) *      tx  * (1 - ty) +
    (arr[y1][x0] ?? 0) * (1 - tx) *      ty  +
    (arr[y1][x1] ?? 0) *      tx  *      ty
  return [bi(g.u), bi(g.v)]
}

// cmocean.speed approximation: dark navy → teal → lime
function speedColor(speed: number, vmax: number): string {
  const t = Math.pow(Math.min(speed / vmax, 1), 0.6)
  const h = Math.round(230 - t * 150)
  const s = Math.round(60 + t * 30)
  const l = Math.round(25 + t * 40)
  return `hsla(${h},${s}%,${l}%,0.85)`
}

interface Particle { lat: number; lon: number; age: number; maxAge: number }

function spawn(g: WindGrid): Particle {
  const [w, s, e, n] = g.bbox
  const maxAge = 100 + Math.floor(Math.random() * 250)
  return {
    lon:    w + Math.random() * (e - w),
    lat:    s + Math.random() * (n - s),
    age:    Math.floor(Math.random() * maxAge),  // never exceeds maxAge at birth
    maxAge,
  }
}

function initParticles(g: WindGrid): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => spawn(g))
}

function tickParticle(
  p: Particle, g: WindGrid, map: maplibregl.Map,
  ctx: CanvasRenderingContext2D, dt: number, degPerSec_max: number,
) {
  // guard: calm grid or zero-speed cell — respawn instead of NaN-ing
  if (g.vmax_speed === 0) { Object.assign(p, spawn(g)); return }

  const [u, v] = getCurrentAt(p.lat, p.lon, g)
  const speed  = Math.sqrt(u * u + v * v)
  if (speed < 0.01) { Object.assign(p, spawn(g)); return }

  const rel       = Math.min(speed / g.vmax_speed, 1)
  const degPerSec = degPerSec_max * (MIN_SPEED_FRAC + rel * (1 - MIN_SPEED_FRAC))
  const ux = u / speed, uy = v / speed
  const cosLat = Math.cos(p.lat * Math.PI / 180)

  const dLat = uy * degPerSec * dt
  const dLon = (ux / cosLat) * degPerSec * dt

  const oldPx = map.project([p.lon, p.lat])
  p.lat += dLat
  p.lon += dLon
  const newPx = map.project([p.lon, p.lat])

  ctx.beginPath()
  ctx.strokeStyle = speedColor(speed, g.vmax_speed)
  ctx.lineWidth   = 1.2
  ctx.moveTo(oldPx.x, oldPx.y)
  ctx.lineTo(newPx.x, newPx.y)
  ctx.stroke()

  p.age++
  const [w, s, e, n] = g.bbox
  if (p.age > p.maxAge || p.lat < s || p.lat > n || p.lon < w || p.lon > e) {
    Object.assign(p, spawn(g))
  }
}

const S: Record<string, React.CSSProperties> = {
  section:    { marginBottom: 24 },
  heading:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
                textTransform: 'uppercase', margin: '0 0 10px' },
  refBtn:     { background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer',
                fontSize: 13, padding: 0, float: 'right' },
  overlayRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1',
                cursor: 'pointer', userSelect: 'none' },
  checkbox:   { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
  errBox:     { color: '#f87171', fontSize: 12, padding: '6px 0' },
  meta:       { fontSize: 11, color: '#475569', marginTop: 6, paddingLeft: 23 },
}

function CurrentsLegend({ vmaxSpeed }: { vmaxSpeed: number }) {
  const vmaxKt = (vmaxSpeed * MS_TO_KT).toFixed(2)
  const midKt  = (vmaxSpeed * MS_TO_KT * 0.5).toFixed(2)
  const grad = 'linear-gradient(to right, hsl(230,60%,25%), hsl(180,75%,35%), hsl(140,70%,45%), hsl(80,90%,55%)'
  return (
    <div style={{ paddingLeft: 23, marginTop: 6 }}>
      <div style={{ height: 6, borderRadius: 3, background: grad }} />
      <div style={{ display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: '#475569', marginTop: 2 }}>
        <span>0 kt</span>
        <span>{midKt} kt</span>
        <span>{vmaxKt} kt</span>
      </div>
    </div>
  )
}

export default function CurrentsLayerPanel() {
  const { map } = useMapContext()
  const [visible,  setVisible]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [grid,     setGrid]     = useState<WindGrid | null>(null)

  const animRef      = useRef<number>(0)
  const canvasRef    = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const gridRef      = useRef<WindGrid | null>(null)
  const mapRef       = useRef(map)
  const fetchIdRef   = useRef(0)  // stale-fetch guard
  gridRef.current = grid
  mapRef.current  = map

  const fetchGrid = useCallback(async () => {
    const id = ++fetchIdRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await getCurrentsGrid(AOI)
      if (id === fetchIdRef.current) setGrid(result)
    } catch (e) {
      if (id === fetchIdRef.current) {
        setError(e instanceof Error ? e.message : 'fetch failed')
        setVisible(false)  // don't leave checkbox checked with no overlay
      }
    } finally {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [])

  const toggle = useCallback(() => {
    if (visible) {
      setVisible(false)
    } else {
      if (!grid) fetchGrid()
      setVisible(true)
    }
  }, [visible, grid, fetchGrid])

  useEffect(() => {
    const m = mapRef.current
    if (!visible || !grid || !m) return

    const container = m.getContainer()
    const canvas    = document.createElement('canvas')
    canvas.width  = container.clientWidth
    canvas.height = container.clientHeight
    // z-index 2 so currents sit above wind overlay (z-index 1)
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;'
    container.appendChild(canvas)
    canvasRef.current = canvas

    particlesRef.current = initParticles(grid)

    const onZoom = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    m.on('zoom', onZoom)

    const ro = new ResizeObserver(() => {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      const g = gridRef.current
      if (g) particlesRef.current = initParticles(g)
    })
    ro.observe(container)

    let cancelled = false  // prevents zombie rAF callbacks after cleanup
    let lastTime = performance.now()
    const frame = (now: number) => {
      if (cancelled) return
      const dt  = Math.min((now - lastTime) / 1000, 0.05)
      lastTime  = now
      const g   = gridRef.current
      const map = mapRef.current
      const ctx = canvas.getContext('2d')
      if (!g || !map || !ctx) { animRef.current = requestAnimationFrame(frame); return }

      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${FADE_ALPHA})`
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'

      const zoom          = map.getZoom()
      const pxPerDeg      = (512 * Math.pow(2, zoom)) / 360
      const degPerSec_max = TARGET_PX_PER_S / pxPerDeg

      for (const p of particlesRef.current) {
        tickParticle(p, g, map, ctx, dt, degPerSec_max)
      }

      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)

    return () => {
      cancelled = true
      cancelAnimationFrame(animRef.current)
      m.off('zoom', onZoom)
      ro.disconnect()
      canvas.remove()
      canvasRef.current = null
    }
  }, [visible, grid])

  const vmaxKt = grid ? (grid.vmax_speed * MS_TO_KT).toFixed(2) : null

  return (
    <section style={S.section}>
      <p style={S.heading}>
        Surface Currents
        {grid && (
          <button style={S.refBtn} onClick={fetchGrid} title="Refresh currents grid">↻</button>
        )}
      </p>

      {error && <p style={S.errBox}>⚠ {error}</p>}

      <label style={S.overlayRow}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={visible}
          disabled={loading}
          onChange={toggle}
        />
        Animated currents overlay
        {loading && <span style={{ marginLeft: 4, color: '#64748b', fontSize: 11 }}>⟳</span>}
      </label>

      {visible && grid && (
        <>
          <CurrentsLegend vmaxSpeed={grid.vmax_speed} />
          <p style={S.meta}>
            Max {vmaxKt} kt · {grid.timestamp.slice(0, 16).replace('T', ' ')} UTC
          </p>
        </>
      )}
    </section>
  )
}
