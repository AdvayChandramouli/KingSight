import type {
  ApiErrorBody,
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

/**
 * The only data boundary the UI talks to. `MockKingSightClient` and
 * `HttpKingSightClient` implement it identically; both validate payloads at
 * runtime before returning them.
 */
export interface KingSightClient {
  readonly mode: 'mock' | 'api'
  getMetadata(signal?: AbortSignal): Promise<Metadata>
  listProperties(query: PropertyQuery, signal?: AbortSignal): Promise<PropertyPage>
  getProperty(id: string, signal?: AbortSignal): Promise<PropertyDetail>
  predict(request: PredictRequest, signal?: AbortSignal): Promise<PredictResponse>
  getExplanation(predictionId: string, modelId: string, signal?: AbortSignal): Promise<Explanation>
  getNeighbors(predictionId: string, signal?: AbortSignal): Promise<NeighborContext>
  getHealth(signal?: AbortSignal): Promise<HealthStatus>
}

export class ApiError extends Error implements ApiErrorBody {
  readonly code: ApiErrorCode
  readonly field_errors?: ApiErrorBody['field_errors']
  readonly retryable: boolean
  readonly request_id?: string

  constructor(body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.code = body.code
    this.field_errors = body.field_errors
    this.retryable = body.retryable
    this.request_id = body.request_id
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Friendly copy for any error; never surfaces stack traces or raw payloads. */
export function describeError(error: unknown): { title: string; message: string; retryable: boolean } {
  if (isAbortError(error)) {
    return { title: 'Request cancelled', message: 'This request was cancelled.', retryable: true }
  }
  if (!isApiError(error)) {
    return {
      title: 'Something went wrong',
      message: 'We could not complete this request. Please try again.',
      retryable: true,
    }
  }
  const titles: Record<ApiErrorCode, string> = {
    invalid_input: 'Check the property details',
    out_of_coverage: 'Outside supported area',
    not_found: 'Not found',
    timeout: 'This is taking too long',
    rate_limited: 'Too many requests',
    service_unavailable: 'Service unavailable',
    malformed_payload: 'Unexpected response',
    model_failure: 'Model unavailable',
    network: 'Connection problem',
    unknown: 'Something went wrong',
  }
  return { title: titles[error.code], message: error.message, retryable: error.retryable }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
