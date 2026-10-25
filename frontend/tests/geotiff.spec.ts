/**
 * User-supplied GeoTIFF overlays (drone ortho / sonar rasters). All client-side — no API calls.
 * Fixtures are generated in-test with geotiff's writer so no binary files are committed.
 * REQ-IS-11 / SCENARIO-IS-11a..e (openspec/capabilities/iceland-site/spec.md)
 */
import { test, expect, type Page } from '@playwright/test'
import { writeArrayBuffer } from 'geotiff'
import proj4 from 'proj4'

const UTM28 = '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs'

function tiff(values: ArrayLike<number>, meta: Record<string, unknown>): Buffer {
  return Buffer.from(writeArrayBuffer(values as number[], meta as never))
}

/** 40×30 RGB, EPSG:4326, 0.0005° pixels, NW corner (-16.20, 64.06). */
function rgbGeographic(): Buffer {
  const w = 40, h = 30, v = new Uint8Array(w * h * 3)
  for (let i = 0; i < w * h; i++) { v[i * 3] = (i % w) * 6; v[i * 3 + 1] = 120; v[i * 3 + 2] = 200 }
  return tiff(v, {
    width: w, height: h, SamplesPerPixel: 3, BitsPerSample: [8, 8, 8], PhotometricInterpretation: 2,
    ModelPixelScale: [0.0005, 0.0005, 0], ModelTiepoint: [0, 0, 0, -16.2, 64.06, 0],
    GTModelTypeGeoKey: 2, GTRasterTypeGeoKey: 1, GeographicTypeGeoKey: 4326,
  })
}

/** 20×20 float32 sonar-like depth raster, UTM 28N (EPSG:32628), 5 m pixels, with a nodata corner. */
function depthUtm(): { buf: Buffer; lng: number; lat: number } {
  const lng = -16.18, lat = 64.05
  const [x, y] = proj4('EPSG:4326', UTM28, [lng, lat])
  const w = 20, h = 20, v = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) v[i] = i < 10 ? -9999 : 5 + (i % w) + Math.floor(i / w)    // depth 5…43 m
  const buf = tiff(v, {
    width: w, height: h, SamplesPerPixel: 1, BitsPerSample: [32], SampleFormat: [3], PhotometricInterpretation: 1,
    ModelPixelScale: [5, 5, 0], ModelTiepoint: [0, 0, 0, x, y, 0], GDAL_NODATA: '-9999',
    GTModelTypeGeoKey: 1, GTRasterTypeGeoKey: 1, ProjectedCSTypeGeoKey: 32628,
  })
  return { buf, lng, lat }
}

function unsupportedCrs(): Buffer {
  return tiff(new Uint8Array(4 * 4), {
    width: 4, height: 4, SamplesPerPixel: 1, BitsPerSample: [8], PhotometricInterpretation: 1,
    ModelPixelScale: [1, 1, 0], ModelTiepoint: [0, 0, 0, 1500000, 5200000, 0],
    GTModelTypeGeoKey: 1, GTRasterTypeGeoKey: 1, ProjectedCSTypeGeoKey: 2193,
  })
}

const upload = (page: Page, name: string, buffer: Buffer, mimeType = 'image/tiff') =>
  page.getByLabel('Add GeoTIFF files').setInputFiles({ name, mimeType, buffer })

test.describe('E2E-014: local GeoTIFF overlays', () => {
  test.beforeEach(async ({ page }) => {
    for (const p of ['**/api/**']) await page.route(p, r => r.fulfill({ status: 404, body: 'n/a' }))
    await page.goto('/')
  })

  test('RGB geographic GeoTIFF loads with correct bounds', async ({ page }) => {
    await upload(page, 'ortho_day1.tif', rgbGeographic())
    await expect(page.getByText('ortho_day1.tif')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/RGB · EPSG:4326/)).toBeVisible()
    // 40 px × 0.0005° = 0.02° wide, 30 px = 0.015° tall from (-16.20, 64.06)
    await expect(page.getByText('W -16.2000 S 64.0450 E -16.1800 N 64.0600')).toBeVisible()
  })

  test('UTM single-band depth raster is reprojected and gets a colour ramp', async ({ page }) => {
    const { buf, lng, lat } = depthUtm()
    await upload(page, 'sonar_depth.tif', buf)
    await expect(page.getByText(/Single band · EPSG:32628/)).toBeVisible({ timeout: 10_000 })
    const txt = await page.getByText(/W -?[\d.]+ S [\d.]+/).first().innerText()
    const m = /W (-?[\d.]+) S ([\d.]+) E (-?[\d.]+) N ([\d.]+)/.exec(txt)!
    expect(Math.abs(Number(m[1]) - lng)).toBeLessThan(0.0005)      // tiepoint lands where we put it
    expect(Math.abs(Number(m[4]) - lat)).toBeLessThan(0.0005)
    // nodata (-9999) must not pollute the auto range: depth values are 5…43
    const min = Number(await page.getByLabel('Min sonar_depth.tif').inputValue())
    const max = Number(await page.getByLabel('Max sonar_depth.tif').inputValue())
    expect(min).toBeGreaterThanOrEqual(5); expect(max).toBeLessThanOrEqual(43); expect(max).toBeGreaterThan(min)
  })

  test('changing range/ramp and opacity keeps the layer; invalid range is flagged', async ({ page }) => {
    await upload(page, 'sonar_depth.tif', depthUtm().buf)
    await expect(page.getByText('sonar_depth.tif')).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Ramp sonar_depth.tif').selectOption('grey')
    await page.getByLabel('Min sonar_depth.tif').fill('10')
    await page.getByLabel('Max sonar_depth.tif').fill('30')
    await page.getByLabel('Opacity sonar_depth.tif').fill('0.5')
    await expect(page.getByText('sonar_depth.tif')).toBeVisible()
    await page.getByLabel('Max sonar_depth.tif').fill('5')
    await expect(page.getByText('Max must be greater than min.')).toBeVisible()
    await page.getByRole('button', { name: 'Auto' }).click()
    await expect(page.getByText('Max must be greater than min.')).toHaveCount(0)
  })

  test('unsupported CRS gives an actionable error and loads nothing', async ({ page }) => {
    await upload(page, 'nz.tif', unsupportedCrs())
    await expect(page.getByText(/EPSG:2193 is not built in/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/gdalwarp/).first()).toBeVisible()
    await expect(page.getByLabel('Show nz.tif')).toHaveCount(0)
  })

  test('non-tiff file and corrupt tiff are rejected without breaking the page', async ({ page }) => {
    await upload(page, 'notes.txt', Buffer.from('hello'), 'text/plain')
    await expect(page.getByText(/Not a \.tif\/\.tiff file/)).toBeVisible()
    await upload(page, 'broken.tif', Buffer.from('this is not a tiff'))
    await expect(page.getByText(/broken\.tif:/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Imagery — your GeoTIFFs')).toBeVisible()
  })

  test('layers can be hidden and removed; two files coexist', async ({ page }) => {
    await upload(page, 'a.tif', rgbGeographic())
    await expect(page.getByLabel('Show a.tif')).toBeChecked({ timeout: 10_000 })
    await upload(page, 'b.tif', depthUtm().buf)
    await expect(page.getByLabel('Show b.tif')).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Show a.tif').uncheck()
    await expect(page.getByLabel('Show a.tif')).not.toBeChecked()
    await page.getByRole('button', { name: 'Remove a.tif' }).click()
    await expect(page.getByLabel('Show a.tif')).toHaveCount(0)
    await expect(page.getByLabel('Show b.tif')).toBeVisible()
  })

  test('layer survives moving the work site (panel is not site-keyed)', async ({ page }) => {
    await upload(page, 'a.tif', rgbGeographic())
    await expect(page.getByLabel('Show a.tif')).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Latitude').fill('64.07')
    await page.getByLabel('Longitude').fill('-16.21')
    await page.getByRole('button', { name: 'Go', exact: true }).click()
    await expect(page.getByLabel('Show a.tif')).toBeVisible()
  })
})
