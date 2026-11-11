import { describe, expect, it } from 'vitest'
import { asMapEngineFailure, chooseMapEngine } from './mapEngine'

describe('map engine policy', () => {
  it('uses MapLibre when WebGL is available and the style has not failed', () => {
    expect(chooseMapEngine({ scenarioUnavailable: false, webgl: true, failure: null })).toBe('maplibre')
  })

  it('uses the labeled schematic map when WebGL is missing', () => {
    expect(chooseMapEngine({ scenarioUnavailable: false, webgl: false, failure: null })).toBe('schematic')
  })

  it('falls back to the schematic map when the style fails or times out', () => {
    expect(chooseMapEngine({ scenarioUnavailable: false, webgl: true, failure: 'style' })).toBe('schematic')
    expect(chooseMapEngine({ scenarioUnavailable: false, webgl: true, failure: 'timeout' })).toBe('schematic')
    expect(chooseMapEngine({ scenarioUnavailable: false, webgl: true, failure: asMapEngineFailure('tile') })).toBe('schematic')
  })

  it('shows the unavailable notice for the scenario or a lost WebGL context', () => {
    expect(chooseMapEngine({ scenarioUnavailable: true, webgl: true, failure: null })).toBe('unavailable')
    expect(chooseMapEngine({ scenarioUnavailable: true, webgl: false, failure: null })).toBe('unavailable')
    expect(chooseMapEngine({ scenarioUnavailable: false, webgl: true, failure: 'context-lost' })).toBe('unavailable')
    expect(chooseMapEngine({ scenarioUnavailable: false, webgl: true, failure: 'webgl' })).toBe('unavailable')
  })
})
