import { describe, expect, it } from 'vitest'
import { pointInPolygon } from '@/lib/geo'
import { buildFormSchema } from '@/features/property/attributeSchema'
import { parse } from '@/services/schemas'
import { FIXTURE_PROFILES, FIXTURES } from './fixtures'
import { MOCK_METADATA } from './metadata'
import { findNeighbors } from './neighbors'

const byId = new Map(FIXTURES.map((p) => [p.id, p]))
const neighborCount = (id: string) => {
  const p = byId.get(id)!
  return findNeighbors({ ...p, excludeId: p.id }).length
}

describe('fixtures', () => {
  it('has unique ids and a sensible held-out / reference split', () => {
    expect(new Set(FIXTURES.map((p) => p.id)).size).toBe(FIXTURES.length)
    const held = FIXTURES.filter((p) => p.role === 'held_out_example')
    expect(held.length).toBeGreaterThanOrEqual(40)
    expect(FIXTURES.length - held.length).toBeGreaterThanOrEqual(10)
  })

  it('every record is valid, inside coverage, and passes the UI form schema', () => {
    const schema = buildFormSchema(MOCK_METADATA, 2015)
    const problems: string[] = []
    for (const p of FIXTURES) {
      parse.propertyDetail({ ...p, valuation_year: 2015, neighborhood_label: null })
      if (!pointInPolygon(p.longitude, p.latitude, MOCK_METADATA.coverage.polygon)) problems.push(`${p.id} outside coverage`)
      if (!schema.safeParse({ ...p.attributes, latitude: p.latitude, longitude: p.longitude }).success) {
        problems.push(`${p.id} fails form schema`)
      }
      if (p.sale_date && (p.sale_date < '2014-05-02' || p.sale_date > '2015-05-27')) problems.push(`${p.id} sale date`)
    }
    expect(problems).toEqual([])
  })

  it('KC-1042 is a complete held-out home with several neighbors', () => {
    const p = byId.get('KC-1042')!
    expect(p.role).toBe('held_out_example')
    expect(p.zipcode).not.toBeNull()
    expect(p.sale_date).not.toBeNull()
    expect(p.actual_price_usd).not.toBeNull()
    expect(neighborCount('KC-1042')).toBeGreaterThanOrEqual(4)
  })

  it('profile examples have the advertised characteristics', () => {
    const ids = (profile: string) =>
      Object.entries(FIXTURE_PROFILES)
        .filter(([, v]) => v.profile === profile)
        .map(([id]) => id)
    expect(Object.keys(FIXTURE_PROFILES).filter((id) => !byId.has(id))).toEqual([])
    expect(ids('waterfront').every((id) => byId.get(id)!.attributes.waterfront)).toBe(true)
    expect(ids('high-grade').some((id) => byId.get(id)!.attributes.grade >= 12)).toBe(true)
    expect(ids('missing-metadata').some((id) => {
      const p = byId.get(id)!
      return p.zipcode === null && p.sale_date === null && p.actual_price_usd === null
    })).toBe(true)
    expect(ids('zero-neighbors').every((id) => neighborCount(id) === 0)).toBe(true)
    expect(ids('sparse-neighbors').every((id) => neighborCount(id) <= 1)).toBe(true)
  })
})
