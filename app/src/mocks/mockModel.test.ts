import { describe, expect, it } from 'vitest'
import { FIXTURES } from './fixtures'
import { graphValuation, tabularValuation, type ValuationInput } from './mockModel'
import { rankNeighbors } from './neighbors'

function graphFor(p: ValuationInput & { id?: string }) {
  const connected = rankNeighbors({ ...p, excludeId: p.id }).map((n) => ({ ...n.record, score: n.score }))
  return graphValuation(p, connected)
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('demo valuation functions', () => {
  it('property-feature contributions add up to the USD estimate exactly', () => {
    for (const p of FIXTURES) {
      const v = tabularValuation(p)
      expect(v.output_space).toBe('usd')
      expect(Number.isInteger(v.predicted_price_usd)).toBe(true)
      expect(v.reference_output + sum(v.features.map((f) => f.contribution))).toBe(v.predicted_price_usd)
    }
  })

  it('applies an explicit, still-additive floor for extreme inputs', () => {
    const tiny: ValuationInput = {
      latitude: 47.7,
      longitude: -121.4,
      attributes: { sqft_living: 100, bedrooms: 10, bathrooms: 0, grade: 1, condition: 1, yr_built: 2015, waterfront: false },
    }
    const v = tabularValuation(tiny)
    expect(v.predicted_price_usd).toBe(60_000)
    expect(v.features.some((f) => f.key === 'demo_floor')).toBe(true)
    expect(v.reference_output + sum(v.features.map((f) => f.contribution))).toBe(v.predicted_price_usd)
  })

  it('graph contributions add up to the log of the estimate', () => {
    for (const p of FIXTURES) {
      const v = graphFor(p)
      expect(v.output_space).toBe('log_usd')
      expect(v.reference_output).toBeGreaterThan(10)
      expect(v.reference_output).toBeLessThan(15)
      expect(v.reference_output + sum(v.features.map((f) => f.contribution))).toBeCloseTo(
        Math.log(v.predicted_price_usd),
        9,
      )
      expect(v.features.some((f) => f.key === 'graph_context')).toBe(true)
    }
  })

  it('is deterministic', () => {
    const p = FIXTURES[0]!
    expect(tabularValuation(p)).toEqual(tabularValuation(structuredClone(p)))
    expect(graphFor(p)).toEqual(graphFor(structuredClone(p)))
  })

  it('produces plausible historical price levels', () => {
    const outliers: string[] = []
    for (const p of FIXTURES) {
      const t = tabularValuation(p).predicted_price_usd
      const g = graphFor(p).predicted_price_usd
      if (t < 80_000 || t > 5_000_000 || Math.abs(g / t - 1) >= 0.3) outliers.push(`${p.id}: ${t} vs ${g}`)
    }
    expect(outliers).toEqual([])
  })

  it('the model-disagreement example differs by roughly 15–25%', () => {
    const p = FIXTURES.find((f) => f.id === 'KC-1007')!
    const gap = Math.abs(graphFor(p).predicted_price_usd / tabularValuation(p).predicted_price_usd - 1)
    expect(gap).toBeGreaterThan(0.15)
    expect(gap).toBeLessThan(0.25)
  })
})
