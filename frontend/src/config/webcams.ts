/** Live webcams shown as map markers. Link-out only: providers block framing / tokenise streams. */
export interface Webcam {
  id: string
  name: string
  provider: string
  url: string
  lat: number
  lon: number   // approximate — verify against the provider's own map
}

export const WEBCAMS: Webcam[] = [
  {
    id: 'jokulsarlon-skyline',
    name: 'Jökulsárlón glacier lagoon',
    provider: 'SkylineWebcams',
    url: 'https://www.skylinewebcams.com/en/webcam/iceland/austurland/hofn/jokulsarlon.html',
    lat: 64.0485,
    lon: -16.1794,
  },
]
