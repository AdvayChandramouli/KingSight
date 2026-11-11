import { expect, test } from '@playwright/test'
import { expectHistoricalLabel, expectMapSurface, trackMapTraffic } from './support.ts'

/**
 * Mock-mode map smoke. The Playwright server sets `VITE_MAP_STYLE_URL` to an
 * empty string, which resolves to OpenFreeMap Positron. A custom style URL
 * winning over that default is covered by `src/app/config.test.ts`.
 */
test.describe('map (mock)', () => {
  test('landing shows a geographic map, the historical label, and the demo badge', async ({ page }) => {
    const traffic = trackMapTraffic(page)
    await page.goto('/')

    await expectHistoricalLabel(page)
    await expect(page.getByText('Demo data').first()).toBeVisible()
    await expectMapSurface(page, 'landing', traffic)
  })

  test('Open this property deep-links to the preview id', async ({ page }) => {
    await page.goto('/')
    const summary = page.getByRole('heading', { name: /^Property KC-\d+$/ })
    await expect(summary).toBeVisible()
    const id = (await summary.innerText()).replace(/^Property\s+/, '').trim()

    await page.getByRole('link', { name: 'Open this property' }).click()
    await expect(page).toHaveURL(new RegExp(`/explore\\?property=${id}$`))
    await expect(page.getByRole('heading', { name: `Property ${id}` })).toBeVisible()
    await expectHistoricalLabel(page)
  })

  test('explorer shows a geographic map and the historical label', async ({ page }) => {
    const traffic = trackMapTraffic(page)
    await page.goto('/explore')

    await expectHistoricalLabel(page)
    await expect(page.getByText('Demo data').first()).toBeVisible()
    await expectMapSurface(page, 'explorer', traffic)
  })

  test('filtering the list keeps the same records on the map', async ({ page }) => {
    const traffic = trackMapTraffic(page)
    await page.goto('/explore')
    await expectMapSurface(page, 'explorer', traffic)

    await expect(page.getByText(/^[1-9]\d* properties$/)).toBeVisible()

    await page.getByLabel('Search property ID or ZIP').fill('KC-1042')
    await expect(page.getByText(/^1 of [\d,]+ properties$/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Property KC-1042/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Property KC-\d+/ })).toHaveCount(1)
    await expectMapSurface(page, 'explorer', traffic)
  })
})
