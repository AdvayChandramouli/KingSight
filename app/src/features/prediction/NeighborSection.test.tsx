import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { KingSightClient } from '@/services/client'
import type { Neighbor, NeighborContext } from '@/services/types'
import { NeighborSection } from './NeighborSection'
import { attributes, explorerStub, fakeClient, metadata, renderWith, success, view, workflow } from './testFixtures'

const heldOut: Neighbor = {
  property: {
    id: 'KC-2001',
    latitude: 47.61,
    longitude: -122.31,
    zipcode: '98103',
    sale_date: '2014-08-01',
    actual_price_usd: 610_000,
    attributes: { ...attributes, sqft_living: 2100, grade: 8 },
    role: 'held_out_example',
  },
  distance_meters: 420,
  edge_type: 'geographic',
}

const reference: Neighbor = {
  property: { ...heldOut.property, id: 'REF-77', role: 'reference_only', actual_price_usd: null },
  distance_meters: 900,
  edge_type: 'combined',
}

function context(neighbors: Neighbor[]): NeighborContext {
  return { prediction_id: 'pred-1', graph_version: 'g1', rule_label: '8 nearest homes within 2 km', neighbors }
}

const current = view([success('xgboost', 523_400), success('gnn', 500_000)])

describe('NeighborSection', () => {
  it('explains when no connected homes were returned', async () => {
    const explorer = explorerStub()
    renderWith(<NeighborSection workflow={workflow({ current })} metadata={metadata} targetKey="property:KC-1042" />, {
      client: fakeClient({ getNeighbors: vi.fn<KingSightClient['getNeighbors']>(async () => context([])) }),
      explorer,
    })
    expect(
      await screen.findByText(
        'This home has few close connections in the graph, so there is limited neighborhood context.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Property / })).not.toBeInTheDocument()
  })

  it('lists neighbors, publishes the overlay, and inspects without changing the target', async () => {
    const explorer = explorerStub()
    const ctx = context([heldOut, reference])
    renderWith(<NeighborSection workflow={workflow({ current })} metadata={metadata} targetKey="property:KC-1042" />, {
      client: fakeClient({ getNeighbors: vi.fn<KingSightClient['getNeighbors']>(async () => ctx) }),
      explorer,
    })

    expect(await screen.findByText('2 connected homes returned')).toBeInTheDocument()
    expect(screen.getByText('8 nearest homes within 2 km')).toBeInTheDocument()
    expect(screen.getByText('Reference-only')).toBeInTheDocument()
    await waitFor(() =>
      expect(explorer.setNeighborOverlay).toHaveBeenLastCalledWith({
        targetKey: 'property:KC-1042',
        origin: { latitude: 47.6, longitude: -122.3 },
        context: ctx,
      }),
    )

    await userEvent.click(screen.getByRole('button', { name: /Property KC-2001/ }))
    expect(explorer.inspectNeighbor).toHaveBeenCalledWith(heldOut)
    expect(explorer.selectProperty).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('switch', { name: 'Show connections on map' }))
    expect(explorer.setShowNeighbors).toHaveBeenCalledWith(true)
  })

  it('offers Explore only for explorable neighbors and labels historical prices', async () => {
    const explorer = explorerStub({ inspectedNeighbor: heldOut })
    renderWith(<NeighborSection workflow={workflow({ current })} metadata={metadata} targetKey="property:KC-1042" />, {
      client: fakeClient({ getNeighbors: vi.fn<KingSightClient['getNeighbors']>(async () => context([heldOut, reference])) }),
      explorer,
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Explore this property' }))
    expect(explorer.selectProperty).toHaveBeenCalledWith('KC-2001')
    expect(screen.getByText(/historical observation, not a model input/)).toBeInTheDocument()
  })

  it('does not publish an overlay for stale results', async () => {
    const explorer = explorerStub()
    renderWith(
      <NeighborSection workflow={workflow({ current, isStale: true })} metadata={metadata} targetKey="property:KC-1042" />,
      { client: fakeClient({ getNeighbors: vi.fn<KingSightClient['getNeighbors']>(async () => context([heldOut])) }), explorer },
    )
    await screen.findByText('1 connected home returned')
    expect(screen.getByText('Previous estimate')).toBeInTheDocument()
    expect(explorer.setNeighborOverlay).not.toHaveBeenCalledWith(expect.objectContaining({ targetKey: 'property:KC-1042' }))
  })

  it('shows an honest note when graph context is unavailable', () => {
    renderWith(
      <NeighborSection
        workflow={workflow({ current })}
        metadata={{ ...metadata, graph: { ...metadata.graph, available: false } }}
        targetKey="property:KC-1042"
      />,
    )
    expect(screen.getByText('Graph context unavailable')).toBeInTheDocument()
  })

  it('shows a retryable error', async () => {
    const fn = vi.fn<KingSightClient['getNeighbors']>().mockRejectedValueOnce(new Error('x')).mockResolvedValue(context([heldOut]))
    renderWith(<NeighborSection workflow={workflow({ current })} metadata={metadata} targetKey="property:KC-1042" />, {
      client: fakeClient({ getNeighbors: fn }),
    })
    expect(await screen.findByText('Connected homes couldn’t load')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('1 connected home returned')).toBeInTheDocument()
  })
})
