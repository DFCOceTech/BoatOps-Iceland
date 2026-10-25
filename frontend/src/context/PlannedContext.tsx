import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getDownloadInfo } from '../api/client'
import type { Bbox, DownloadQuery, Overpass } from '../api/client'

export interface PlannedAcquisition {
  key: string
  platform: string
  aos_utc: string
  los_utc: string
  max_elevation_deg: number
  site: { name: string; lat: number; lon: number }
  bbox: Bbox
  saved_at: string
  availability: string
  access: string
  queries: DownloadQuery[]
}

const LS_KEY = 'boatops-iceland-planned'
export const passKey = (p: Overpass, site: { lat: number; lon: number }) =>
  `${p.platform}|${p.aos_utc}|${site.lat.toFixed(3)},${site.lon.toFixed(3)}`

function load(): PlannedAcquisition[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
    return Array.isArray(raw)
      ? raw.filter(r => r && typeof r.key === 'string' && typeof r.platform === 'string' && Array.isArray(r.queries))
      : []
  } catch { return [] }
}

interface Ctx {
  planned: PlannedAcquisition[]
  pending: Set<string>
  error: string | null
  has: (key: string) => boolean
  add: (p: Overpass, site: PlannedAcquisition['site'], bbox: Bbox) => Promise<void>
  remove: (key: string) => void
  clear: () => void
}

const PlannedContext = createContext<Ctx | null>(null)

/**
 * Overpasses the user ticked to fetch after acquisition. Each record is self-contained:
 * the catalogue queries are resolved when ticked, so they survive reloads and site changes.
 */
export function PlannedProvider({ children }: { children: ReactNode }) {
  const [planned, setPlanned] = useState<PlannedAcquisition[]>(load)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(planned)) } catch { /* private mode */ }
  }, [planned])

  const add = useCallback(async (p: Overpass, site: PlannedAcquisition['site'], bbox: Bbox) => {
    const key = passKey(p, site)
    setError(null)
    setPending(prev => new Set(prev).add(key))
    try {
      const info = await getDownloadInfo(p, bbox)
      setPlanned(prev => prev.some(x => x.key === key) ? prev : [...prev, {
        key, platform: p.platform, aos_utc: p.aos_utc, los_utc: p.los_utc,
        max_elevation_deg: p.max_elevation_deg, site, bbox,
        saved_at: new Date().toISOString(), ...info,
      }].sort((a, b) => a.aos_utc.localeCompare(b.aos_utc)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve download queries')
    } finally {
      setPending(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [])

  const remove = useCallback((key: string) => setPlanned(prev => prev.filter(x => x.key !== key)), [])
  const clear = useCallback(() => setPlanned([]), [])
  const has = useCallback((key: string) => planned.some(x => x.key === key), [planned])

  return (
    <PlannedContext.Provider value={{ planned, pending, error, has, add, remove, clear }}>
      {children}
    </PlannedContext.Provider>
  )
}

export function usePlanned(): Ctx {
  const ctx = useContext(PlannedContext)
  if (!ctx) throw new Error('usePlanned must be used inside <PlannedProvider>')
  return ctx
}
