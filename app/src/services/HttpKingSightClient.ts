import { ApiError, isAbortError, type KingSightClient } from './client'
import { parse } from './schemas'
import type {
  ApiErrorCode,
  Explanation,
  HealthStatus,
  Metadata,
  NeighborContext,
  PredictRequest,
  PredictResponse,
  PropertyDetail,
  PropertyPage,
  PropertyQuery,
} from './types'

export type HttpClientOptions = {
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: 'invalid_input',
  404: 'not_found',
  422: 'invalid_input',
  429: 'rate_limited',
  502: 'service_unavailable',
  503: 'service_unavailable',
  504: 'service_unavailable',
}

const STATUS_MESSAGES: Record<ApiErrorCode, string> = {
  invalid_input: 'Some of the details sent were not accepted. Check the values and try again.',
  out_of_coverage: 'This location is outside the supported area.',
  not_found: 'The requested record could not be found.',
  timeout: 'The request took too long. Please try again.',
  rate_limited: 'Too many requests right now. Please wait a moment and try again.',
  service_unavailable: 'The service is temporarily unavailable. Please try again shortly.',
  malformed_payload: 'The response was not in the expected format.',
  model_failure: 'The model could not produce a result.',
  network: 'We could not reach the service. Check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
}

const RETRYABLE = new Set<ApiErrorCode>(['timeout', 'rate_limited', 'service_unavailable', 'network', 'unknown'])

/**
 * Talks to the KingSight inference API. Endpoint paths follow the provisional
 * proposal in SPEC §12 and still need backend agreement. Never falls back to
 * mock data: every failure surfaces as an `ApiError` (or an AbortError when the
 * caller cancels).
 */
export class HttpKingSightClient implements KingSightClient {
  readonly mode = 'api'
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  }

  async getMetadata(signal?: AbortSignal): Promise<Metadata> {
    return parse.metadata(await this.request('GET', '/metadata', { signal }))
  }

  async listProperties(query: PropertyQuery, signal?: AbortSignal): Promise<PropertyPage> {
    const params = new URLSearchParams()
    if (query.bbox) params.set('bbox', query.bbox.join(','))
    if (query.zip) params.set('zip', query.zip)
    if (query.q) params.set('q', query.q)
    if (query.waterfront != null) params.set('waterfront', String(query.waterfront))
    if (query.min_sqft != null) params.set('min_sqft', String(query.min_sqft))
    if (query.max_sqft != null) params.set('max_sqft', String(query.max_sqft))
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit != null) params.set('limit', String(query.limit))
    const qs = params.toString()
    return parse.propertyPage(await this.request('GET', `/properties${qs ? `?${qs}` : ''}`, { signal }))
  }

  async getProperty(id: string, signal?: AbortSignal): Promise<PropertyDetail> {
    return parse.propertyDetail(await this.request('GET', `/properties/${encodeURIComponent(id)}`, { signal }))
  }

  async predict(request: PredictRequest, signal?: AbortSignal): Promise<PredictResponse> {
    return parse.predictResponse(await this.request('POST', '/predict', { signal, body: request }))
  }

  async getExplanation(predictionId: string, modelId: string, signal?: AbortSignal): Promise<Explanation> {
    const path = `/predictions/${encodeURIComponent(predictionId)}/explanation?model_id=${encodeURIComponent(modelId)}`
    return parse.explanation(await this.request('GET', path, { signal }))
  }

  async getNeighbors(predictionId: string, signal?: AbortSignal): Promise<NeighborContext> {
    return parse.neighbors(
      await this.request('GET', `/predictions/${encodeURIComponent(predictionId)}/neighbors`, { signal }),
    )
  }

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    return parse.health(await this.request('GET', '/health', { signal }))
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    { signal, body }: { signal?: AbortSignal; body?: unknown },
  ): Promise<unknown> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeoutMs)
    const onCallerAbort = () => controller.abort()
    signal?.addEventListener('abort', onCallerAbort, { once: true })

    try {
      let response: Response
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        })
      } catch (error) {
        throw this.transportError(error, timedOut, signal)
      }

      let payload: unknown
      let parsed = true
      try {
        const text = await response.text()
        payload = text ? JSON.parse(text) : null
      } catch (error) {
        if (timedOut || signal?.aborted || isAbortError(error)) throw this.transportError(error, timedOut, signal)
        parsed = false
      }

      if (!response.ok) throw errorFromResponse(response.status, parsed ? payload : null)
      if (!parsed) throw apiError('malformed_payload')
      return payload
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onCallerAbort)
    }
  }

  private transportError(error: unknown, timedOut: boolean, signal?: AbortSignal): Error {
    if (signal?.aborted) return new DOMException('Aborted', 'AbortError')
    if (timedOut) return apiError('timeout')
    if (error instanceof ApiError) return error
    return apiError('network')
  }
}

function apiError(code: ApiErrorCode): ApiError {
  return new ApiError({ code, message: STATUS_MESSAGES[code], retryable: RETRYABLE.has(code) })
}

function errorFromResponse(status: number, payload: unknown): ApiError {
  const body = parse.errorBody(payload)
  if (body) return new ApiError(body)
  return apiError(STATUS_CODES[status] ?? 'unknown')
}
