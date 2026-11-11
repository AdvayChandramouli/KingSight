import { describe, expect, it } from 'vitest'
import type { NeighborContext } from '@/services/types'
import { cachedPreviewNeighbors } from './usePreviewEstimate'

const cached = {
  prediction_id: 'pred-1',
  graph_version: 'g',
  rule_label: '8 nearest',
  neighbors: [{ property: { id: 'KC-9' }, distance_meters: 120, edge_type: 'geographic' }],
} as NeighborContext

describe('cachedPreviewNeighbors', () => {
  it('shows connected homes only when that prediction is already cached', () => {
    expect(cachedPreviewNeighbors('pred-1', cached)).toBe(cached.neighbors)
    expect(cachedPreviewNeighbors('pred-2', cached)).toEqual([])
    expect(cachedPreviewNeighbors(null, cached)).toEqual([])
    expect(cachedPreviewNeighbors('pred-1', undefined)).toEqual([])
  })
})
