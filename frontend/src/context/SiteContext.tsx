import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Bbox } from '../api/client'

export interface Site { id: string; name: string; lat: number; lon: number }

/** Approximate reference points — verify against your own GNSS fix before relying on them. */
export const PRESET_SITES: Site[] = [
  { id: 'preset-lagoon', name: 'Jökulsárlón (lagoon centre, approx.)', lat: 64.048, lon: -16.179 },
  { id: 'preset-outlet', name: 'Outlet channel to sea (approx.)',      lat: 64.0436, lon: -16.1788 },
]

const DEFAULT_SITE = PRESET_SITES[0]
const LS_KEY = 'boatops-iceland-sites'

export const validLat = (v: number) => Number.isFinite(v) && v >= -90 && v <= 90
export const validLon = (v: number) => Number.isFinite(v) && v >= -180 && v <= 180

/** Imagery/overpass bbox centred on the site; radiusKm is the half-width. */
export function siteBbox(site: { lat: number; lon: number }, radiusKm: number): Bbox {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.max(0.05, Math.cos((site.lat * Math.PI) / 180)))
  const r = (v: number) => Math.round(v * 1000) / 1000
  return {
    west: r(site.lon - dLon), south: r(site.lat - dLat),
    east: r(site.lon + dLon), north: r(site.lat + dLat),
  }
}

function parseHash(): Site | null {
  try {
    const m = /site=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(window.location.hash)
    if (!m) return null
    const lat = parseFloat(m[1]), lon = parseFloat(m[2])
    return validLat(lat) && validLon(lon) ? { id: 'url', name: 'Shared site', lat, lon } : null
  } catch { return null }
}

function loadSaved(): Site[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
    return Array.isArray(raw)
      ? raw.filter(s => s && typeof s.name === 'string' && validLat(s.lat) && validLon(s.lon))
      : []
  } catch { return [] }
}

interface SiteCtx {
  active: Site
  saved: Site[]
  radiusKm: number
  bbox: Bbox
  picking: boolean
  setRadiusKm: (r: number) => void
  setPicking: (p: boolean) => void
  setActive: (lat: number, lon: number, name?: string) => void
  saveActive: (name: string) => void
  remove: (id: string) => void
}

const SiteContext = createContext<SiteCtx | null>(null)

export function SiteProvider({ children }: { children: ReactNode }) {
  const [active, setActiveSite] = useState<Site>(() => parseHash() ?? DEFAULT_SITE)
  const [saved, setSaved]       = useState<Site[]>(loadSaved)
  const [radiusKm, setRadiusKm] = useState(6)
  const [picking, setPicking]   = useState(false)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(saved)) } catch { /* private mode */ }
  }, [saved])

  useEffect(() => {
    try {
      history.replaceState(null, '', `#site=${active.lat.toFixed(5)},${active.lon.toFixed(5)}`)
    } catch { /* ignore */ }
  }, [active.lat, active.lon])

  const setActive = useCallback((lat: number, lon: number, name?: string) => {
    if (!validLat(lat) || !validLon(lon)) return
    setActiveSite({ id: 'active', name: name ?? 'Work site', lat, lon })
  }, [])

  const saveActive = useCallback((name: string) => {
    const clean = name.trim().slice(0, 60)
    if (!clean) return
    setSaved(prev => [...prev, { id: `s-${Date.now()}`, name: clean, lat: active.lat, lon: active.lon }])
  }, [active.lat, active.lon])

  const remove = useCallback((id: string) => setSaved(prev => prev.filter(s => s.id !== id)), [])

  const bbox = useMemo(() => siteBbox(active, radiusKm), [active, radiusKm])

  return (
    <SiteContext.Provider value={{ active, saved, radiusKm, bbox, picking, setRadiusKm, setPicking, setActive, saveActive, remove }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite(): SiteCtx {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>')
  return ctx
}
