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
    id: 'seamap',
    label: 'OpenSeaMap Seamarks',
    defaultVisible: true,
    source: {
      type: 'raster',
      // tileSize 307 (≈ 256 × 1.2) renders tiles ~20% larger, scaling up seamark icons
      tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
      tileSize: 307,
      attribution: '© <a href="https://www.openseamap.org">OpenSeaMap</a> contributors',
      maxzoom: 18,
    },
  },
  {
    id: 'gebco',
    label: 'GEBCO Bathymetry',
    defaultVisible: false,
    source: {
      type: 'raster',
      tiles: [wms('https://wms.gebco.net/mapserv', 'GEBCO_LATEST')],
      tileSize: 256,
      attribution: '© <a href="https://www.gebco.net">GEBCO/BODC</a>',
    },
    paint: { 'raster-opacity': 0.65 },
  },
  {
    id: 'emodnet',
    label: 'EMODnet Seabed Habitats',
    defaultVisible: false,
    source: {
      type: 'raster',
      tiles: [wms(
        'https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms',
        'eusm_helcom_group',
      )],
      tileSize: 256,
      attribution: '© <a href="https://www.emodnet-seabedhabitats.eu">EMODnet Seabed Habitats</a>',
    },
    paint: { 'raster-opacity': 0.7 },
    legendUrl:
      'https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms' +
      '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic' +
      '&LAYER=eusm_helcom_group&FORMAT=image/png&TRANSPARENT=TRUE',
  },
]
