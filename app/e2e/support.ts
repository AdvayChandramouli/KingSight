import { expect, type Page } from '@playwright/test'

/** Default style when `VITE_MAP_STYLE_URL` is unset or empty. */
export const POSITRON_STYLE = 'https://tiles.openfreemap.org/styles/positron'

export const HISTORICAL_LABEL = 'Historical estimates · 2014–2015 sales'

const OSM_TILE_HOST = 'tile.openstreetmap.org'

export type MapTraffic = {
  positronStyle: string[]
  osmTiles: string[]
}

export function trackMapTraffic(page: Page): MapTraffic {
  const traffic: MapTraffic = { positronStyle: [], osmTiles: [] }
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith(POSITRON_STYLE)) traffic.positronStyle.push(url)
    if (url.includes(OSM_TILE_HOST)) traffic.osmTiles.push(url)
  })
  return traffic
}

/**
 * MapLibre canvas when the Positron style loads; otherwise the labeled
 * schematic or unavailable fallback. A blocked tile host must not fail the
 * test once that fallback is on screen. A visible canvas must have requested
 * Positron and show the OpenStreetMap attribution.
 */
export async function expectMapSurface(
  page: Page,
  surface: 'landing' | 'explorer',
  traffic: MapTraffic,
  timeout = 20_000,
): Promise<'maplibre' | 'fallback'> {
  const canvas = page.locator('canvas.maplibregl-canvas')
  const fallback =
    surface === 'landing'
      ? page.getByText('Schematic map, not to scale')
      : page.getByText(/Schematic map · offline preview, not a geographic basemap|Map unavailable/)

  await expect(canvas.or(fallback).first()).toBeVisible({ timeout })
  expect(traffic.osmTiles, 'the app must not call tile.openstreetmap.org').toEqual([])

  if (await canvas.isVisible()) {
    expect(
      traffic.positronStyle.length,
      'MapLibre loaded, so the empty style URL must have requested OpenFreeMap Positron',
    ).toBeGreaterThan(0)
    if (surface === 'landing') {
      await expect(page.getByRole('region', { name: 'Map preview of this property' })).toBeVisible()
      await expect(page.getByText('Schematic map, not to scale')).toHaveCount(0)
    } else {
      await expect(
        page.getByRole('region', { name: 'Property map. The property list shows the same records.' }),
      ).toBeVisible()
      await expect(page.getByText('Schematic map · offline preview, not a geographic basemap')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Map unavailable' })).toHaveCount(0)
    }
    await expectOsmAttribution(page)
    return 'maplibre'
  }

  await expect(fallback.first()).toBeVisible()
  return 'fallback'
}

async function expectOsmAttribution(page: Page) {
  const control = page.locator('.maplibregl-ctrl-attrib')
  await expect(control).toBeVisible()
  const credit = control.getByText(/OpenStreetMap contributors/)
  const toggle = control.locator('.maplibregl-ctrl-attrib-button')
  if (!(await credit.isVisible()) && (await toggle.isVisible())) await toggle.click()
  await expect(credit).toBeVisible()
}

export async function expectHistoricalLabel(page: Page) {
  await expect(page.getByText(HISTORICAL_LABEL).first()).toBeVisible()
}
