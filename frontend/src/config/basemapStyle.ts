import type { StyleSpecification } from 'maplibre-gl'

// Land: rgb(9,9,9) = #090909   Water: rgb(30,50,120) = #1e3278
const LAND   = '#090909'
const WATER  = '#1e3278'
const COAST  = '#162060'
const BORDER = '#2a2a40'
const LABEL  = '#2e3f5c'

// Free vector tiles — OpenMapTiles schema, no API key required
const TILES_URL  = 'https://tiles.openfreemap.org/planet'
const GLYPHS_URL = 'https://tiles.openfreemap.org/glyphs/{fontstack}/{range}.pbf'

export const DARK_BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'BoatOps Dark',
  glyphs: GLYPHS_URL,
  sources: {
    openmaptiles: { type: 'vector', url: TILES_URL },
  },
  layers: [
    // ── Land (background) ─────────────────────────────────────────────────────
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': LAND, 'background-opacity': 0.85 },
    },

    // ── Water ─────────────────────────────────────────────────────────────────
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': WATER },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': COAST, 'line-width': 0.8 },
    },

    // ── Admin boundaries ──────────────────────────────────────────────────────
    {
      id: 'boundary_country',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all',
        ['==', ['get', 'admin_level'], 2],
        ['!=', ['get', 'maritime'], 1],
      ],
      paint: { 'line-color': BORDER, 'line-width': 0.8, 'line-opacity': 0.7 },
    },

    // ── Place labels (cities / towns only) ────────────────────────────────────
    {
      id: 'place_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      minzoom: 5,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 12, 13],
        'text-anchor': 'center',
      },
      paint: {
        'text-color': LABEL,
        'text-halo-color': '#050508',
        'text-halo-width': 1,
      },
    },
  ],
}
