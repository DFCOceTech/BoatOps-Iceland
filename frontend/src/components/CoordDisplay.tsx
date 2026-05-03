import { useEffect, useState } from 'react'
import type { MapMouseEvent } from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'

export default function CoordDisplay() {
  const { map } = useMapContext()
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)

  useEffect(() => {
    if (!map) return
    const onMove = (e: MapMouseEvent) =>
      setCoords({ lat: e.lngLat.lat, lon: e.lngLat.lng })
    map.on('mousemove', onMove)
    return () => { map.off('mousemove', onMove) }
  }, [map])

  return (
    <div style={{
      position: 'absolute',
      bottom: 28,   // above the MapLibre scale bar
      right: 8,
      background: 'rgba(15, 17, 26, 0.75)',
      backdropFilter: 'blur(4px)',
      color: '#94a3b8',
      fontSize: 11,
      fontFamily: 'ui-monospace, Consolas, monospace',
      padding: '3px 8px',
      borderRadius: 4,
      pointerEvents: 'none',
      userSelect: 'none',
      minWidth: 180,
      textAlign: 'right',
    }}>
      {coords
        ? `${Math.abs(coords.lat).toFixed(4)}°${coords.lat >= 0 ? 'N' : 'S'}  ${Math.abs(coords.lon).toFixed(4)}°${coords.lon >= 0 ? 'E' : 'W'}`
        : '—'}
    </div>
  )
}
