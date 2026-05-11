import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapContext } from '../context/MapContext'
import { DARK_BASEMAP_STYLE } from '../config/basemapStyle'

const BALTIC_CENTER: [number, number] = [12.08, 54.18]  // [lon, lat]
const INITIAL_ZOOM = 8

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { setMap } = useMapContext()

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_BASEMAP_STYLE,
      center: BALTIC_CENTER,
      zoom: INITIAL_ZOOM,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-left')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    setMap(map)

    return () => {
      setMap(null)
      map.remove()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
