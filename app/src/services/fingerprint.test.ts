import { describe, expect, it } from 'vitest'
import { attributesEqual, inputFingerprint, stableStringify, toPredictRequest } from './fingerprint'
import type { PredictInput } from './types'

const input: PredictInput = {
  source: 'existing',
  property_id: 'KC-1042',
  latitude: 47.6838,
  longitude: -122.2987,
  valuation_year: 2015,
  attributes: { sqft_living: 1870, bedrooms: 3, bathrooms: 2, grade: 8, condition: 4, yr_built: 1941, waterfront: false },
  model_ids: ['xgboost', 'gnn'],
}

describe('fingerprint', () => {
  it('stableStringify ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }))
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }))
  })

  it('is stable across key order and model order', () => {
    const reordered: PredictInput = {
      model_ids: ['gnn', 'xgboost'],
      attributes: { waterfront: false, yr_built: 1941, condition: 4, grade: 8, bathrooms: 2, bedrooms: 3, sqft_living: 1870 },
      valuation_year: 2015,
      longitude: -122.2987,
      latitude: 47.6838,
      property_id: 'KC-1042',
      source: 'existing',
    }
    expect(inputFingerprint(reordered)).toBe(inputFingerprint(input))
    expect(toPredictRequest(reordered).client_request_id).toBe(toPredictRequest(input).client_request_id)
    expect(attributesEqual(reordered.attributes, input.attributes)).toBe(true)
  })

  it('changes with model selection and attributes', () => {
    const base = inputFingerprint(input)
    expect(inputFingerprint({ ...input, model_ids: ['xgboost'] })).not.toBe(base)
    expect(inputFingerprint({ ...input, attributes: { ...input.attributes, sqft_living: 1871 } })).not.toBe(base)
    expect(inputFingerprint({ ...input, source: 'edited' })).not.toBe(base)
  })

  it('attaches a request id derived from the snapshot', () => {
    expect(toPredictRequest(input).client_request_id).toBe(`req-${inputFingerprint(input)}`)
  })
})
