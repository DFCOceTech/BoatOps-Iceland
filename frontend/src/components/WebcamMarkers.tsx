import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'
import { injectDarkPopupStyles } from '../utils/popupStyles'
import { WEBCAMS } from '../config/webcams'

/** REQ-IS-13: one marker per configured webcam; popup links out to the provider's page. */
export default function WebcamMarkers() {
  const { map } = useMapContext()

  useEffect(() => {
    if (!map) return
    injectDarkPopupStyles()
    const markers = WEBCAMS.map(w => {
      const el = document.createElement('div')
      el.className = 'webcam-marker'
      el.dataset.testid = `webcam-${w.id}`
      el.title = `${w.name} — live webcam`
      el.textContent = '📷'
      el.style.cssText = 'width:24px;height:24px;display:flex;align-items:center;justify-content:center;' +
        'font-size:14px;background:#0ea5e9;border:2px solid #0f172a;border-radius:50%;cursor:pointer'

      const pop = document.createElement('div')
      pop.style.cssText = 'padding:8px 10px;font-size:12px;line-height:1.5;color:#e2e8f0'
      const b = document.createElement('b'); b.textContent = w.name
      const prov = document.createElement('div'); prov.textContent = `Live webcam · ${w.provider}`
      prov.style.color = '#94a3b8'
      const a = document.createElement('a')
      a.href = w.url; a.target = '_blank'; a.rel = 'noopener noreferrer'
      a.textContent = 'Open live view ↗'; a.style.color = '#38bdf8'
      pop.append(b, prov, a)

      return new maplibregl.Marker({ element: el })
        .setLngLat([w.lon, w.lat])
        .setPopup(new maplibregl.Popup({ offset: 14, className: 'boatops-popup' }).setDOMContent(pop))
        .addTo(map)
    })
    return () => markers.forEach(m => m.remove())
  }, [map])

  return null
}
