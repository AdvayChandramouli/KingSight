import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { EstimateResults } from './EstimateResults'
import { failed, metadata, renderWith, request, success, view, workflow } from './testFixtures'

const ERROR_LABEL = 'Estimate − recorded sale price'

describe('EstimateResults', () => {
  it('renders nothing before an estimate is requested', () => {
    const { container } = renderWith(<EstimateResults workflow={workflow()} metadata={metadata} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the primary estimate and its signed error against the recorded sale', () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000)])
    renderWith(<EstimateResults workflow={workflow({ current })} metadata={metadata} />)

    expect(screen.getByRole('heading', { name: 'Estimated historical value' })).toBeInTheDocument()
    expect(screen.getByTestId('primary-estimate-value')).toHaveTextContent('$523,400')
    expect(screen.getByText('Illustrative demo estimate')).toBeInTheDocument()
    expect(screen.getByText(ERROR_LABEL)).toBeInTheDocument()
    expect(screen.getByText('+$23,400')).toBeInTheDocument()
  })

  it('says the recorded sale price is unavailable when the record has none', () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000)])
    const wf = workflow({ current })
    if (wf.target.kind === 'existing') wf.target = { kind: 'existing', property: { ...wf.target.property, actual_price_usd: null } }
    renderWith(<EstimateResults workflow={wf} metadata={metadata} />)
    expect(screen.getByText('Recorded sale price unavailable — no comparison')).toBeInTheDocument()
    expect(screen.queryByText(ERROR_LABEL)).not.toBeInTheDocument()
  })

  it('never compares edited, hypothetical, or stale results with the recorded sale', () => {
    const outcomes = [success('xgboost', 600_000), success('gnn', 580_000)]
    const edited = view(outcomes, { request: request({ source: 'edited', client_request_id: 'req-2' }) })
    const original = view([success('xgboost', 523_400), success('gnn', 500_000)])
    const { unmount } = renderWith(
      <EstimateResults workflow={workflow({ current: edited, original })} metadata={metadata} />,
    )
    expect(screen.queryByText(ERROR_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText('Recorded sale price')).not.toBeInTheDocument()
    unmount()

    const hypothetical = view(outcomes, {
      request: request({ source: 'hypothetical', property_id: undefined, client_request_id: 'req-3' }),
    })
    const r2 = renderWith(
      <EstimateResults workflow={workflow({ target: { kind: 'hypothetical', initialLocation: null }, current: hypothetical })} metadata={metadata} />,
    )
    expect(screen.queryByText(ERROR_LABEL)).not.toBeInTheDocument()
    r2.unmount()

    renderWith(<EstimateResults workflow={workflow({ current: view(outcomes), isStale: true })} metadata={metadata} />)
    expect(screen.queryByText(ERROR_LABEL)).not.toBeInTheDocument()
  })

  it('marks stale results as the previous estimate', () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000)])
    renderWith(<EstimateResults workflow={workflow({ current, isStale: true })} metadata={metadata} />)
    expect(screen.getByText('Previous estimate')).toBeInTheDocument()
    expect(screen.getByText(/results are for your previous inputs/i)).toBeInTheDocument()
  })

  it('keeps the tabular estimate and offers a graph-model retry on partial failure', async () => {
    const gnn = failed('gnn')
    const current = view([success('xgboost', 523_400), gnn])
    renderWith(<EstimateResults workflow={workflow({ current })} metadata={metadata} />)

    expect(screen.getByTestId('primary-estimate-value')).toHaveTextContent('$523,400')
    const card = screen.getByRole('article', { name: 'Neighborhood-graph model estimate unavailable' })
    expect(within(card).getByText('The graph model timed out.')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Retry Neighborhood-graph model' }))
    expect(gnn.retry).toHaveBeenCalledTimes(1)
  })

  it('states the primary estimate is unavailable without promoting the graph result', async () => {
    const xgb = failed('xgboost', 'The property-feature model is unavailable.')
    const current = view([xgb, success('gnn', 488_000)])
    renderWith(<EstimateResults workflow={workflow({ current })} metadata={metadata} />)

    expect(screen.getByRole('heading', { name: 'Primary estimate unavailable' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Estimated historical value' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('primary-estimate-value')).not.toBeInTheDocument()
    expect(screen.getByText(/Neighborhood-graph model’s estimate, not the primary estimate/)).toBeInTheDocument()
    expect(screen.queryByText(ERROR_LABEL)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Retry Property-feature model' }))
    expect(xgb.retry).toHaveBeenCalledTimes(1)
  })

  it('compares the two models with a signed difference inside a collapsed accordion', async () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000)])
    renderWith(<EstimateResults workflow={workflow({ current })} metadata={metadata} />)

    const trigger = screen.getByRole('button', { name: /Compare models/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(screen.getByText('Neighborhood-graph − Property-feature')).toBeInTheDocument()
    expect(screen.getByText('−$23,400')).toBeInTheDocument()
    expect(screen.getByText(/estimates can differ|their estimates can differ/)).toBeInTheDocument()
  })

  it('shows a labeled pending state', () => {
    const pending = { ...success('xgboost', 0), state: 'pending' as const, result: null }
    const current = view([pending, { ...pending, modelId: 'gnn' }], { status: 'pending', response: null })
    renderWith(<EstimateResults workflow={workflow({ current })} metadata={metadata} />)
    expect(screen.getAllByText('Estimating…').length).toBeGreaterThan(0)
  })

  it('shows a whole-request error with a same-snapshot retry and field errors', async () => {
    const current = view([failed('xgboost'), failed('gnn')], {
      status: 'error',
      response: null,
      error: {
        title: 'Check the property details',
        message: 'Some details are invalid.',
        retryable: true,
        code: 'invalid_input',
        fieldErrors: { sqft_living: 'Must be positive.' },
      },
    })
    renderWith(<EstimateResults workflow={workflow({ current })} metadata={metadata} />)
    expect(screen.getByText('Check the property details')).toBeInTheDocument()
    expect(screen.getByText('Living area:')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(current.retry).toHaveBeenCalledTimes(1)
  })

  it('gives an actionable out-of-coverage message', () => {
    const current = view([failed('xgboost'), failed('gnn')], {
      status: 'error',
      response: null,
      error: { title: 'Outside supported area', message: 'Outside.', retryable: false, code: 'out_of_coverage', fieldErrors: null },
    })
    renderWith(<EstimateResults workflow={workflow({ current })} metadata={metadata} />)
    expect(screen.getByText(/Choose a location inside the coverage area/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('shows the sensitivity comparison for the same model version', () => {
    const edited = view([success('xgboost', 560_000, 'pred-2'), success('gnn', 520_000, 'pred-2')], {
      request: request({ source: 'edited', client_request_id: 'req-2', attributes: { ...request().attributes, sqft_living: 2400 } }),
    })
    const original = view([success('xgboost', 523_400), success('gnn', 500_000, 'pred-1', 'v2')])
    renderWith(<EstimateResults workflow={workflow({ current: edited, original })} metadata={metadata} />)

    expect(screen.getByRole('heading', { name: 'Sensitivity exploration' })).toBeInTheDocument()
    expect(screen.getByText(/not what a renovation would be worth/)).toBeInTheDocument()
    expect(screen.getByText('Living area')).toBeInTheDocument()
    expect(screen.getByText('+$36,600')).toBeInTheDocument()
    expect(screen.getByText(/different model versions/)).toBeInTheDocument()
  })
})
