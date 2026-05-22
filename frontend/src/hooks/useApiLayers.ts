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
        paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 },
      })
    }
  } catch (err) {
    console.warn(`[useApiLayers] addImageLayer(${id}):`, err)
  }
}

function updateImageSource(map: maplibregl.Map, id: string, blobUrl: string, bbox: [number,number,number,number]) {
  const [west, south, east, north] = bbox
  try {
    const src = map.getSource(id) as maplibregl.ImageSource | undefined
    if (src) {
      src.updateImage({
        url: blobUrl,
        coordinates: [[west, north], [east, north], [east, south], [west, south]],
      })
    }
  } catch (err) {
    console.warn(`[useApiLayers] updateImageSource(${id}):`, err)
  }
}

function removeImageLayer(map: maplibregl.Map, id: string) {
  try {
    if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(id)) map.removeSource(id)
  } catch { /* map may be in teardown */ }
}

export function useApiLayers(defs: ApiLayerDef[], map: maplibregl.Map | null, hour = 0) {
  const [layers, setLayers] = useState<LayersState>(() => makeInitial(defs))
  const mountedRef   = useRef(true)
  const abortRefs    = useRef<Record<string, AbortController>>({})
  const hourRef      = useRef(hour)
  hourRef.current    = hour
  const layersRef    = useRef(layers)
  layersRef.current  = layers

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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

    const currentHour = hourRef.current

    abortRefs.current[id]?.abort()
    const controller = new AbortController()
    abortRefs.current[id] = controller

    // Mark loading; keep existing blobUrl so the old image remains visible.
    setLayers(prev => ({ ...prev, [id]: { ...prev[id], loading: true, error: null, visible: true } }))

    try {
      const result = await def.fetch(currentHour)
      if (controller.signal.aborted || !mountedRef.current) return

      const blobUrl = URL.createObjectURL(result.blob)
      const prev = layersRef.current[id]

      if (prev?.blobUrl && map.getSource(id)) {
        // Layer already exists — swap the image in place without removing the layer.
        URL.revokeObjectURL(prev.blobUrl)
        const doUpdate = () => updateImageSource(map, id, blobUrl, result.bbox)
        if (map.isStyleLoaded()) doUpdate()
        else map.once('load', doUpdate)
      } else {
        // First load — remove any stale source/layer, add fresh.
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl)
        removeImageLayer(map, id)
        const doAdd = () => addImageLayer(map, id, blobUrl, result.bbox, DEFAULT_OPACITY)
        if (map.isStyleLoaded()) doAdd()
        else map.once('load', doAdd)
      }

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

  // Stable refs so the hour-change effect never goes stale.
  const fetchLayerRef = useRef(fetchLayer)
  fetchLayerRef.current = fetchLayer

  // Refetch all visible, time-varying layers when forecast hour changes.
  useEffect(() => {
    const currentLayers = layersRef.current
    const ids = defs
      .filter(d => d.timeVarying !== false)
      .map(d => d.id)
      .filter(id => currentLayers[id]?.visible && !!currentLayers[id]?.blobUrl)
    for (const id of ids) fetchLayerRef.current(id)
  }, [hour]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((id: string) => {
    const state = layers[id]
    if (!state) return

    if (!state.visible && !state.loading) {
      // Not shown and idle: start a fresh fetch for the current hour.
      fetchLayer(id)
      return
    }

    // Visible or mid-refetch: hide immediately and abort any in-flight request.
    abortRefs.current[id]?.abort()
    try {
      if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
    } catch { /* layer not yet added */ }
    setLayers(prev => ({ ...prev, [id]: { ...prev[id], visible: false, loading: false } }))
  }, [map, layers, fetchLayer])

  const setOpacity = useCallback((id: string, opacity: number) => {
    try { map?.setPaintProperty(id, 'raster-opacity', opacity) }
    catch { /* layer not yet added */ }
    setLayers(prev => ({ ...prev, [id]: { ...prev[id], opacity } }))
  }, [map])

  const refresh = useCallback((id: string) => fetchLayer(id), [fetchLayer])

  return { layers, toggle, setOpacity, refresh }
}
