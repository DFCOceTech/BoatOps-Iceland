/**
 * EMODnet Seabed Habitats panel:
 *   1. Discovers which Baltic habitat types are present by sampling a grid of
 *      WMS GetFeatureInfo requests across the AOI.
 *   2. Adds a map click handler that queries the habitat at the clicked point
 *      and shows a styled popup.
 *
 * Key fields discovered from the eusm_helcom_group service:
 *   regionald — Baltic-specific habitat description (most useful for this app)
 *   eunis2019d — EUNIS 2019 classification code + label
 *   msfd_bbht  — MSFD Broad Habitat Type
 *   biozone / substrate / salinity / energy — environmental descriptors
 */
import { useState, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapContext } from '../context/MapContext'

const WMS_BASE  = 'https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms'
const WMS_LAYER = 'eusm_helcom_group'

// Sample grid: 5 lons × 4 lats = 20 points across the Baltic AOI
const SAMPLE_PTS: [number, number][] = []  // [lat, lon]
for (let lon = 10.0; lon <= 14.5; lon += 1.25)
  for (let lat = 53.75; lat <= 55.75; lat += 0.75)
    SAMPLE_PTS.push([lat, lon])

function gfiUrl(_lat: number, _lon: number, w: number, h: number, px: number, py: number,
                 bbox: string): string {
  return `${WMS_BASE}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
    `&LAYERS=${WMS_LAYER}&QUERY_LAYERS=${WMS_LAYER}` +
    `&INFO_FORMAT=application/json` +
    `&X=${px}&Y=${py}&WIDTH=${w}&HEIGHT=${h}` +
    `&BBOX=${bbox}&SRS=EPSG:4326`
}

function sampleUrl(lat: number, lon: number): string {
  const r = 0.25
  return gfiUrl(lat, lon, 10, 10, 5, 5, `${lon-r},${lat-r},${lon+r},${lat+r}`)
}

// Inject popup CSS once
let cssInjected = false
function injectPopupCss() {
  if (cssInjected || typeof document === 'undefined') return
  cssInjected = true
  const s = document.createElement('style')
  s.textContent = `
    .emodnet-popup .maplibregl-popup-content {
      background: #1a1f2e;
      border: 1px solid #2d3748;
      padding: 12px 14px 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,.6);
      border-radius: 6px;
      min-width: 220px; max-width: 320px;
    }
    .emodnet-popup .maplibregl-popup-close-button {
      color: #64748b; font-size: 16px; padding: 4px 8px; line-height: 1;
    }
    .emodnet-popup .maplibregl-popup-close-button:hover { color: #94a3b8; }
    .emodnet-popup .maplibregl-popup-tip { border-bottom-color: #1a1f2e; }
  `
  document.head.appendChild(s)
}

const POPUP_FIELDS: { label: string; field: string }[] = [
  { label: 'Baltic habitat',  field: 'regionald'  },
  { label: 'EUNIS 2019',      field: 'eunis2019d' },
  { label: 'MSFD type',       field: 'msfd_bbht'  },
  { label: 'Biozone',         field: 'biozone'    },
  { label: 'Substrate',       field: 'substrate'  },
  { label: 'Salinity',        field: 'salinity'   },
  { label: 'Energy',          field: 'energy'     },
]

function buildPopupHtml(props: Record<string, string>): string {
  const rows = POPUP_FIELDS
    .filter(({ field }) => props[field]?.trim())
    .map(({ label, field }) =>
      `<div style="margin:5px 0">` +
        `<div style="color:#64748b;font-size:10px;letter-spacing:.05em;text-transform:uppercase">${label}</div>` +
        `<div style="color:#e2e8f0;font-size:12px;line-height:1.35">${props[field]}</div>` +
      `</div>`)
    .join('')
  return rows || '<div style="color:#64748b;font-size:12px">No habitat data at this point</div>'
}

const S: Record<string, React.CSSProperties> = {
  wrap:    { paddingLeft: 25, marginTop: 6, marginBottom: 4 },
  hint:    { fontSize: 10, color: '#475569', marginBottom: 6 },
  list:    { maxHeight: 220, overflowY: 'auto', fontSize: 11 },
  item:    { color: '#94a3b8', padding: '3px 0', borderBottom: '1px solid #1a1f2e', lineHeight: 1.4 },
  loading: { color: '#475569', fontSize: 11 },
}

export default function EmodnetPanel() {
  const { map } = useMapContext()
  const [habitats, setHabitats] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const mapRef    = useRef(map)
  const popupRef  = useRef<maplibregl.Popup | null>(null)
  mapRef.current  = map

  // ── Discover habitats in the Baltic AOI via a sample grid ─────────────────
  useEffect(() => {
    injectPopupCss()

    Promise.allSettled(SAMPLE_PTS.map(([lat, lon]) =>
      fetch(sampleUrl(lat, lon)).then(r => r.json())
    )).then(results => {
      const seen = new Set<string>()
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        for (const feat of (r.value.features ?? [])) {
          const name = (feat.properties as Record<string, string>)?.regionald?.trim()
          if (name) seen.add(name)
        }
      }
      setHabitats([...seen].sort())
      setLoading(false)
    })
  }, [])

  // ── Click handler for GetFeatureInfo popup ────────────────────────────────
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    const handleClick = async (e: maplibregl.MapMouseEvent) => {
      const b  = m.getBounds()
      const cw = m.getContainer().clientWidth
      const ch = m.getContainer().clientHeight
      const px = m.project(e.lngLat)
      const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`

      try {
        const resp = await fetch(
          gfiUrl(e.lngLat.lat, e.lngLat.lng, cw, ch,
                 Math.round(px.x), Math.round(px.y), bbox)
        )
        const data = await resp.json()
        popupRef.current?.remove()

        const feat = data.features?.[0]
        const html = buildPopupHtml((feat?.properties ?? {}) as Record<string, string>)

        popupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '340px',
          className: 'emodnet-popup',
        })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(m)
      } catch {
        // silently ignore network errors from GetFeatureInfo
      }
    }

    m.on('click', handleClick)
    return () => {
      m.off('click', handleClick)
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [map])

  return (
    <div style={S.wrap}>
      {loading ? (
        <p style={S.loading}>Discovering habitats in AOI…</p>
      ) : habitats.length === 0 ? (
        <p style={S.loading}>No habitat data in this AOI</p>
      ) : (
        <>
          <p style={S.hint}>
            {habitats.length} type{habitats.length !== 1 ? 's' : ''} in AOI · click map for detail
          </p>
          <div style={S.list}>
            {habitats.map(h => (
              <div key={h} style={S.item}>{h}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
