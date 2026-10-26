import { haversineMeters } from '@/lib/geo'
import type { Neighbor, PropertyAttributes, PropertyRecord } from '@/services/types'
import { FIXTURES } from './fixtures'

export const NEIGHBOR_K = 6
export const NEIGHBOR_RADIUS_KM = 6

/** Weights for the combined distance; 2 km of travel ≈ one grade step ≈ a 1.65× size gap. */
const GEO_SCALE_KM = 2
const SQFT_WEIGHT = 2
const GRADE_WEIGHT = 1

export type NeighborQuery = {
  latitude: number
  longitude: number
  attributes: PropertyAttributes
  /** Excluded so a property is never its own neighbor. */
  excludeId?: string
}

export type RankedNeighbor = {
  record: PropertyRecord
  meters: number
  /** Combined distance; lower means closer and more similar. */
  score: number
}

/**
 * Request-specific graph connections: the k nearest fixtures by a combined
 * geographic + structural distance, restricted to a geographic radius, so
 * changing living area or grade can change the set.
 */
export function rankNeighbors(query: NeighborQuery, pool: readonly PropertyRecord[] = FIXTURES): RankedNeighbor[] {
  const ranked: RankedNeighbor[] = []
  for (const record of pool) {
    if (record.id === query.excludeId) continue
    const meters = haversineMeters(query, record)
    if (meters > NEIGHBOR_RADIUS_KM * 1000) continue
    const sizeGap = Math.abs(
      Math.log(Math.max(record.attributes.sqft_living, 1) / Math.max(query.attributes.sqft_living, 1)),
    )
    const gradeGap = Math.abs(record.attributes.grade - query.attributes.grade)
    const score = meters / 1000 / GEO_SCALE_KM + SQFT_WEIGHT * sizeGap + GRADE_WEIGHT * gradeGap
    ranked.push({ record, meters, score })
  }
  ranked.sort((a, b) => a.score - b.score || (a.record.id < b.record.id ? -1 : 1))
  return ranked.slice(0, NEIGHBOR_K)
}

export function toNeighbor({ record, meters }: RankedNeighbor): Neighbor {
  return { property: structuredClone(record), distance_meters: Math.round(meters), edge_type: 'combined' }
}

export function findNeighbors(query: NeighborQuery, pool?: readonly PropertyRecord[]): Neighbor[] {
  return rankNeighbors(query, pool).map(toNeighbor)
}
