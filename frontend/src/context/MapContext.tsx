import { createContext, useContext, useState, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'

interface MapCtx {
  map: maplibregl.Map | null
  setMap: (m: maplibregl.Map | null) => void
}

const MapContext = createContext<MapCtx>({ map: null, setMap: () => {} })

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  return <MapContext.Provider value={{ map, setMap }}>{children}</MapContext.Provider>
}

export const useMapContext = () => useContext(MapContext)
