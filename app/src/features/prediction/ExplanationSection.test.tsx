import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { KingSightClient } from '@/services/client'
import type { Explanation } from '@/services/types'
import { ExplanationSection } from './ExplanationSection'
import { failed, fakeClient, metadata, renderWith, success, view, workflow } from './testFixtures'

function explanation(modelId: string, space: Explanation['output_space']): Explanation {
  const usd = space === 'usd'
  return {
    prediction_id: modelId === 'gnn' ? 'pred-gnn' : 'pred-1',
    model_id: modelId,
    model_version: 'v1',
    scope: 'local',
    method: 'shap',
    output_space: space,
    reference_output: usd ? 480_000 : 13.08,
    features: [
      { key: 'sqft_living', label: 'Living area', value: 1800, contribution: usd ? 42_100 : 0.081 },
      { key: 'grade', label: 'Grade', value: 7, contribution: usd ? -12_300 : -0.024 },
      { key: 'yr_built', label: 'Year built', value: 1975, contribution: usd ? 3_000 : 0.004 },
      { key: 'bedrooms', label: 'Bedrooms', value: 3, contribution: usd ? -1_000 : -0.002 },
      { key: 'bathrooms', label: 'Bathrooms', value: 2, contribution: usd ? 800 : 0.001 },
      { key: 'condition', label: 'Condition', value: 3, contribution: usd ? 500 : 0.0008 },
      { key: 'waterfront', label: 'Waterfront', value: 'No', contribution: usd ? -200 : -0.0003 },
    ],
  }
}

const getExplanation = vi.fn<KingSightClient['getExplanation']>(async (_predictionId: string, modelId: string) =>
  explanation(modelId, modelId === 'gnn' ? 'log_usd' : 'usd'),
)

describe('ExplanationSection', () => {
  it('labels dollar contributions and shows the top six with signs and direction', async () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000, 'pred-gnn')])
    const client = fakeClient({ getExplanation })
    renderWith(<ExplanationSection workflow={workflow({ current })} metadata={metadata} />, { client })

    expect(await screen.findByText('Contributions in US dollars')).toBeInTheDocument()
    expect(getExplanation).toHaveBeenCalledWith('pred-1', 'xgboost', expect.anything())
    expect(screen.getByText('+$42,100')).toBeInTheDocument()
    expect(screen.getByText('−$12,300')).toBeInTheDocument()
    expect(screen.getByText('$480,000')).toBeInTheDocument()
    expect(screen.getAllByText('raised').length).toBeGreaterThan(0)
    expect(screen.getAllByText('lowered').length).toBeGreaterThan(0)
    expect(screen.queryByText('Waterfront')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show all 7 attributes' }))
    expect(screen.getByText('Waterfront')).toBeInTheDocument()
  })

  it('labels log-price contributions and never formats them as dollars', async () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000, 'pred-gnn')])
    const client = fakeClient({ getExplanation })
    renderWith(<ExplanationSection workflow={workflow({ current })} metadata={metadata} />, { client })
    await screen.findByText('Contributions in US dollars')

    await userEvent.click(screen.getByRole('radio', { name: 'Neighborhood-graph model' }))
    const label = await screen.findByText('Contributions in log-price units — not dollars')
    expect(getExplanation).toHaveBeenCalledWith('pred-gnn', 'gnn', expect.anything())
    expect(screen.getByText('+0.081')).toBeInTheDocument()
    expect(screen.getByText('13.080 log-price')).toBeInTheDocument()
    expect(label).toBeInTheDocument()
    const row = screen.getByText('+0.081').closest('li') as HTMLElement
    expect(row.textContent).not.toContain('$')
    // Only the reference output carries an approximate dollar equivalent.
    expect(screen.getByText(/≈ \$/)).toBeInTheDocument()
  })

  it('only offers models with a successful estimate', async () => {
    const current = view([success('xgboost', 523_400), failed('gnn')])
    renderWith(<ExplanationSection workflow={workflow({ current })} metadata={metadata} />, {
      client: fakeClient({ getExplanation }),
    })
    await screen.findByText('Contributions in US dollars')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('shows an unavailable message when no contributions are returned', async () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000)])
    const client = fakeClient({
      getExplanation: vi.fn<KingSightClient['getExplanation']>(async () => ({ ...explanation('xgboost', 'usd'), features: [] })),
    })
    renderWith(<ExplanationSection workflow={workflow({ current })} metadata={metadata} />, { client })
    expect(await screen.findByText('Feature explanation unavailable for this estimate')).toBeInTheDocument()
  })

  it('shows an independent error with retry', async () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000)])
    const fn = vi.fn<KingSightClient['getExplanation']>().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(explanation('xgboost', 'usd'))
    renderWith(<ExplanationSection workflow={workflow({ current })} metadata={metadata} />, {
      client: fakeClient({ getExplanation: fn }),
    })
    expect(await screen.findByText('Explanation couldn’t load')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('Contributions in US dollars')).toBeInTheDocument())
  })

  it('shows global importance only when returned, in its own block', async () => {
    const current = view([success('xgboost', 523_400), success('gnn', 500_000)])
    const client = fakeClient({
      getExplanation: vi.fn<KingSightClient['getExplanation']>(async () => ({
        ...explanation('xgboost', 'usd'),
        global_importance: [{ key: 'grade', label: 'Grade', importance: 0.31 }],
      })),
    })
    renderWith(<ExplanationSection workflow={workflow({ current })} metadata={metadata} />, { client })
    expect(await screen.findByRole('heading', { name: 'Across evaluated homes' })).toBeInTheDocument()
  })
})
