import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ExplorerProvider } from '@/features/explorer/ExplorerProvider'
import type { ScenarioId } from '@/mocks/scenarios'
import { renderWithApp } from '@/test/render'
import { DetailsPanel } from './DetailsPanel'

const RECORDED_ERROR = 'Estimate − recorded sale price'

function renderPanel({ path = '/explore?property=KC-1042', scenarios = [] as ScenarioId[] } = {}) {
  const user = userEvent.setup()
  const utils = renderWithApp(
    <ExplorerProvider onOpenHowItWorks={() => {}}>
      <DetailsPanel />
    </ExplorerProvider>,
    { initialEntries: [path], scenarios },
  )
  return { user, ...utils }
}

const field = (name: string) => screen.getByRole('spinbutton', { name })
const estimateButton = () => screen.getByRole('button', { name: /Estimate this property|Update estimate/ })

async function setNumber(user: ReturnType<typeof userEvent.setup>, name: string, value: string) {
  const input = field(name)
  await user.clear(input)
  await user.type(input, value)
}

async function estimate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(estimateButton())
  return screen.findByTestId('primary-estimate-value')
}

describe('DetailsPanel · existing property', () => {
  it('shows the record and asks for an estimate without implying one exists', async () => {
    renderPanel()
    expect(screen.getByText('Loading property KC-1042…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Property KC-1042' })).toBeInTheDocument()
    expect(screen.getByText('Recorded sale price')).toBeInTheDocument()
    expect(screen.getByText('$598,000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Estimate this property' })).toBeInTheDocument()
    expect(screen.queryByText('Estimated historical value')).not.toBeInTheDocument()
  })

  it('compares an unchanged estimate with the recorded sale price', async () => {
    const { user } = renderPanel()
    await screen.findByRole('heading', { name: 'Property KC-1042' })
    await estimate(user)
    expect(screen.getByText(RECORDED_ERROR)).toBeInTheDocument()
    expect(screen.getByText('The results below match these details.')).toBeInTheDocument()
  })

  it('shows inline errors for invalid input and keeps submit aria-disabled', async () => {
    const { user } = renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Edit details' }))

    await setNumber(user, 'Grade', '14')
    await setNumber(user, 'Bathrooms', '1.3')

    expect(await screen.findByText('Grade must be 13 or less.')).toBeInTheDocument()
    expect(screen.getByText(/Bathrooms must use quarter increments/)).toBeInTheDocument()
    expect(field('Grade')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Grade')).toHaveAccessibleDescription(/Grade must be 13 or less\./)
    expect(field('Bathrooms')).toHaveAccessibleDescription(/quarter increments/)

    const submit = estimateButton()
    expect(submit).toHaveAttribute('aria-disabled', 'true')
    await user.click(submit)
    await waitFor(() => expect(field('Bathrooms')).toHaveFocus())
    expect(screen.queryByText('Estimated historical value')).not.toBeInTheDocument()
  })

  it('marks the previous estimate stale after an edit, then shows sensitivity without the recorded-price error', async () => {
    const { user } = renderPanel()
    await screen.findByRole('heading', { name: 'Property KC-1042' })
    await estimate(user)

    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await setNumber(user, 'Living area', '2400')

    expect(screen.getByText(/was 1,870 sq ft/)).toBeInTheDocument()
    expect(screen.getAllByText('Previous estimate').length).toBeGreaterThan(0)
    expect(screen.queryByText(RECORDED_ERROR)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Update estimate' }))
    expect(await screen.findByRole('heading', { name: 'Sensitivity exploration' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Previous estimate')).not.toBeInTheDocument())
    expect(screen.queryByText(RECORDED_ERROR)).not.toBeInTheDocument()
    expect(screen.getByText('Original property · recorded historical sale')).toBeInTheDocument()
  })

  it('reset restores the exact original attributes and the original estimate', async () => {
    const { user } = renderPanel()
    await screen.findByRole('heading', { name: 'Property KC-1042' })
    await estimate(user)
    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await setNumber(user, 'Living area', '2400')
    await setNumber(user, 'Bedrooms', '5')
    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('button', { name: 'Update estimate' }))
    await screen.findByRole('heading', { name: 'Sensitivity exploration' })

    await user.click(screen.getByRole('button', { name: 'Reset changes' }))

    expect(field('Living area')).toHaveValue(1870)
    expect(field('Bedrooms')).toHaveValue(3)
    expect(field('Bathrooms')).toHaveValue(2)
    expect(field('Grade')).toHaveValue(8)
    expect(field('Condition')).toHaveValue(4)
    expect(field('Year built')).toHaveValue(1941)
    expect(screen.getByRole('radio', { name: 'No' })).toBeChecked()
    expect(screen.queryByText(/^Changed$/)).not.toBeInTheDocument()
    expect(await screen.findByText(RECORDED_ERROR)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sensitivity exploration' })).not.toBeInTheDocument()
  })

  it('keeps the successful model on partial failure and recovers with a per-model retry', async () => {
    const { user } = renderPanel({ scenarios: ['partial'] })
    await screen.findByRole('heading', { name: 'Property KC-1042' })
    await estimate(user)

    const alert = await screen.findByRole('article', { name: 'Neighborhood-graph model estimate unavailable' })
    expect(screen.getByTestId('primary-estimate-value')).toHaveTextContent(/^\$[\d,]+$/)

    await user.click(within(alert).getByRole('button', { name: 'Retry Neighborhood-graph model' }))
    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Neighborhood-graph model estimate unavailable' })).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: /Compare models/ }))
    expect(await screen.findByText(/Neighborhood-graph − property-feature/i)).toBeInTheDocument()
  })

  it('labels explanation output spaces: dollars for the property-feature model, log-price for the graph model', async () => {
    const { user } = renderPanel()
    await screen.findByRole('heading', { name: 'Property KC-1042' })
    await estimate(user)

    expect(await screen.findByText('Contributions in US dollars')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Neighborhood-graph model' }))
    expect(await screen.findByText('Contributions in log-price units — not dollars')).toBeInTheDocument()
    expect(screen.queryByText('Contributions in US dollars')).not.toBeInTheDocument()
  })

  it('keeps inputs when the prediction fails and retries the same snapshot', async () => {
    const { user } = renderPanel({ scenarios: ['predict-error'] })
    await user.click(await screen.findByRole('button', { name: 'Edit details' }))
    await setNumber(user, 'Living area', '2400')
    await user.click(estimateButton())

    const alert = await screen.findByRole('alert')
    expect(field('Living area')).toHaveValue(2400)

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('primary-estimate-value')).toBeInTheDocument()
    expect(field('Living area')).toHaveValue(2400)
    expect(screen.queryByText(RECORDED_ERROR)).not.toBeInTheDocument()
  })

  it('shows an inline not-found state with a way back to browsing', async () => {
    const { user } = renderPanel({ path: '/explore?property=KC-0000' })
    expect(await screen.findByRole('heading', { name: 'Property not found' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Browse properties' }))
    expect(await screen.findByRole('heading', { name: 'Explore a home’s value in context' })).toBeInTheDocument()
  })
})

describe('DetailsPanel · intro', () => {
  it('offers example properties and opens one', async () => {
    const { user } = renderPanel({ path: '/explore' })
    expect(screen.getByRole('heading', { name: 'Explore a home’s value in context' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create a property' })).toBeInTheDocument()
    const rows = await screen.findAllByRole('button', { name: /^KC-\d+/ })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(4)
    const id = rows[0]!.textContent!.match(/KC-\d+/)![0]
    await user.click(rows[0]!)
    expect(await screen.findByRole('heading', { name: `Property ${id}` })).toBeInTheDocument()
  })
})

describe('DetailsPanel · hypothetical property', () => {
  it('starts from the previous selection’s labeled location and never shows a recorded price', async () => {
    const { user } = renderPanel({ path: '/explore?property=KC-1042&mode=create' })
    expect(await screen.findByRole('heading', { name: 'Create a property' })).toBeInTheDocument()
    expect(screen.getByText('Starting from the location of KC-1042 — edit as needed.')).toBeInTheDocument()
    expect(field('Latitude')).toHaveValue(47.6838)
    expect(screen.getByText(/Illustrative starting values/)).toBeInTheDocument()

    await estimate(user)
    expect(screen.queryByText(RECORDED_ERROR)).not.toBeInTheDocument()
    expect(screen.queryByText(/Recorded sale/)).not.toBeInTheDocument()
    expect(screen.queryByText('$598,000')).not.toBeInTheDocument()
  })

  it('rejects an out-of-coverage location with an actionable message', async () => {
    const { user } = renderPanel({ path: '/explore?mode=create' })
    expect(await screen.findByText('Choose a location to begin.')).toBeInTheDocument()
    await user.type(field('Latitude'), '46.2')
    await user.type(field('Longitude'), '-122.3')

    expect(await screen.findByText(/This location is outside King County, Washington/)).toBeInTheDocument()
    expect(field('Latitude')).toHaveAttribute('aria-invalid', 'true')
    expect(estimateButton()).toHaveAttribute('aria-disabled', 'true')
    await user.click(estimateButton())
    expect(screen.queryByText('Estimated historical value')).not.toBeInTheDocument()
  })
})
