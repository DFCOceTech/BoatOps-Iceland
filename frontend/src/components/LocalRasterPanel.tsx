import { useCallback, useEffect, useRef, useState } from 'react'
import { useMapContext } from '../context/MapContext'
import { loadGeoTiff, renderToBlob, rampColor } from '../utils/geotiffLoader'
import type { LoadedRaster, Ramp } from '../utils/geotiffLoader'

interface Item {
  raster: LoadedRaster
  visible: boolean
  opacity: number
  min: number
  max: number
  ramp: Ramp
  url: string | null
}

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
             textTransform: 'uppercase', margin: '0 0 8px' },
  drop:    { border: '1px dashed #3b4160', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#94a3b8',
             textAlign: 'center' },
  dropOn:  { borderColor: '#22d3ee', background: 'rgba(34,211,238,0.06)' },
  card:    { background: '#141621', borderRadius: 6, padding: '8px 12px', marginTop: 8 },
  row:     { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: '#94a3b8' },
  btn:     { fontSize: 11, padding: '3px 8px', background: '#2d3148', color: '#e2e8f0',
             border: '1px solid #3b4160', borderRadius: 4, cursor: 'pointer' },
  num:     { width: 70, background: '#0f111a', color: '#e2e8f0', border: '1px solid #2d3148', borderRadius: 4,
             fontSize: 11, padding: '2px 4px' },
  hint:    { fontSize: 10, color: '#475569', lineHeight: 1.5, marginTop: 6 },
  err:     { fontSize: 11, color: '#f87171', marginTop: 6, lineHeight: 1.4 },
}

const srcId = (id: string) => `local-raster-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`

const fmtNum = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(2) : String(Math.round(v * 1000) / 1000))

function gradientCss(ramp: Ramp): string {
  const stops = Array.from({ length: 8 }, (_, i) => `rgb(${rampColor(i / 7, ramp).join(',')})`)
  return `linear-gradient(to right, ${stops.join(',')})`
}

/**
 * Your own GeoTIFFs (drone orthomosaics, sonar rasters) as map overlays.
 * Files are decoded in the browser from an internal overview — nothing is uploaded, and nothing is
 * kept across reloads. Independent of the work site, so overlays stay put when the site moves.
 */
export default function LocalRasterPanel() {
  const { map } = useMapContext()
  const [items, setItems] = useState<Item[]>([])
  const [errors, setErrors] = useState<{ name: string; msg: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const shown = useRef<Map<string, string>>(new Map())     // source id → blob URL currently on the map
  const itemsRef = useRef<Item[]>([])
  itemsRef.current = items

  // ── sync items → map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return
    const sync = () => {
      const wanted = new Set<string>()
      for (const it of items) {
        const id = srcId(it.raster.id)
        wanted.add(id)
        if (!it.url) continue
        const source = map.getSource(id) as (maplibregl.ImageSource | undefined)
        if (!source) {
          map.addSource(id, { type: 'image', url: it.url, coordinates: it.raster.coordinates })
          map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': it.opacity, 'raster-fade-duration': 0 } })
        } else if (shown.current.get(id) !== it.url) {
          source.updateImage({ url: it.url, coordinates: it.raster.coordinates })
        }
        shown.current.set(id, it.url)
        map.setPaintProperty(id, 'raster-opacity', it.opacity)
        map.setLayoutProperty(id, 'visibility', it.visible ? 'visible' : 'none')
      }
      for (const id of [...shown.current.keys()]) {
        if (wanted.has(id)) continue
        if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(id)) map.removeSource(id)
        shown.current.delete(id)
      }
    }
    if (map.isStyleLoaded()) sync()
    else { map.once('load', sync); return () => { map.off('load', sync) } }
  }, [map, items])

  useEffect(() => () => {
    const m = map
    if (m) shown.current.forEach((_u, id) => { try { if (m.getLayer(id)) m.removeLayer(id); if (m.getSource(id)) m.removeSource(id) } catch { /* teardown */ } })
    shown.current.clear()
    itemsRef.current.forEach(i => i.url && URL.revokeObjectURL(i.url))
  }, [map])

  // ── add files ─────────────────────────────────────────────────────────────
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setBusy(true)
    const errs: { name: string; msg: string }[] = []
    for (const f of list) {
      if (!/\.(tif|tiff)$/i.test(f.name)) { errs.push({ name: f.name, msg: 'Not a .tif/.tiff file.' }); continue }
      try {
        const raster = await loadGeoTiff(f)
        if (itemsRef.current.some(i => i.raster.id === raster.id)) { errs.push({ name: f.name, msg: 'Already loaded.' }); continue }
        const min = raster.stats?.min ?? 0, max = raster.stats?.max ?? 1
        const blob = await renderToBlob(raster, { min, max, ramp: 'viridis' })
        const item: Item = { raster, visible: true, opacity: 0.85, min, max, ramp: 'viridis', url: URL.createObjectURL(blob) }
        setItems(prev => [...prev, item])
        if (map && itemsRef.current.length === 0) {
          const [w, s, e, n] = raster.bounds
          map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 600, maxZoom: 19 })
        }
      } catch (e) {
        errs.push({ name: f.name, msg: e instanceof Error ? e.message : String(e) })
      }
    }
    setErrors(errs)
    setBusy(false)
  }, [map])

  const update = useCallback((id: string, patch: Partial<Item>) =>
    setItems(prev => prev.map(i => (i.raster.id === id ? { ...i, ...patch } : i))), [])

  /** Re-render a scalar raster after its display range or colour ramp changed. */
  const restyle = useCallback(async (it: Item, patch: Partial<Pick<Item, 'min' | 'max' | 'ramp'>>) => {
    const next = { ...it, ...patch }
    update(it.raster.id, patch)
    if (!(next.max > next.min)) return
    const blob = await renderToBlob(next.raster, { min: next.min, max: next.max, ramp: next.ramp })
    const url = URL.createObjectURL(blob)
    const old = itemsRef.current.find(i => i.raster.id === it.raster.id)?.url
    update(it.raster.id, { url })
    if (old) setTimeout(() => URL.revokeObjectURL(old), 2000)
  }, [update])

  const remove = (it: Item) => {
    setItems(prev => prev.filter(i => i.raster.id !== it.raster.id))
    if (it.url) setTimeout(() => URL.revokeObjectURL(it.url!), 2000)
  }

  return (
    <section style={S.section}>
      <p style={S.heading}>Imagery — your GeoTIFFs</p>
      <label
        style={{ ...S.drop, ...(dragging ? S.dropOn : {}), display: 'block', cursor: 'pointer' }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files) }}
      >
        {busy ? 'Reading…' : 'Drop drone / sonar GeoTIFFs here, or click to choose'}
        <input type="file" accept=".tif,.tiff,image/tiff" multiple aria-label="Add GeoTIFF files" style={{ display: 'none' }}
          onChange={e => { void addFiles(e.target.files ?? []); e.target.value = '' }} />
      </label>

      {errors.map(e => <div key={e.name} style={S.err}>⚠ {e.name}: {e.msg}</div>)}

      {items.map(it => {
        const r = it.raster
        const scalar = r.kind === 'scalar'
        return (
          <div key={r.id} style={S.card}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#f1f5f9', fontWeight: 700 }}>
              <input type="checkbox" checked={it.visible} aria-label={`Show ${r.name}`}
                style={{ accentColor: '#38bdf8' }} onChange={() => update(r.id, { visible: !it.visible })} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</span>
            </label>
            <div style={S.hint}>
              {scalar ? 'Single band' : 'RGB'} · {r.crs} · preview {r.previewSize[0]}×{r.previewSize[1]}
              {r.previewSize[0] !== r.fullSize[0] ? ` of ${r.fullSize[0]}×${r.fullSize[1]} px (overview)` : ' px'}
              <br />W {r.bounds[0].toFixed(4)} S {r.bounds[1].toFixed(4)} E {r.bounds[2].toFixed(4)} N {r.bounds[3].toFixed(4)}
            </div>
            <div style={S.row}>
              Opacity
              <input type="range" min={0.1} max={1} step={0.05} value={it.opacity} aria-label={`Opacity ${r.name}`}
                onChange={e => update(r.id, { opacity: Number(e.target.value) })} />
              <button style={S.btn} onClick={() => map?.fitBounds([[r.bounds[0], r.bounds[1]], [r.bounds[2], r.bounds[3]]], { padding: 60, maxZoom: 19 })}>Zoom to</button>
              <button style={S.btn} onClick={() => remove(it)} aria-label={`Remove ${r.name}`}>Remove</button>
            </div>
            {scalar && (
              <>
                <div style={S.row}>
                  Range
                  <input type="number" style={S.num} aria-label={`Min ${r.name}`} value={it.min} step="any"
                    onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) void restyle(it, { min: v }) }} />
                  –
                  <input type="number" style={S.num} aria-label={`Max ${r.name}`} value={it.max} step="any"
                    onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) void restyle(it, { max: v }) }} />
                  <select aria-label={`Ramp ${r.name}`} value={it.ramp} style={S.num}
                    onChange={e => void restyle(it, { ramp: e.target.value as Ramp })}>
                    <option value="viridis">Viridis</option>
                    <option value="grey">Grey</option>
                  </select>
                  <button style={S.btn} onClick={() => r.stats && void restyle(it, { min: r.stats.min, max: r.stats.max })}>Auto</button>
                </div>
                <div style={{ height: 8, borderRadius: 3, marginTop: 6, background: gradientCss(it.ramp) }} />
                <div style={{ ...S.row, justifyContent: 'space-between', marginTop: 2 }}>
                  <span>{fmtNum(it.min)}</span><span>{fmtNum(it.max)}</span>
                </div>
                {!(it.max > it.min) && <div style={S.err}>Max must be greater than min.</div>}
              </>
            )}
          </div>
        )
      })}

      <div style={S.hint}>
        Read in your browser from an internal overview — nothing is uploaded and layers are not kept after reload.
        Georeferencing: EPSG 4326, UTM (326xx/327xx/258xx), Web Mercator, ISN93/ISN2016. Large mosaics need overviews
        (<code>gdaladdo</code> or COG). Sonar/DSM single-band rasters get a colour ramp; nodata is transparent.
      </div>
    </section>
  )
}
