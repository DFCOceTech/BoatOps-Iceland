import { useState, useEffect, useCallback, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { ApiLayerDef } from '../config/oceanLayers'
import type { BlobResult } from '../api/client'

export interface ApiLayerState {
  visible: boolean
  loading: boolean
  error: string | null
  timestamp: string
  colorscale: BlobResult['colorscale']
  opacity: number        // 0–1
  blobUrl: string | null // revokable object URL, null until first fetch
}

type LayersState = Record<string, ApiLayerState>

const DEFAULT_OPACITY = 0.75

const makeInitial = (defs: ApiLayerDef[]): LayersState =>
  Object.fromEntries(defs.map(d => [d.id, {
    visible: false, loading: false, error: null,
    timestamp: '', colorscale: { vmin: 0, vmax: 1, cmap: '' },
    opacity: DEFAULT_OPACITY, blobUrl: null,
  }]))

function addImageLayer(
  map: maplibregl.Map,
  id: string,
  blobUrl: string,
  bbox: [number, number, number, number],
  opacity: number,
) {
  const [west, south, east, north] = bbox
  try {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: 'image',
        url: blobUrl,
        coordinates: [[west, north], [east, north], [east, south], [west, south]],
      })
    }
    if (!map.getLayer(id)) {
      map.addLayer({
        id, type: 'raster', source: id,
        layout: { visibility: 'visible' },
        paint: { 'raster-opacity': opacity },
      })
    }
  } catch (err) {
    console.warn(`[useApiLayers] addImageLayer(${id}):`, err)
  }
}

function removeImageLayer(map: maplibregl.Map, id: string) {
  try {
    if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(id)) map.removeSource(id)
  } catch { /* map may be in teardown */ }
}

export function useApiLayers(defs: ApiLayerDef[], map: maplibregl.Map | null) {
  const [layers, setLayers] = useState<LayersState>(() => makeInitial(defs))
  const mountedRef = useRef(true)
  const abortRefs = useRef<Record<string, AbortController>>({})

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Cancel any in-flight fetches and revoke blob URLs.
      Object.values(abortRefs.current).forEach(c => c.abort())
      setLayers(prev => {
        Object.values(prev).forEach(s => {
          if (s.blobUrl) URL.revokeObjectURL(s.blobUrl)
        })
        return prev
      })
    }
  }, [])

  const fetchLayer = useCallback(async (id: string) => {
    if (!map) return
    const def = defs.find(d => d.id === id)
    if (!def) return

    // Cancel any previous in-flight fetch for this layer.
    abortRefs.current[id]?.abort()
    const controller = new AbortController()
    abortRefs.current[id] = controller

    // Revoke old blob URL and remove existing map layer.
    setLayers(prev => {
      const old = prev[id]
      if (old?.blobUrl) {
        URL.revokeObjectURL(old.blobUrl)
        removeImageLayer(map, id)
      }
      return { ...prev, [id]: { ...prev[id], loading: true, error: null, blobUrl: null, visible: true } }
    })

    try {
      const result = await def.fetch()
      if (controller.signal.aborted || !mountedRef.current) return

      const blobUrl = URL.createObjectURL(result.blob)

      // Read current opacity from latest state via functional update to avoid stale closure.
      // Initial add always uses DEFAULT_OPACITY; user-driven opacity changes go through setOpacity.
      const doAdd = () => addImageLayer(map, id, blobUrl, result.bbox, DEFAULT_OPACITY)
      if (map.isStyleLoaded()) doAdd()
      else map.once('load', doAdd)

      setLayers(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          loading: false, blobUrl,
          timestamp: result.timestamp,
          colorscale: result.colorscale,
          visible: true, error: null,
        },
      }))
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return
      setLayers(prev => ({
        ...prev,
        [id]: { ...prev[id], loading: false, error: err instanceof Error ? err.message : 'Fetch failed' },
      }))
    }
  }, [map, defs])

  const toggle = useCallback((id: string) => {
    const state = layers[id]
    if (!state || state.loading) return

    if (!state.visible && !state.blobUrl) {
      // First enable: fetch data.
      fetchLayer(id)
      return
    }

    const nextVisible = !state.visible
    try {
      if (map?.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', nextVisible ? 'visible' : 'none')
      }
    } catch { /* layer not yet added */ }
    setLayers(prev => ({ ...prev, [id]: { ...prev[id], visible: nextVisible } }))
  }, [map, layers, fetchLayer])

  const setOpacity = useCallback((id: string, opacity: number) => {
    try { map?.setPaintProperty(id, 'raster-opacity', opacity) }
    catch { /* layer not yet added */ }
    setLayers(prev => ({ ...prev, [id]: { ...prev[id], opacity } }))
  }, [map])

  const refresh = useCallback((id: string) => fetchLayer(id), [fetchLayer])

  return { layers, toggle, setOpacity, refresh }
}
