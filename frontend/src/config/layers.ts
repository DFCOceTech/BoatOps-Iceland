import type { RasterSourceSpecification } from 'maplibre-gl'

export interface RasterLayerDef {
  id: string
  label: string
  defaultVisible: boolean
  source: RasterSourceSpecification
  paint?: { 'raster-opacity'?: number }
  /** Optional WMS GetLegendGraphic URL — shown below the toggle when the layer is visible. */
  legendUrl?: string
}

// Tile URL for WMS sources — MapLibre GL JS replaces {bbox-epsg-3857} with the
// tile bounding box in EPSG:3857 (Web Mercator) coordinates.
const wms = (baseUrl: string, layer: string, extra = '') =>
  `${baseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}` +
  `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256` +
  `&FORMAT=image/png&TRANSPARENT=TRUE&STYLES=${extra}`

export const BASE_LAYER_DEFS: RasterLayerDef[] = [
  {
    id: 'esri-imagery',
    label: 'Esri World Imagery (basemap photo — date varies)',
    defaultVisible: false,
    source: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    paint: { 'raster-opacity': 0.9 },
  },
  {
    id: 'seamap',
    label: 'OpenSeaMap Seamarks',
    defaultVisible: false,
    source: {
      type: 'raster',
      tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
      tileSize: 307,
      attribution: '© <a href="https://www.openseamap.org">OpenSeaMap</a> contributors',
      maxzoom: 18,
    },
  },
  {
    id: 'gebco',
    label: 'GEBCO Bathymetry (coarse — not valid inside the lagoon)',
    defaultVisible: false,
    source: {
      type: 'raster',
      tiles: [wms('https://wms.gebco.net/mapserv', 'GEBCO_LATEST')],
      tileSize: 256,
      attribution: '© <a href="https://www.gebco.net">GEBCO/BODC</a>',
    },
    paint: { 'raster-opacity': 0.65 },
  },
]
