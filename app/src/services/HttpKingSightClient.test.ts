import { describe, expect, it } from 'vitest'
import { MOCK_METADATA } from '@/mocks/metadata'
import { ApiError } from './client'
import { HttpKingSightClient } from './HttpKingSightClient'
import type { PredictRequest } from './types'

type Call = { url: string; init: RequestInit | undefined }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function fakeFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    return respond(url, init)
  }) as typeof fetch
  return { fetchImpl, calls }
}

/** Never resolves on its own; rejects with the signal's abort reason. */
const hangingFetch = (async (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })) as typeof fetch

function client(fetchImpl: typeof fetch, timeoutMs = 1000) {
  return new HttpKingSightClient({ baseUrl: 'https://api.example.test/v1/', timeoutMs, fetchImpl })
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

const predictRequest: PredictRequest = {
  client_request_id: 'req-1',
  source: 'hypothetical',
  latitude: 47.6,
  longitude: -122.3,
  valuation_year: 2015,
  attributes: { sqft_living: 1900, bedrooms: 3, bathrooms: 2, grade: 7, condition: 3, yr_built: 1975, waterfront: false },
  model_ids: ['xgboost'],
}

const predictResponse = {
  prediction_id: 'p-1',
  client_request_id: 'req-1',
  input_fingerprint: 'abc',
  data_mode: 'real',
  generated_at: '2026-01-01T00:00:00Z',
  dataset_version: 'v1',
  results: [{ model_id: 'xgboost', version: '1', status: 'success', predicted_price_usd: 500_000 }],
  warnings: [],
}

describe('HttpKingSightClient', () => {
  it('parses successful responses and builds the proposed paths', async () => {
    const { fetchImpl, calls } = fakeFetch((url) => {
      if (url.endsWith('/metadata')) return jsonResponse({ ...MOCK_METADATA, data_mode: 'real' })
      if (url.includes('/properties?')) return jsonResponse({ items: [], next_cursor: null, total: 0 })
      if (url.endsWith('/predict')) return jsonResponse(predictResponse)
      if (url.endsWith('/health')) return jsonResponse({ status: 'ok', data_mode: 'real' })
      return jsonResponse({}, 500)
    })
    const api = client(fetchImpl)
    expect(api.mode).toBe('api')
    expect((await api.getMetadata()).data_mode).toBe('real')
    await api.listProperties({ bbox: [-122.5, 47.1, -121.3, 47.8], zip: '98115', q: 'KC', waterfront: false, min_sqft: 500, max_sqft: 3000, cursor: '24', limit: 24 })
    expect((await api.predict(predictRequest)).prediction_id).toBe('p-1')
    expect(await api.getHealth()).toEqual({ status: 'ok', data_mode: 'real' })

    expect(calls[0]!.url).toBe('https://api.example.test/v1/metadata')
    const list = new URL(calls[1]!.url)
    expect(list.pathname).toBe('/v1/properties')
    expect(Object.fromEntries(list.searchParams)).toEqual({
      bbox: '-122.5,47.1,-121.3,47.8',
      zip: '98115',
      q: 'KC',
      waterfront: 'false',
      min_sqft: '500',
      max_sqft: '3000',
      cursor: '24',
      limit: '24',
    })
    expect(calls[2]!.init?.method).toBe('POST')
    expect(JSON.parse(String(calls[2]!.init?.body))).toEqual(predictRequest)
  })

  it('encodes ids in property, explanation, and neighbor paths', async () => {
    const { fetchImpl, calls } = fakeFetch(() => jsonResponse({}, 404))
    const api = client(fetchImpl)
    await rejection(api.getProperty('KC/1 2'))
    await rejection(api.getExplanation('p 1', 'x&y'))
    await rejection(api.getNeighbors('p/1'))
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.example.test/v1/properties/KC%2F1%202',
      'https://api.example.test/v1/predictions/p%201/explanation?model_id=x%26y',
      'https://api.example.test/v1/predictions/p%2F1/neighbors',
    ])
  })

  it('reports schema mismatches and invalid JSON as malformed_payload', async () => {
    const wrongShape = client(fakeFetch(() => jsonResponse({ status: 'great' })).fetchImpl)
    expect((await apiRejection(wrongShape.getHealth())).code).toBe('malformed_payload')

    const notJson = client(fakeFetch(() => new Response('<html>oops</html>', { status: 200 })).fetchImpl)
    expect((await apiRejection(notJson.getHealth())).code).toBe('malformed_payload')
  })

  it('uses a structured error body when the server provides one', async () => {
    const body = {
      code: 'invalid_input',
      message: 'Grade must be 13 or less.',
      field_errors: { grade: 'Grade must be 13 or less.' },
      retryable: false,
      request_id: 'r-9',
    }
    const api = client(fakeFetch(() => jsonResponse(body, 422)).fetchImpl)
    const error = await apiRejection(api.predict(predictRequest))
    expect(error.code).toBe('invalid_input')
    expect(error.message).toBe('Grade must be 13 or less.')
    expect(error.field_errors).toEqual({ grade: 'Grade must be 13 or less.' })
    expect(error.request_id).toBe('r-9')
  })

  it.each([
    [400, 'invalid_input', false],
    [422, 'invalid_input', false],
    [404, 'not_found', false],
    [429, 'rate_limited', true],
    [502, 'service_unavailable', true],
    [503, 'service_unavailable', true],
    [504, 'service_unavailable', true],
    [500, 'unknown', true],
  ] as const)('maps HTTP %i without a usable body to %s', async (status, code, retryable) => {
    const api = client(fakeFetch(() => new Response('Internal traceback...', { status })).fetchImpl)
    const error = await apiRejection(api.getHealth())
    expect(error.code).toBe(code)
    expect(error.retryable).toBe(retryable)
    expect(error.message).not.toContain('traceback')
  })

  it('times out with a retryable timeout error', async () => {
    const error = await apiRejection(client(hangingFetch, 20).getHealth())
    expect(error.code).toBe('timeout')
    expect(error.retryable).toBe(true)
  })

  it('rethrows caller aborts as AbortError', async () => {
    const controller = new AbortController()
    const pending = client(hangingFetch, 5000).getHealth(controller.signal)
    controller.abort()
    const error = await rejection(pending)
    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')

    const already = await rejection(client(hangingFetch).getHealth(controller.signal))
    expect((already as DOMException).name).toBe('AbortError')
  })

  it('maps network failures to a retryable network error', async () => {
    const api = client(fakeFetch(() => Promise.reject(new TypeError('Failed to fetch'))).fetchImpl)
    const error = await apiRejection(api.getMetadata())
    expect(error.code).toBe('network')
    expect(error.retryable).toBe(true)
  })
})
