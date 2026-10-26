import { describe, expect, it } from 'vitest'
import { ApiError } from '@/services/client'
import { toPredictRequest } from '@/services/fingerprint'
import type { PredictInput, PredictRequest } from '@/services/types'
import { FIXTURES } from './fixtures'
import { MockKingSightClient } from './MockKingSightClient'
import { ScenarioStore, type ScenarioId } from './scenarios'

const KC1042 = FIXTURES.find((p) => p.id === 'KC-1042')!

function setup(scenarios: ScenarioId[] = []) {
  const store = new ScenarioStore(scenarios)
  return { client: new MockKingSightClient({ scenarios: store, latencyMs: 0 }), store }
}

function existing(overrides: Partial<PredictInput> = {}): PredictRequest {
  return toPredictRequest({
    source: 'existing',
    property_id: KC1042.id,
    latitude: KC1042.latitude,
    longitude: KC1042.longitude,
    valuation_year: 2015,
    attributes: { ...KC1042.attributes },
    model_ids: ['xgboost', 'gnn'],
    ...overrides,
  })
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
}

async function apiRejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await rejection(promise)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('MockKingSightClient metadata and health', () => {
  it('returns mock metadata without verified metrics', async () => {
    const { client } = setup()
    const metadata = await client.getMetadata()
    expect(client.mode).toBe('mock')
    expect(metadata.data_mode).toBe('mock')
    expect(metadata.metrics).toBeNull()
    expect(metadata.primary_model_id).toBe('xgboost')
    expect(metadata.models.map((m) => m.id)).toEqual(['xgboost', 'gnn'])
    expect(await client.getHealth()).toEqual({ status: 'ok', data_mode: 'mock' })
  })

  it('returns fresh copies', async () => {
    const { client } = setup()
    const a = await client.getMetadata()
    a.models.length = 0
    expect((await client.getMetadata()).models).toHaveLength(2)
  })
})

describe('listProperties', () => {
  it('lists only held-out examples, sorted, with pagination', async () => {
    const { client } = setup()
    const first = await client.listProperties({ limit: 20 })
    const heldOut = FIXTURES.filter((p) => p.role === 'held_out_example')
    expect(first.total).toBe(heldOut.length)
    expect(first.items).toHaveLength(20)
    expect(first.items.every((p) => p.role === 'held_out_example')).toBe(true)
    const ids = first.items.map((p) => p.id)
    expect(ids).toEqual([...ids].sort())
    expect(first.next_cursor).toBe('20')

    const seen = [...ids]
    let cursor = first.next_cursor
    while (cursor) {
      const page = await client.listProperties({ limit: 20, cursor })
      seen.push(...page.items.map((p) => p.id))
      cursor = page.next_cursor
    }
    expect(seen).toEqual(heldOut.map((p) => p.id).sort())
  })

  it('defaults to 24 items and caps the limit at 50', async () => {
    const { client } = setup()
    expect((await client.listProperties({})).items).toHaveLength(24)
    expect((await client.listProperties({ limit: 500 })).items.length).toBeLessThanOrEqual(50)
  })

  it('filters by ID text, ZIP prefix, zip, waterfront, size, and bbox', async () => {
    const { client } = setup()
    expect((await client.listProperties({ q: 'kc-1042' })).items.map((p) => p.id)).toEqual(['KC-1042'])
    const zipPrefix = await client.listProperties({ q: '981' })
    expect(zipPrefix.items.length).toBeGreaterThan(0)
    expect(zipPrefix.items.every((p) => p.zipcode?.startsWith('981') || p.id.toLowerCase().includes('981'))).toBe(true)

    const zip = await client.listProperties({ zip: '98115' })
    expect(zip.items.every((p) => p.zipcode === '98115')).toBe(true)

    const water = await client.listProperties({ waterfront: true })
    expect(water.items.length).toBeGreaterThan(0)
    expect(water.items.every((p) => p.attributes.waterfront)).toBe(true)

    const sized = await client.listProperties({ min_sqft: 1500, max_sqft: 2000, limit: 50 })
    expect(sized.items.every((p) => p.attributes.sqft_living >= 1500 && p.attributes.sqft_living <= 2000)).toBe(true)

    const bbox: [number, number, number, number] = [-122.45, 47.5, -122.25, 47.75]
    const boxed = await client.listProperties({ bbox, limit: 50 })
    expect(boxed.items.length).toBeGreaterThan(0)
    expect(
      boxed.items.every((p) => p.longitude >= bbox[0] && p.latitude >= bbox[1] && p.longitude <= bbox[2] && p.latitude <= bbox[3]),
    ).toBe(true)
  })

  it('returns no items in the empty scenario', async () => {
    const { client } = setup(['empty'])
    expect(await client.listProperties({})).toEqual({ items: [], next_cursor: null, total: 0 })
  })
})

describe('getProperty', () => {
  it('returns details for held-out and reference-only records', async () => {
    const { client } = setup()
    const detail = await client.getProperty('KC-1042')
    expect(detail).toMatchObject({ id: 'KC-1042', valuation_year: 2015, neighborhood_label: null })
    const reference = FIXTURES.find((p) => p.role === 'reference_only')!
    expect((await client.getProperty(reference.id)).role).toBe('reference_only')
  })

  it('falls back to the default valuation year without a sale date', async () => {
    const { client } = setup()
    const missing = FIXTURES.find((p) => p.sale_date === null)!
    expect((await client.getProperty(missing.id)).valuation_year).toBe(2015)
  })

  it('rejects unknown ids with a friendly not_found error', async () => {
    const { client } = setup()
    const error = await apiRejection(client.getProperty('KC-9999'))
    expect(error.code).toBe('not_found')
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('KC-9999')
  })
})

describe('predict, explanation, and neighbors', () => {
  it('is deterministic for identical input', async () => {
    const { client } = setup()
    const a = await client.predict(existing())
    const b = await client.predict(existing())
    expect(a).toEqual(b)
    expect(a.data_mode).toBe('mock')
    expect(a.prediction_id).toBe(`demo-pred-${a.input_fingerprint}`)
    expect(a.client_request_id).toBe(existing().client_request_id)
    expect(a.results.every((r) => r.status === 'success' && r.interval === undefined)).toBe(true)

    expect(await client.getExplanation(a.prediction_id, 'xgboost')).toEqual(
      await client.getExplanation(a.prediction_id, 'xgboost'),
    )
    expect(await client.getNeighbors(a.prediction_id)).toEqual(await client.getNeighbors(a.prediction_id))

    const fresh = setup().client
    expect(await fresh.predict(existing())).toEqual(a)
  })

  it('changes when input changes', async () => {
    const { client } = setup()
    const original = await client.predict(existing())
    const edited = await client.predict(
      existing({ source: 'edited', attributes: { ...KC1042.attributes, sqft_living: 2600 } }),
    )
    expect(edited.prediction_id).not.toBe(original.prediction_id)
    expect(edited.results[0]!.predicted_price_usd).not.toBe(original.results[0]!.predicted_price_usd)
    expect(await client.getExplanation(edited.prediction_id, 'xgboost')).not.toEqual(
      await client.getExplanation(original.prediction_id, 'xgboost'),
    )
  })

  it('only computes requested models and marks unknown ones unavailable', async () => {
    const { client } = setup()
    const response = await client.predict(existing({ model_ids: ['gnn', 'mystery'] }))
    expect(response.results.map((r) => [r.model_id, r.status])).toEqual([
      ['gnn', 'success'],
      ['mystery', 'unavailable'],
    ])
    expect(response.results[1]!.predicted_price_usd).toBeNull()
  })

  it('explains in dollars for the tabular model and log-price for the graph model', async () => {
    const { client } = setup()
    const response = await client.predict(existing())
    const price = (id: string) => response.results.find((r) => r.model_id === id)!.predicted_price_usd!

    const tabular = await client.getExplanation(response.prediction_id, 'xgboost')
    expect(tabular.output_space).toBe('usd')
    expect(tabular.scope).toBe('local')
    const usdSum = tabular.features.reduce((s, f) => s + f.contribution, tabular.reference_output!)
    expect(usdSum).toBe(price('xgboost'))
    expect(tabular.features.map((f) => f.label)).toContain('Location (latitude)')

    const graph = await client.getExplanation(response.prediction_id, 'gnn')
    expect(graph.output_space).toBe('log_usd')
    const logSum = graph.features.reduce((s, f) => s + f.contribution, graph.reference_output!)
    expect(logSum).toBeCloseTo(Math.log(price('gnn')), 9)
    expect(graph.features.map((f) => f.label)).toContain('Connected homes (graph context)')
  })

  it('returns request-specific neighbors that exclude the target', async () => {
    const { client } = setup()
    const original = await client.predict(existing())
    const context = await client.getNeighbors(original.prediction_id)
    expect(context.neighbors.length).toBeGreaterThan(0)
    expect(context.neighbors.every((n) => n.property.id !== KC1042.id)).toBe(true)
    expect(context.rule_label).toMatch(/up to 6 nearby homes/)

    const edited = await client.predict(
      existing({ source: 'edited', attributes: { ...KC1042.attributes, sqft_living: 4400, grade: 11 } }),
    )
    const editedIds = (await client.getNeighbors(edited.prediction_id)).neighbors.map((n) => n.property.id)
    expect(editedIds).not.toEqual(context.neighbors.map((n) => n.property.id))
  })

  it('accepts hypothetical properties without a property id', async () => {
    const { client } = setup()
    const response = await client.predict(
      toPredictRequest({
        source: 'hypothetical',
        latitude: 47.61,
        longitude: -122.2,
        valuation_year: 2015,
        attributes: { sqft_living: 1900, bedrooms: 3, bathrooms: 2, grade: 7, condition: 3, yr_built: 1975, waterfront: false },
        model_ids: ['xgboost'],
      }),
    )
    expect(response.results[0]!.status).toBe('success')
  })

  it('warns when values fall outside the historical range', async () => {
    const { client } = setup()
    const response = await client.predict(existing({ attributes: { ...KC1042.attributes, sqft_living: 20_000 } }))
    expect(response.warnings.some((w) => w.includes('Living area'))).toBe(true)
  })

  it('rejects invalid input with field errors', async () => {
    const { client } = setup()
    const error = await apiRejection(
      client.predict(
        existing({
          source: 'edited',
          attributes: { ...KC1042.attributes, bathrooms: 1.3, grade: 14, sqft_living: 0, yr_built: 2020 },
          latitude: Number.NaN,
        }),
      ),
    )
    expect(error.code).toBe('invalid_input')
    expect(error.retryable).toBe(false)
    expect(Object.keys(error.field_errors ?? {}).sort()).toEqual(
      ['bathrooms', 'grade', 'latitude', 'sqft_living', 'yr_built'].sort(),
    )
  })

  it('rejects locations outside the coverage polygon', async () => {
    const { client } = setup()
    const error = await apiRejection(
      client.predict(existing({ source: 'hypothetical', property_id: undefined, latitude: 47.25, longitude: -120.9 })),
    )
    expect(error.code).toBe('out_of_coverage')
    expect(error.retryable).toBe(false)
    expect(error.message).toMatch(/King County/)
  })

  it('rejects unknown properties for existing-source requests', async () => {
    const { client } = setup()
    const error = await apiRejection(client.predict(existing({ property_id: 'KC-0000' })))
    expect(error.code).toBe('not_found')
  })

  it('rejects unknown prediction ids for explanations and neighbors', async () => {
    const { client } = setup()
    expect((await apiRejection(client.getExplanation('nope', 'xgboost'))).code).toBe('not_found')
    expect((await apiRejection(client.getNeighbors('nope'))).code).toBe('not_found')
  })
})

describe('scenarios', () => {
  it('partial: graph model fails on combined requests; single-model retry succeeds', async () => {
    const { client } = setup(['partial'])
    const combined = await client.predict(existing())
    const gnn = combined.results.find((r) => r.model_id === 'gnn')!
    expect(gnn.status).toBe('error')
    expect(gnn.predicted_price_usd).toBeNull()
    expect(gnn.message).toBe('The neighborhood-graph model could not produce an estimate for this request.')
    expect(combined.results.find((r) => r.model_id === 'xgboost')!.status).toBe('success')
    expect((await apiRejection(client.getExplanation(combined.prediction_id, 'gnn'))).code).toBe('model_failure')

    const retry = await client.predict(existing({ model_ids: ['gnn'] }))
    expect(retry.results).toHaveLength(1)
    expect(retry.results[0]!.status).toBe('success')
  })

  it('predict-error: first attempt fails retryably, retry succeeds', async () => {
    const { client } = setup(['predict-error'])
    const error = await apiRejection(client.predict(existing()))
    expect(error.code).toBe('service_unavailable')
    expect(error.retryable).toBe(true)
    expect((await client.predict(existing())).results[0]!.status).toBe('success')
  })

  it('explain-error: first attempt per model fails, retry succeeds', async () => {
    const { client } = setup(['explain-error'])
    const response = await client.predict(existing())
    const error = await apiRejection(client.getExplanation(response.prediction_id, 'xgboost'))
    expect(error.code).toBe('service_unavailable')
    expect(error.retryable).toBe(true)
    expect((await client.getExplanation(response.prediction_id, 'xgboost')).model_id).toBe('xgboost')
    expect((await apiRejection(client.getExplanation(response.prediction_id, 'gnn'))).retryable).toBe(true)
    expect((await client.getExplanation(response.prediction_id, 'gnn')).model_id).toBe('gnn')
  })

  it('neighbors-unavailable: first attempt fails, retry succeeds', async () => {
    const { client } = setup(['neighbors-unavailable'])
    const response = await client.predict(existing())
    const error = await apiRejection(client.getNeighbors(response.prediction_id))
    expect(error.code).toBe('service_unavailable')
    expect(error.retryable).toBe(true)
    expect((await client.getNeighbors(response.prediction_id)).neighbors.length).toBeGreaterThan(0)
  })

  it('out-of-coverage: every estimate is rejected', async () => {
    const { client } = setup(['out-of-coverage'])
    expect((await apiRejection(client.predict(existing()))).code).toBe('out_of_coverage')
    expect((await apiRejection(client.predict(existing()))).code).toBe('out_of_coverage')
  })

  it('reads scenarios at call time', async () => {
    const { client, store } = setup()
    expect((await client.listProperties({})).items.length).toBeGreaterThan(0)
    store.set(['empty'])
    expect((await client.listProperties({})).items).toHaveLength(0)
  })
})

describe('latency and cancellation', () => {
  it('rejects with AbortError when already aborted', async () => {
    const { client } = setup()
    const controller = new AbortController()
    controller.abort()
    const error = await rejection(client.getProperty('KC-1042', controller.signal))
    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')
  })

  it('rejects with AbortError when aborted during the simulated delay', async () => {
    const client = new MockKingSightClient({ latencyMs: 50 })
    const controller = new AbortController()
    const pending = client.predict(existing(), controller.signal)
    controller.abort()
    const error = await rejection(pending)
    expect((error as DOMException).name).toBe('AbortError')
  })

  it('aborted attempts do not consume first-attempt failures', async () => {
    const store = new ScenarioStore(['predict-error'])
    const client = new MockKingSightClient({ scenarios: store, latencyMs: 20 })
    const controller = new AbortController()
    const pending = client.predict(existing(), controller.signal)
    controller.abort()
    await rejection(pending)
    expect((await apiRejection(client.predict(existing()))).code).toBe('service_unavailable')
  })
})
