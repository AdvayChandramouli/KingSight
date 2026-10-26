import { ApiError, type KingSightClient } from '@/services/client'
import { fnv1a, inputFingerprint, stableStringify } from '@/services/fingerprint'
import { parse } from '@/services/schemas'
import type {
  Explanation,
  HealthStatus,
  Metadata,
  ModelResult,
  NeighborContext,
  PredictRequest,
  PredictResponse,
  PropertyDetail,
  PropertyPage,
  PropertyQuery,
  PropertyRecord,
} from '@/services/types'
import { FIXTURES } from './fixtures'
import { MOCK_METADATA, DATASET_VERSION, GRAPH_RULE_LABEL, GRAPH_VERSION } from './metadata'
import { graphValuation, tabularValuation, type DemoValuation, type ValuationInput } from './mockModel'
import { rankNeighbors, toNeighbor } from './neighbors'
import { ScenarioStore } from './scenarios'
import { trainingRangeWarnings, validatePredictRequest, outOfCoverage } from './validation'

export type MockClientOptions = {
  scenarios?: ScenarioStore
  /** Fixed delay, or [min, max] with deterministic per-request jitter. 0 resolves on the next tick. */
  latencyMs?: number | [number, number]
}

const SLOW_EXTRA_MS = 2500
const DEFAULT_LIMIT = 24
const MAX_LIMIT = 50
/** Fixed so identical inputs produce byte-identical responses. */
const GENERATED_AT = '2015-05-27T00:00:00.000Z'
const GNN_PARTIAL_MESSAGE = 'The neighborhood-graph model could not produce an estimate for this request.'

type StoredPrediction = {
  request: PredictRequest
  succeeded: Set<string>
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function serviceUnavailable(message: string): ApiError {
  return new ApiError({ code: 'service_unavailable', message, retryable: true })
}

function notFound(message: string): ApiError {
  return new ApiError({ code: 'not_found', message, retryable: false })
}

export class MockKingSightClient implements KingSightClient {
  readonly mode = 'mock'
  private readonly scenarios: ScenarioStore
  private readonly latency: number | [number, number]
  private readonly predictions = new Map<string, StoredPrediction>()
  private readonly attempts = new Map<string, number>()
  private readonly byId = new Map<string, PropertyRecord>(FIXTURES.map((p) => [p.id, p]))

  constructor(options: MockClientOptions = {}) {
    this.scenarios = options.scenarios ?? new ScenarioStore()
    this.latency = options.latencyMs ?? [300, 800]
  }

  async getMetadata(signal?: AbortSignal): Promise<Metadata> {
    await this.delay('metadata', signal)
    return parse.metadata(structuredClone(MOCK_METADATA))
  }

  async listProperties(query: PropertyQuery, signal?: AbortSignal): Promise<PropertyPage> {
    await this.delay(`properties:${stableStringify(query)}`, signal)
    const offset = query.cursor ? Number(query.cursor) : 0
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ApiError({ code: 'invalid_input', message: 'That page of results is not available.', retryable: false })
    }
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(query.limit ?? DEFAULT_LIMIT)))
    const matches = this.scenarios.has('empty')
      ? []
      : FIXTURES.filter((p) => p.role === 'held_out_example' && matchesQuery(p, query)).sort((a, b) =>
          a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
        )
    const items = matches.slice(offset, offset + limit)
    const next = offset + limit < matches.length ? String(offset + limit) : null
    return parse.propertyPage(structuredClone({ items, next_cursor: next, total: matches.length }))
  }

  async getProperty(id: string, signal?: AbortSignal): Promise<PropertyDetail> {
    await this.delay(`property:${id}`, signal)
    const record = this.byId.get(id)
    if (!record) {
      throw notFound(`We couldn't find property ${id}. It may not be one of the demo example properties.`)
    }
    const saleYear = record.sale_date ? Number(record.sale_date.slice(0, 4)) : null
    const detail: PropertyDetail = {
      ...structuredClone(record),
      valuation_year: saleYear ?? MOCK_METADATA.default_valuation_year,
      neighborhood_label: null,
    }
    return parse.propertyDetail(detail)
  }

  async predict(request: PredictRequest, signal?: AbortSignal): Promise<PredictResponse> {
    const snapshot = structuredClone(request)
    const { client_request_id, ...input } = snapshot
    const fingerprint = inputFingerprint(input)
    await this.delay(`predict:${fingerprint}`, signal)

    if (this.scenarios.has('out-of-coverage')) throw outOfCoverage(MOCK_METADATA)
    validatePredictRequest(snapshot, MOCK_METADATA)
    if (snapshot.source !== 'hypothetical') {
      if (!snapshot.property_id || !this.byId.has(snapshot.property_id)) {
        throw notFound('The property for this estimate could not be found.')
      }
    }
    if (this.scenarios.has('predict-error') && this.firstAttempt(`predict:${client_request_id}`)) {
      throw serviceUnavailable('The estimate service is temporarily unavailable. Please try again.')
    }

    const valuation = this.valuationInput(snapshot)
    const partial = this.scenarios.has('partial') && snapshot.model_ids.includes('gnn') && snapshot.model_ids.length > 1
    const succeeded = new Set<string>()
    const results: ModelResult[] = snapshot.model_ids.map((modelId) => {
      const known = MOCK_METADATA.models.find((m) => m.id === modelId)
      if (!known) {
        return {
          model_id: modelId,
          version: 'unknown',
          status: 'unavailable',
          predicted_price_usd: null,
          message: 'This model is not available in demo mode.',
        }
      }
      if (modelId === 'gnn' && partial) {
        return { model_id: modelId, version: known.version, status: 'error', predicted_price_usd: null, message: GNN_PARTIAL_MESSAGE }
      }
      succeeded.add(modelId)
      return {
        model_id: modelId,
        version: known.version,
        status: 'success',
        predicted_price_usd: this.evaluate(modelId, snapshot, valuation).predicted_price_usd,
      }
    })

    const warnings = trainingRangeWarnings(snapshot.attributes, MOCK_METADATA)
    if (snapshot.model_ids.includes('gnn') && this.neighborsFor(snapshot).length === 0) {
      warnings.push(
        'No nearby homes are connected to this location in the graph, so the neighborhood-graph estimate relies on property features alone.',
      )
    }

    const predictionId = `demo-pred-${fingerprint}`
    this.predictions.set(predictionId, { request: snapshot, succeeded })
    return parse.predictResponse({
      prediction_id: predictionId,
      client_request_id,
      input_fingerprint: fingerprint,
      data_mode: 'mock',
      generated_at: GENERATED_AT,
      dataset_version: DATASET_VERSION,
      results,
      warnings,
    })
  }

  async getExplanation(predictionId: string, modelId: string, signal?: AbortSignal): Promise<Explanation> {
    await this.delay(`explanation:${predictionId}:${modelId}`, signal)
    const stored = this.storedPrediction(predictionId)
    const model = MOCK_METADATA.models.find((m) => m.id === modelId)
    if (!model || !stored.request.model_ids.includes(modelId)) {
      throw notFound('No estimate from this model exists for this request, so there is nothing to explain.')
    }
    if (!stored.succeeded.has(modelId)) {
      throw new ApiError({
        code: 'model_failure',
        message: 'This model did not produce an estimate for this request, so no explanation is available.',
        retryable: false,
      })
    }
    if (this.scenarios.has('explain-error') && this.firstAttempt(`explain:${predictionId}:${modelId}`)) {
      throw serviceUnavailable('The explanation could not be loaded right now. Please try again.')
    }

    const valuation = this.evaluate(modelId, stored.request, this.valuationInput(stored.request))
    return parse.explanation({
      prediction_id: predictionId,
      model_id: modelId,
      model_version: model.version,
      scope: 'local',
      method:
        valuation.output_space === 'usd'
          ? 'Demo additive decomposition (illustrative)'
          : 'Demo log-additive decomposition (illustrative)',
      output_space: valuation.output_space,
      reference_output: valuation.reference_output,
      features: valuation.features,
    })
  }

  async getNeighbors(predictionId: string, signal?: AbortSignal): Promise<NeighborContext> {
    await this.delay(`neighbors:${predictionId}`, signal)
    const stored = this.storedPrediction(predictionId)
    if (this.scenarios.has('neighbors-unavailable') && this.firstAttempt(`neighbors:${predictionId}`)) {
      throw serviceUnavailable('Connected homes could not be loaded right now. Please try again.')
    }
    return parse.neighbors({
      prediction_id: predictionId,
      graph_version: GRAPH_VERSION,
      rule_label: GRAPH_RULE_LABEL,
      neighbors: this.neighborsFor(stored.request).map(toNeighbor),
    })
  }

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    await this.delay('health', signal)
    return parse.health({ status: 'ok', data_mode: 'mock' })
  }

  private storedPrediction(predictionId: string): StoredPrediction {
    const stored = this.predictions.get(predictionId)
    if (!stored) throw notFound('This estimate is no longer available. Request a new estimate to continue.')
    return stored
  }

  private valuationInput(request: PredictRequest): ValuationInput {
    return { latitude: request.latitude, longitude: request.longitude, attributes: request.attributes }
  }

  private neighborsFor(request: PredictRequest) {
    return rankNeighbors({ ...this.valuationInput(request), excludeId: request.property_id })
  }

  private evaluate(modelId: string, request: PredictRequest, input: ValuationInput): DemoValuation {
    if (modelId === 'gnn') {
      const connected = this.neighborsFor(request).map(({ record, score }) => ({
        latitude: record.latitude,
        longitude: record.longitude,
        attributes: record.attributes,
        score,
      }))
      return graphValuation(input, connected)
    }
    return tabularValuation(input)
  }

  /** True only the first time a key is seen; drives retry-succeeds scenarios. */
  private firstAttempt(key: string): boolean {
    const count = this.attempts.get(key) ?? 0
    this.attempts.set(key, count + 1)
    return count === 0
  }

  private delay(key: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortError())
    const base = Array.isArray(this.latency)
      ? this.latency[0] + (parseInt(fnv1a(key), 16) % (this.latency[1] - this.latency[0] + 1))
      : this.latency
    const ms = base + (this.scenarios.has('slow') ? SLOW_EXTRA_MS : 0)
    if (ms <= 0) {
      return Promise.resolve().then(() => {
        if (signal?.aborted) throw abortError()
      })
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer)
        reject(abortError())
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        if (signal?.aborted) reject(abortError())
        else resolve()
      }, ms)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
}

function matchesQuery(p: PropertyRecord, query: PropertyQuery): boolean {
  const q = query.q?.trim().toLowerCase()
  if (q) {
    const idMatch = p.id.toLowerCase().includes(q)
    const zipMatch = p.zipcode != null && p.zipcode.startsWith(q)
    if (!idMatch && !zipMatch) return false
  }
  if (query.zip && p.zipcode !== query.zip) return false
  if (query.waterfront != null && p.attributes.waterfront !== query.waterfront) return false
  if (query.min_sqft != null && p.attributes.sqft_living < query.min_sqft) return false
  if (query.max_sqft != null && p.attributes.sqft_living > query.max_sqft) return false
  if (query.bbox) {
    const [w, s, e, n] = query.bbox
    if (p.longitude < w || p.longitude > e || p.latitude < s || p.latitude > n) return false
  }
  return true
}
