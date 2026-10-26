import type { PropertyQuery } from '@/services/types'
import type { Filters } from './explorerState'

/** Maps explorer filters to the list query. Map and list share it so they show the same records. */
export function toPropertyQuery(filters: Filters): PropertyQuery {
  const query: PropertyQuery = {}
  const q = filters.q.trim()
  if (q) query.q = q
  if (filters.minSqft != null) query.min_sqft = filters.minSqft
  if (filters.maxSqft != null) query.max_sqft = filters.maxSqft
  if (filters.waterfront !== 'any') query.waterfront = filters.waterfront === 'yes'
  return query
}

export function activeFilterCount(filters: Filters): number {
  let count = 0
  if (filters.q.trim()) count++
  if (filters.minSqft != null || filters.maxSqft != null) count++
  if (filters.waterfront !== 'any') count++
  return count
}
