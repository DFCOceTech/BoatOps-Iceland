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

const MOCK_WAVES = {
  hs_m: 0.31, vmdr_deg: 245, grid_lat: 54.17, grid_lon: 12.08,
  timestamp: '2026-05-03T06:00',
}

const MOCK_SOLAR_TIMES = {
  date: '2026-05-03', lat: 54.18, lon: 12.08,
  sunrise: '2026-05-03T03:42:00', sunset:  '2026-05-03T19:18:00',
  solar_noon: '2026-05-03T11:30:00',
  dawn_civil:  '2026-05-03T03:08:00', dusk_civil:  '2026-05-03T19:52:00',
  dawn_nautical: '2026-05-03T02:22:00', dusk_nautical: '2026-05-03T20:38:00',
  dawn_astronomical: '2026-05-03T01:21:00', dusk_astronomical: '2026-05-03T21:39:00',
}

const MOCK_SOLAR_ELEVATION = {
  elevation_deg: 42.3, azimuth_deg: 185.0,
  is_daylight: true, period: 'day',
  timestamp: '2026-05-03T10:00:00',
}

const MOCK_OVERPASSES = [
  { platform: 'Sentinel-2A', aos_utc: '2026-05-03T09:12:00',
    los_utc: '2026-05-03T09:22:00', max_elevation_deg: 67.4, duration_min: 10.2 },
  { platform: 'Landsat-9', aos_utc: '2026-05-03T14:05:00',
    los_utc: '2026-05-03T14:14:00', max_elevation_deg: 41.8, duration_min: 8.7 },
]

// Minimal valid 1×1 transparent PNG
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
  'AABjkB6QAAAABJRU5ErkJggg=='

const PNG_HEADERS = {
  'x-bbox':       '9.5,53.5,15.0,56.0',
  'x-timestamp':  '2026-05-03T10:00:00',
  'x-colorscale': JSON.stringify({ vmin: 0, vmax: 5, cmap: 'amp' }),
}

// ── Mock setup ────────────────────────────────────────────────────────────────

async function mockApis(page: Page) {
  await page.route('**/api/weather/forecast**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_WEATHER) }))
  await page.route('**/api/weather/advisories**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_ADVISORIES) }))
  await page.route('**/api/waves/forecast**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_WAVES) }))
  await page.route('**/api/solar/times**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SOLAR_TIMES) }))
  await page.route('**/api/solar/elevation**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SOLAR_ELEVATION) }))
  await page.route('**/api/satellite/overpasses**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_OVERPASSES) }))
  for (const path of [
    '**/api/waves/overlay**', '**/api/map/bathymetry**', '**/api/map/sst**',
    '**/api/map/salinity**',  '**/api/map/currents**',   '**/api/map/chlorophyll**',
    '**/api/map/oxygen**',
  ]) {
    await page.route(path, r => r.fulfill({
      status: 200, contentType: 'image/png',
      headers: PNG_HEADERS,
      body: Buffer.from(TINY_PNG_B64, 'base64'),
    }))
  }
  await page.route('**/api/satellite/s2-overlay**', r => r.fulfill({
    status: 200, contentType: 'image/png',
    headers: {
      'x-bbox': '9.5,53.5,15.0,56.0',
      'x-scene-id': 'S2A_MSIL2A_20260503T093041',
      'x-acquisition-time': '2026-05-03T09:30:41',
      'x-cloud-cover': '8.3',
    },
    body: Buffer.from(TINY_PNG_B64, 'base64'),
  }))
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
    // wind 13.6 kt (green), gusts 18.5 kt (green), Hs 0.31 m (green),
    // cloud 35% (amber ≤50), solar 42.3° (green) → one amber → CAUTION
    await expect(page.getByText('CAUTION')).toBeVisible({ timeout: 10_000 })
  })

  test('per-capability rows: wind, waves, solar values visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await expect(page.getByText('13.6 kt')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('0.31 m Hs')).toBeVisible({ timeout: 8_000 })
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
    await page.getByRole('button', { name: 'Save' }).click()
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

test.describe('E2E-004: Wave panel', () => {
  test('Hs value and Go/Caution/No-Go label visible', async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    await scrollToSection(page, 'Waves')
    // 0.31 m ≤ 0.4 → Go
    await expect(page.getByText('Go').first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('0.31').first()).toBeVisible()
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
  test('weather API failure shows error; waves and solar still render', async ({ page }) => {
    await page.route('**/api/weather/forecast**', r =>
      r.fulfill({ status: 500, body: 'Internal Server Error' }))
    await page.route('**/api/weather/advisories**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_ADVISORIES) }))
    await page.route('**/api/waves/forecast**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_WAVES) }))
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

    // Waves panel is unaffected
    await scrollToSection(page, 'Waves')
    await expect(page.getByText('0.31').first()).toBeVisible()

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
    await page.route('**/api/waves/forecast**', r =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_WAVES) }))
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
    // Let waves/solar resolve so we can verify verdict stays pending despite them loading
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
