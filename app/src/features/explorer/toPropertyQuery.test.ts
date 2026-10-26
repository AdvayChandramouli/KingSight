import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS } from './explorerState'
import { activeFilterCount, toPropertyQuery } from './toPropertyQuery'

describe('toPropertyQuery', () => {
  it('sends no constraints for empty filters', () => {
    expect(toPropertyQuery(EMPTY_FILTERS)).toEqual({})
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
  })

  it('maps search, living-area range, and waterfront', () => {
    expect(toPropertyQuery({ q: '  98103 ', minSqft: 1200, maxSqft: 2400, waterfront: 'yes' })).toEqual({
      q: '98103',
      min_sqft: 1200,
      max_sqft: 2400,
      waterfront: true,
    })
    expect(toPropertyQuery({ ...EMPTY_FILTERS, waterfront: 'no' })).toEqual({ waterfront: false })
  })

  it('keeps a zero minimum and omits whitespace-only search', () => {
    expect(toPropertyQuery({ ...EMPTY_FILTERS, q: '   ', minSqft: 0 })).toEqual({ min_sqft: 0 })
  })

  it('counts the living-area range as one filter', () => {
    expect(activeFilterCount({ q: 'KC', minSqft: 1000, maxSqft: 2000, waterfront: 'no' })).toBe(3)
  })
})
