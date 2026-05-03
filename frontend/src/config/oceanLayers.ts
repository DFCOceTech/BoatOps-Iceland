import type { BlobResult } from '../api/client'
import * as api from '../api/client'

const AOI = { west: 9.5, south: 53.5, east: 15.0, north: 56.0 }

export interface ApiLayerDef {
  id: string
  label: string
  unit: string
  fetch: () => Promise<BlobResult>
  /** CSS gradient approximating the cmocean colormap for the legend bar. */
  gradient: string
}

export const OCEAN_LAYER_DEFS: ApiLayerDef[] = [
  {
    id: 'api-bathymetry',
    label: 'Marine Bathymetry',
    unit: 'm',
    fetch: () => api.getBathymetry(AOI),
    // cmocean.deep: white → teal → dark navy
    gradient: 'linear-gradient(to right, #fbfcfc, #7ecdc4, #2a7fa0, #0d3b5e, #020e1a)',
  },
  {
    id: 'api-sst',
    label: 'Sea Surface Temperature',
    unit: '°C',
    fetch: () => api.getSst(AOI),
    // cmocean.thermal: black → purple → red → yellow
    gradient: 'linear-gradient(to right, #060008, #7b1e6e, #d03030, #ee8833, #ffee55)',
  },
  {
    id: 'api-salinity',
    label: 'Surface Salinity',
    unit: 'PSU',
    fetch: () => api.getSalinity(AOI),
    // cmocean.haline: dark purple → blue → cyan → yellow-green
    gradient: 'linear-gradient(to right, #2a0a4a, #1a5aaa, #1ec8c8, #a8d838, #d8e422)',
  },
  {
    id: 'api-currents',
    label: 'Surface Currents',
    unit: 'm/s',
    fetch: () => api.getCurrents(AOI),
    // cmocean.speed: dark → blue → green → yellow
    gradient: 'linear-gradient(to right, #0d0d0d, #1a3a7a, #1a9a6e, #c8d84a, #f8f8d0)',
  },
  {
    id: 'api-chlorophyll',
    label: 'Surface Chlorophyll-a',
    unit: 'mg/m³',
    fetch: () => api.getChlorophyll(AOI),
    // cmocean.algae: near-white → green → dark green
    gradient: 'linear-gradient(to right, #d8f0d0, #66cc66, #228822, #0a4a0a, #020e02)',
  },
  {
    id: 'api-oxygen',
    label: 'Bottom Dissolved O₂',
    unit: 'mmol/m³',
    fetch: () => api.getOxygen(AOI),
    // cmocean.oxy: dark purple (hypoxic) → blue → green → yellow
    gradient: 'linear-gradient(to right, #2a0a3a, #1a2a8a, #1a8a6a, #88c838, #d8e422)',
  },
]
