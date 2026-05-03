import { useState, useEffect, useRef } from 'react'
import { useMapContext } from '../context/MapContext'
import type { RasterLayerDef } from '../config/layers'

export function useLayerVisibility(layerDefs: RasterLayerDef[]) {
  const { map } = useMapContext()
  const addedRef = useRef(false)

  const [visibility, setVisibility] = useState<Record<string, boolean>>(
    () => Object.fromEntries(layerDefs.map(l => [l.id, l.defaultVisible]))
  )

  useEffect(() => {
    if (!map || addedRef.current) return

    const add = () => {
      for (const def of layerDefs) {
        if (!map.getSource(def.id)) {
          map.addSource(def.id, def.source)
        }
        if (!map.getLayer(def.id)) {
          map.addLayer({
            id: def.id,
            type: 'raster',
            source: def.id,
            layout: { visibility: def.defaultVisible ? 'visible' : 'none' },
            paint: def.paint ?? {},
          })
        }
      }
      addedRef.current = true
    }

    if (map.isStyleLoaded()) {
      add()
    } else {
      map.once('load', add)
    }

    return () => {
      // Map may already be destroyed when this runs — guard with try/catch
      try {
        for (const def of [...layerDefs].reverse()) {
          if (map.getLayer(def.id)) map.removeLayer(def.id)
          if (map.getSource(def.id)) map.removeSource(def.id)
        }
      } catch { /* map already removed */ }
      addedRef.current = false
    }
  // layerDefs is intentionally in deps so cleanup targets the right layers if
  // the caller swaps the definition array. BASE_LAYER_DEFS is a stable constant
  // so this never triggers an extra re-run in practice.
  }, [map, layerDefs])

  const toggle = (id: string) => {
    setVisibility(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        map?.setLayoutProperty(id, 'visibility', next[id] ? 'visible' : 'none')
      } catch { /* layer not yet added */ }
      return next
    })
  }

  return { visibility, toggle }
}
