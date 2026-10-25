/**
 * Cross-browser smoke tests for BoatOps frontend (NFR-04).
 * All /api/* routes are intercepted — no live backend required.
 *
 * Test IDs match ops/e2e-test-plan.md entries.
 */

import { test, expect, type Page, type Route } from '@playwright/test'

// ── Mock data ─────────────────────────────────────────────────────────────────

const TIMES_168 = Array.from({ length: 168 }, (_, i) => {
  const d = new Date('2026-05-03T00:00:00Z')
  d.setHours(i)
  return d.toISOString().replace('.000Z', '')
})

const MOCK_WEATHER = {
  times: TIMES_168,
  wind_speed_ms:  Array(168).fill(7.0),
  wind_speed_kt:  Array(168).fill(13.6),
  wind_dir_deg:   Array(168).fill(220),
  gust_speed_ms:  Array(168).fill(9.5),
  gust_speed_kt:  Array(168).fill(18.5),
  temperature_c:  Array(168).fill(12.5),
  precipitation_mm: Array(168).fill(0.0),
  cloud_cover_pct:  Array(168).fill(35),
  last_updated: 'generated_in_42.0ms',
}

const MOCK_ADVISORIES = { type: 'FeatureCollection', features: [] }

const NOW_H = new Date().toISOString().slice(0, 13) + ':00'
const MOCK_MARINE = {
  times: Array.from({ length: 96 }, (_, i) => new Date(new Date(NOW_H + ':00Z').getTime() + i * 3600_000)
    .toISOString().slice(0, 16)),
  sea_level_m: Array.from({ length: 96 }, (_, i) => Math.sin((i / 12.4) * 2 * Math.PI)),
  wave_height_m: Array(96).fill(1.8),
  sst_c: Array(96).fill(7.4),
  grid_lat: 63.96, grid_lon: -16.21,
}

// Use +00:00 format (what Python's isoformat() actually emits) to catch the
// "endsWith('Z') ? iso : iso+'Z'" bug that crashed the app in production.
const MOCK_SOLAR_TIMES = {
  date: '2026-05-03', lat: 64.048, lon: -16.179,
  sunrise: '2026-05-03T03:42:00+00:00', sunset:  '2026-05-03T19:18:00+00:00',
  solar_noon: '2026-05-03T11:30:00+00:00',
  dawn_civil:  '2026-05-03T03:08:00+00:00', dusk_civil:  '2026-05-03T19:52:00+00:00',
  dawn_nautical: '2026-05-03T02:22:00+00:00', dusk_nautical: '2026-05-03T20:38:00+00:00',
  dawn_astronomical: '2026-05-03T01:21:00+00:00', dusk_astronomical: '2026-05-03T21:39:00+00:00',
}

const MOCK_SOLAR_ELEVATION = {
  elevation_deg: 42.3, azimuth_deg: 185.0,
  is_daylight: true, period: 'day',
  timestamp: '2026-05-03T10:00:00+00:00',
}

const MOCK_OVERPASSES = [
  { platform: 'Sentinel-2A', aos_utc: '2026-05-03T09:12:00+00:00',
    los_utc: '2026-05-03T09:22:00+00:00', max_elevation_deg: 67.4, duration_min: 10.2 },
  { platform: 'SWOT', aos_utc: '2026-05-03T16:31:00+00:00',
    los_utc: '2026-05-03T16:44:00+00:00', max_elevation_deg: 55.0, duration_min: 13.0 },
  { platform: 'Landsat-9', aos_utc: '2026-05-03T14:05:00+00:00',
    los_utc: '2026-05-03T14:14:00+00:00', max_elevation_deg: 41.8, duration_min: 8.7 },
]

// Minimal valid 1×1 transparent PNG
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
  'AABjkB6QAAAABJRU5ErkJggg=='

const PNG_HEADERS = {
  'x-bbox':       '-16.29,63.99,-16.07,64.10',
  'x-timestamp':  '2026-05-03T10:00:00',
  'x-colorscale': JSON.stringify({ vmin: 0, vmax: 5, cmap: 'amp' }),
}

// ── Mock setup ────────────────────────────────────────────────────────────────

const MOCK_STATIONS = { stations: [
  { id: 5316, name: 'Kvísker', owner: 'Veðurstofa Íslands', lat: 63.9, lon: -16.4, elevation_m: 20,
    distance_km: 15, bearing_deg: 213, time: '2026-10-25T16:30:00', age_min: 12, t: 5.8, f: 6.2, fg: 9.1,
    d: 336, d_txt: 'NNW', p: 985, rh: 80, r: 0.2 },
  { id: 5544, name: 'Höfn í Hornafirði', owner: 'Veðurstofa Íslands', lat: 64.27, lon: -15.2, elevation_m: 5,
    distance_km: 53, bearing_deg: 70, time: '2026-10-25T13:00:00', age_min: 200, t: 5.1, f: 4.7, fg: 6.7,
    d: 347, d_txt: 'NNW', p: null, rh: null, r: null },
] }

async function mockApis(page: Page) {
  await page.route('**/api/stations/nearby**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_STATIONS) }))
  await page.route('**/api/weather/forecast**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_WEATHER) }))
  await page.route('**/api/weather/advisories**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_ADVISORIES) }))
  await page.route('**/api/marine/forecast**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_MARINE) }))
  await page.route('**/api/weather/wind-grid**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/satellite/download-info**', r => {
    const u = new URL(r.request().url())
    const platform = u.searchParams.get('platform') ?? ''
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      availability: 'typically 1–5 days after acquisition', access: 'free NASA Earthdata login',
      queries: [{ label: `${platform} — test product`, url: 'https://example.org/query?p=' + platform }],
    }) })
  })
  await page.route('**/api/solar/times**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SOLAR_TIMES) }))
  await page.route('**/api/solar/elevation**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SOLAR_ELEVATION) }))
  await page.route('**/api/satellite/overpasses**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_OVERPASSES) }))
  for (const path of ['**/api/satellite/s2-overlay**', '**/api/satellite/s1-overlay**']) {
  await page.route(path, r => r.fulfill({
    status: 200, contentType: 'image/png',
    headers: {
      'x-bbox': '-16.29,63.99,-16.07,64.10',
      'x-scene-id': 'S2A_MSIL2A_20260503T093041',
      'x-acquisition-time': '2026-05-03T09:30:41',
      'x-cloud-cover': '8.3',
    },
    body: Buffer.from(TINY_PNG_B64, 'base64'),
  }))
  }
}

// Scroll a sidebar section into view by its heading text.
// Uses page.evaluate to avoid Playwright locator timeouts on <p> elements
// whose text content includes a child <button> (e.g. "Weather↻").
async function scrollToSection(page: Page, headingText: string) {
  await page.evaluate((text) => {
    const paras = Array.from(document.querySelectorAll('section p'))
    const heading = paras.find(p => (p.textContent ?? '').includes(text))
    heading?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, headingText)
  // Small pause for the scroll to settle before asserting
  await page.waitForTimeout(100)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('E2E-001: App loads', () => {
  test('page title is BoatOps', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await expect(page).toHaveTitle(/BoatOps/)
  })

  test('sidebar heading and map canvas present', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'BoatOps' })).toBeVisible()
    // MapLibre renders into a <canvas> — allow extra time for WebGL init
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('E2E-002: Go/No-Go dashboard', () => {
  test('overall verdict badge is visible with correct verdict', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    // wind 13.6 kt (green), gusts 18.5 kt (green),
    // cloud 35% (amber ≤50), solar 42.3° (green) → one amber → CAUTION
    await expect(page.getByText('CAUTION')).toBeVisible({ timeout: 10_000 })
  })

  test('per-capability rows: wind and solar values visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await expect(page.getByText('13.6 kt')).toBeVisible({ timeout: 10_000 })
    // Solar elevation appears in both the dashboard row and the gauge SVG — use first()
    await expect(page.getByText('42.3°').first()).toBeVisible({ timeout: 8_000 })
  })

  test('settings modal: open, edit, reset defaults, save', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await page.getByTitle('Threshold settings').click()
    await expect(page.getByText('Threshold Settings')).toBeVisible()
    // Inputs are controlled; first input is wind green max = 15
    const inputs = page.locator('input[type="number"]')
    await expect(inputs.first()).toHaveValue('15')
    // Edit a value
    await inputs.first().fill('12')
    await expect(inputs.first()).toHaveValue('12')
    // Reset restores default (controlled inputs update immediately)
    await page.getByText('Reset defaults').click()
    await expect(inputs.first()).toHaveValue('15')
    // Save closes modal
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Threshold Settings')).not.toBeVisible()
  })

  test('refresh button triggers weather refetch', async ({ page }) => {
    // Register standard mocks first, then override weather with a counter
    await mockApis(page)
    let callCount = 0
    // Registered last → takes priority over mockApis' weather handler
    await page.route('**/api/weather/forecast**', (r: Route) => {
      callCount++
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_WEATHER) })
    })
    await page.goto('/')
    await page.waitForTimeout(800)  // let initial fetches settle
    const before = callCount
    await page.getByTitle('Refresh all data').click()
    await page.waitForTimeout(500)
    expect(callCount).toBeGreaterThan(before)
  })
})

test.describe('E2E-003: Weather panel', () => {
  test('wind speed value and Recharts SVG visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Weather')
    await expect(page.getByText('13.6').first()).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
  })
})

test.describe('E2E-004: Tide panel', () => {
  test('sea level, offshore Hs and next tide times visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Tide')
    await expect(page.getByText(/Sea level now/)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(/High tide|Low tide/).first()).toBeVisible()
    await expect(page.getByText(/not conditions inside the lagoon/)).toBeVisible()
  })
})

test.describe('E2E-014: Local conditions (REQ-IS-12)', () => {
  test('nearest stations listed, old reading flagged stale', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Local Conditions')
    const rows = page.getByTestId('station-row')
    await expect(rows).toHaveCount(2, { timeout: 8_000 })
    await expect(rows.first()).toContainText('Kvísker')
    await expect(rows.first()).toContainText('15 km SW')
    await expect(rows.first()).not.toContainText('STALE')
    await expect(rows.nth(1)).toContainText('STALE')
  })

  test('each station gets a map marker with a popup', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    const markers = page.locator('.station-marker')
    await expect(markers).toHaveCount(2, { timeout: 8_000 })
    await markers.first().dispatchEvent('click')  // off-screen at default zoom
    await expect(page.locator('.maplibregl-popup')).toContainText('Kvísker')
  })

  test('API failure shows error, other panels still render', async ({ page }) => {
    await mockApis(page)
    await page.route('**/api/stations/nearby**', r => r.fulfill({ status: 502, body: 'x' }))
    await page.goto('/')
    await expect(page.getByTestId('station-error')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('station-row')).toHaveCount(0)
    await scrollToSection(page, 'Tide')
    await expect(page.getByText(/Sea level now/)).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('E2E-013: SWOT + planned acquisitions', () => {
  test('SWOT appears in the overpass list', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Satellite')
    await expect(page.getByText('SWOT', { exact: true })).toBeVisible({ timeout: 8_000 })
  })

  test('ticking a pass saves a self-contained record that survives reload', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Satellite')
    await page.getByRole('checkbox', { name: /Save SWOT .* for download/ }).click()
    await expect(page.getByText('Planned acquisitions (1)')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('link', { name: /SWOT/ })).toHaveAttribute('href', /example\.org\/query\?p=SWOT/)
    await page.reload()
    await expect(page.getByText('Planned acquisitions (1)')).toBeVisible()
    await expect(page.getByText(/Availability: typically 1–5 days/)).toBeVisible()
  })

  test('unticking removes it; CSV export contains the query URL', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Satellite')
    const box = page.getByRole('checkbox', { name: /Save Sentinel-2A .* for download/ })
    await box.click()
    await expect(page.getByText('Planned acquisitions (1)')).toBeVisible({ timeout: 8_000 })
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()])
    const { readFile } = await import('node:fs/promises')
    const csv = await readFile(await dl.path(), 'utf8')
    expect(csv).toContain('Sentinel-2A')
    expect(csv).toContain('https://example.org/query?p=Sentinel-2A')
    await box.click()
    await expect(page.getByText('Planned acquisitions (0)')).toBeVisible()
  })

  test('download-info failure shows an error and does not save', async ({ page }) => {
    await mockApis(page)
    await page.route('**/api/satellite/download-info**', r => r.fulfill({ status: 502, body: 'x' }))
    await page.goto('/')
    await scrollToSection(page, 'Satellite')
    await page.getByRole('checkbox', { name: /Save SWOT .* for download/ }).click()
    await expect(page.getByText(/502/).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Planned acquisitions (0)')).toBeVisible()
  })
})

test.describe('E2E-012: 7-day tide panel', () => {
  test('chart, per-day high/low list and plan-time line render', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Tides')
    await expect(page.getByText('Tides — 7 day')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('.recharts-surface').last()).toBeVisible()
    // mock is a 12.4 h sinusoid → several highs (▲) and lows (▼) over the horizon
    await expect(page.getByText(/▲ \d\d:\d\d/).first()).toBeVisible()
    await expect(page.getByText(/▼ \d\d:\d\d/).first()).toBeVisible()
  })

  test('tide API failure shows an error and leaves other panels working', async ({ page }) => {
    await mockApis(page)
    await page.route('**/api/marine/forecast**', r => r.fulfill({ status: 502, body: 'x' }))
    await page.goto('/')
    await scrollToSection(page, 'Tides')
    await expect(page.getByText(/502/).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('CAUTION')).toBeVisible()
  })
})

test.describe('E2E-010: Work site (Iceland)', () => {
  test('defaults to the lagoon and carries the site in the URL', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await expect(page.getByText('64.04800°N')).toBeVisible({ timeout: 8_000 })
    await expect.poll(() => page.url()).toContain('#site=64.04800,-16.17900')
  })

  test('opening a shared #site= link restores that site', async ({ page }) => {
    await mockApis(page)
    await page.goto('/#site=64.0610,-16.2000')
    await expect(page.getByText('64.06100°N')).toBeVisible({ timeout: 8_000 })
  })

  test('typing new coordinates moves the site and refetches weather for it', async ({ page }) => {
    await mockApis(page)
    const seen: string[] = []
    await page.route('**/api/weather/forecast**', (r: Route) => {
      seen.push(r.request().url())
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WEATHER) })
    })
    await page.goto('/')
    await page.getByLabel('Latitude').fill('64.0700')
    await page.getByLabel('Longitude').fill('-16.2100')
    await page.getByRole('button', { name: 'Go', exact: true }).click()
    await expect.poll(() => seen.some(u => u.includes('lat=64.07') && u.includes('lon=-16.21'))).toBe(true)
  })

  test('rejects out-of-range coordinates', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await page.getByLabel('Latitude').fill('123')
    await page.getByRole('button', { name: 'Go', exact: true }).click()
    await expect(page.getByText('64.04800°N')).toBeVisible()
  })

  test('saved sites persist across reload', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await page.getByLabel('Site name').fill('Ice edge Mon')
    await page.getByRole('button', { name: 'Save site' }).click()
    await expect(page.getByRole('button', { name: 'Ice edge Mon', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Ice edge Mon', exact: true })).toBeVisible()
  })
})

test.describe('E2E-011: Sentinel-1 / Sentinel-2 imagery', () => {
  test('S1 toggle fetches the site bbox and shows scene metadata', async ({ page }) => {
    await mockApis(page)
    let url = ''
    await page.route('**/api/satellite/s1-overlay**', (r: Route) => {
      url = r.request().url()
      return r.fulfill({ status: 200, contentType: 'image/png',
        headers: { 'x-bbox': '-16.29,63.99,-16.07,64.10', 'x-scene-id': 'S1A_TEST', 'x-sar-mode': 'EW HH+HV', 'x-coverage': '100',
                   'x-acquisition-time': '2026-05-03T07:00:00+00:00' },
        body: Buffer.from(TINY_PNG_B64, 'base64') })
    })
    await page.goto('/')
    await page.locator('label').filter({ hasText: 'Sentinel-1 SAR' }).locator('input').check()
    await expect(page.getByText(/2026-05-03 07:00 UTC/)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('EW HH+HV')).toBeVisible()
    expect(url).toContain('days_back=7')
    expect(url).toMatch(/west=-16\.\d+/)
  })

  test('S1 failure (no scene) shows an error without breaking the page', async ({ page }) => {
    await mockApis(page)
    await page.route('**/api/satellite/s1-overlay**', r => r.fulfill({ status: 404, body: 'none' }))
    await page.goto('/')
    await page.locator('label').filter({ hasText: 'Sentinel-1 SAR' }).locator('input').check()
    await expect(page.getByText(/404/)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('CAUTION')).toBeVisible()
  })
})

test.describe('E2E-005: Solar panel', () => {
  test('elevation gauge SVG and times table visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Solar')
    await expect(page.locator('svg[aria-label*="Solar elevation"]'))
      .toBeVisible({ timeout: 8_000 })
    // exact:true avoids matching satellite legend text "today's sunrise–sunset"
    await expect(page.getByText('Sunrise', { exact: true })).toBeVisible()
    await expect(page.getByText('Solar noon', { exact: true })).toBeVisible()
  })
})

test.describe('E2E-006: Satellite panel', () => {
  test('overpass table with platform groups visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Satellite')
    await expect(page.getByText('Sentinel-2A')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Landsat-9')).toBeVisible()
    await expect(page.getByText('10 min')).toBeVisible()
  })
})

test.describe('E2E-007: Layer panel', () => {
  test('Base Layers section and OpenSeaMap checkbox visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    // LayerPanel uses heading "Base Layers"
    await expect(page.getByText('Base Layers')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('label').filter({ hasText: 'OpenSeaMap' })).toBeVisible()
  })
})

test.describe('E2E-008: Error states degrade gracefully (NFR-06)', () => {
  test('weather API failure shows error; tide and solar still render', async ({ page }) => {
    await page.route('**/api/weather/forecast**', r =>
      r.fulfill({ status: 500, body: 'Internal Server Error' }))
    await page.route('**/api/weather/advisories**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_ADVISORIES) }))
    await page.route('**/api/marine/forecast**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_MARINE) }))
    await page.route('**/api/solar/times**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_SOLAR_TIMES) }))
    await page.route('**/api/solar/elevation**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_SOLAR_ELEVATION) }))
    await page.route('**/api/satellite/overpasses**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_OVERPASSES) }))

    await page.goto('/')

    // Weather section shows an error (⚠ prefix from useFetch)
    await scrollToSection(page, 'Weather')
    // Error message contains "500" — be tolerant of exact statusText wording
    await expect(page.locator('p').filter({ hasText: /500/ }))
      .toBeVisible({ timeout: 8_000 })

    // Tide panel is unaffected
    await scrollToSection(page, 'Tide')
    await expect(page.getByText(/Sea level now/)).toBeVisible()

    // Solar panel is unaffected
    await scrollToSection(page, 'Solar')
    await expect(page.locator('svg[aria-label*="Solar elevation"]')).toBeVisible()
  })

  test('verdict stays AWAITING DATA when wind values unavailable', async ({ page }) => {
    // Weather fails → windKt/gustKt/cloudPct remain null → pending → AWAITING DATA
    await page.route('**/api/weather/forecast**', r =>
      r.fulfill({ status: 500, body: 'error' }))
    await page.route('**/api/weather/advisories**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_ADVISORIES) }))
    await page.route('**/api/marine/forecast**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_MARINE) }))
    await page.route('**/api/solar/times**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_SOLAR_TIMES) }))
    await page.route('**/api/solar/elevation**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_SOLAR_ELEVATION) }))
    await page.route('**/api/satellite/overpasses**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_OVERPASSES) }))

    await page.goto('/')
    // Let tide/solar resolve so we can verify verdict stays pending despite them loading
    await page.waitForTimeout(1000)
    await expect(page.getByText('AWAITING DATA')).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('E2E-009: Sidebar collapse/expand', () => {
  test('sidebar collapses and expands', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    const collapseBtn = page.getByRole('button', { name: 'Collapse sidebar' })
    await expect(collapseBtn).toBeVisible()
    // Use dispatchEvent to bypass WebGL canvas pointer-event interception in all browsers
    await collapseBtn.dispatchEvent('click')
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible({ timeout: 3_000 })
    await page.getByRole('button', { name: 'Expand sidebar' }).dispatchEvent('click')
    // Allow 0.15s opacity transition to settle before asserting visibility
    await page.waitForTimeout(400)
    await expect(page.getByRole('heading', { name: 'BoatOps' })).toBeVisible()
  })
})
