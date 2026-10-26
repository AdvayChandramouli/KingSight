import { describe, expect, it } from 'vitest'
import { haversineMeters } from '@/lib/geo'
import { FIXTURES } from './fixtures'
import { findNeighbors, NEIGHBOR_K, NEIGHBOR_RADIUS_KM } from './neighbors'

const target = FIXTURES.find((p) => p.id === 'KC-1042')!

describe('findNeighbors', () => {
  it('excludes the target, respects k and radius, and reports real distances', () => {
    const neighbors = findNeighbors({ ...target, excludeId: target.id })
    expect(neighbors.length).toBeGreaterThan(0)
    expect(neighbors.length).toBeLessThanOrEqual(NEIGHBOR_K)
    for (const n of neighbors) {
      expect(n.property.id).not.toBe(target.id)
      expect(n.edge_type).toBe('combined')
      expect(n.distance_meters).toBe(Math.round(haversineMeters(target, n.property)))
      expect(n.distance_meters!).toBeLessThanOrEqual(NEIGHBOR_RADIUS_KM * 1000)
    }
  })

  it('is stable across calls and returns independent copies', () => {
    const a = findNeighbors({ ...target, excludeId: target.id })
    const b = findNeighbors({ ...target, excludeId: target.id })
    expect(a).toEqual(b)
    a[0]!.property.attributes.grade = 99
    expect(FIXTURES.every((p) => p.attributes.grade <= 13)).toBe(true)
  })

  it('changes when living area and grade change materially', () => {
    const original = findNeighbors({ ...target, excludeId: target.id }).map((n) => n.property.id)
    const edited = findNeighbors({
      ...target,
      attributes: { ...target.attributes, sqft_living: 4400, grade: 11 },
      excludeId: target.id,
    }).map((n) => n.property.id)
    expect(edited).not.toEqual(original)
  })

  it('returns nothing for a remote location', () => {
    expect(findNeighbors({ latitude: 47.72, longitude: -121.2, attributes: target.attributes })).toEqual([])
  })
})
