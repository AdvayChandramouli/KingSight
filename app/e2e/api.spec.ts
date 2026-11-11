import { expect, test } from '@playwright/test'
import { expectHistoricalLabel, expectMapSurface, trackMapTraffic } from './support.ts'

/**
 * API-mode flows against the real local API (`data_mode: real` on :8000).
 *
 * Partial GNN failure is not simulable here. Developer `?scenario=` hooks run
 * only when `VITE_DATA_MODE=mock` (`config.scenariosEnabled`). The API has no
 * env flag that fails the graph model while leaving the tabular model up, and
 * forcing that would mean breaking the live server. The unknown-id test covers
 * the honest not-found path the API actually returns.
 */
const API = 'http://127.0.0.1:8000'

test.describe('explorer (api)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  let heldOutId = ''

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${API}/health`)
    expect(health.ok(), 'KingSight API must be running on port 8000').toBeTruthy()
    expect(await health.json()).toMatchObject({ status: 'ok', data_mode: 'real' })

    const listed = await request.get(`${API}/properties?limit=1`)
    expect(listed.ok()).toBeTruthy()
    const body = (await listed.json()) as { items: { id: string; role: string }[] }
    const first = body.items[0]
    if (!first) throw new Error('catalog must include a held-out property')
    heldOutId = first.id
    expect(heldOutId).toMatch(/^\d+$/)
    expect(heldOutId.startsWith('KC-')).toBeFalsy()
    expect(first.role).toBe('held_out_example')
  })

  test('landing map has no demo badge and keeps the historical label', async ({ page }) => {
    const traffic = trackMapTraffic(page)
    await page.goto('/')

    await expectHistoricalLabel(page)
    await expect(page.getByText('Demo data')).toHaveCount(0)
    await expectMapSurface(page, 'landing', traffic, 45_000)
  })

  test('Open this property deep-links to the held-out preview id', async ({ page }) => {
    await page.goto('/')
    const summary = page.getByRole('heading', { name: new RegExp(`^Property ${heldOutId}$`) })
    await expect(summary).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: 'Open this property' }).click()
    await expect(page).toHaveURL(new RegExp(`/explore\\?property=${heldOutId}$`))
    await expect(page.getByRole('heading', { name: `Property ${heldOutId}` })).toBeVisible()
    await expect(page.getByText('Demo data')).toHaveCount(0)
    await expectHistoricalLabel(page)
  })

  test('explorer map has no demo badge and keeps the historical label', async ({ page }) => {
    const traffic = trackMapTraffic(page)
    await page.goto('/explore')

    await expectHistoricalLabel(page)
    await expect(page.getByText('Demo data')).toHaveCount(0)
    await expect(page.getByText(/Demo mode:/)).toHaveCount(0)
    await expectMapSurface(page, 'explorer', traffic, 45_000)
  })

  test('deep link estimates, compares, explains, and draws neighbors', async ({ page }) => {
    const traffic = trackMapTraffic(page)
    await page.goto(`/explore?property=${heldOutId}&neighbors=1`)

    await expect(page.getByRole('heading', { name: `Property ${heldOutId}` })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Demo data')).toHaveCount(0)
    await expectHistoricalLabel(page)
    await expectMapSurface(page, 'explorer', traffic, 45_000)

    await page.getByRole('button', { name: 'Estimate this property' }).click()
    await expect(page.getByTestId('primary-estimate-value')).toHaveText(/^\$[\d,]+$/, { timeout: 90_000 })
    await expectHistoricalLabel(page)

    await page.getByRole('button', { name: /Compare models/ }).click()
    await expect(page.getByText(/Neighborhood-graph − Property-feature/)).toBeVisible({ timeout: 30_000 })

    const explanation = page.getByRole('region', { name: 'See what shaped the estimate' })
    await expect(explanation).toBeVisible()
    // Served explanations are in log-price units. Mock mode labels the tabular model in dollars.
    await expect(explanation.getByText('Contributions in log-price units — not dollars')).toBeVisible({
      timeout: 30_000,
    })
    await expect(explanation.getByRole('listitem').first()).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Connected homes' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/\d+ connected homes? returned/)).toBeVisible()
    const legend = page.getByRole('region', { name: 'Graph connections legend' })
    await expect(legend).toBeVisible()
    await expect(legend).toContainText(/Connected home \(([1-9]\d*)\)/)
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
  })

  test('hypothetical estimate shows imputation warnings', async ({ page }) => {
    await page.goto(`/explore?property=${heldOutId}&mode=create`)

    await expect(page.getByRole('heading', { name: 'Create a property' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(`Starting from the location of ${heldOutId}`)).toBeVisible()
    await expect(page.getByText('Demo data')).toHaveCount(0)
    await expectHistoricalLabel(page)

    await page.getByRole('button', { name: 'Estimate this property' }).click()
    const assumptions = page.getByRole('status').filter({ hasText: 'Assumptions in this estimate' })
    await expect(assumptions).toBeVisible({ timeout: 90_000 })
    await expect(assumptions).toContainText(/imput/i)
    await expect(page.getByText(/Recorded sale/)).toHaveCount(0)
  })

  test('unknown property id shows not-found', async ({ page }) => {
    await page.goto('/explore?property=missing-property-id')
    await expect(page.getByRole('heading', { name: 'Property not found' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('missing-property-id', { exact: true })).toBeVisible()
    await expect(page.getByText('Demo data')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Browse properties' })).toBeVisible()
  })
})
