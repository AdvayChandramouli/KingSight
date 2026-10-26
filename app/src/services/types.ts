/**
 * KingSight domain contract. Every component consumes these types through
 * `KingSightClient`; nothing outside `src/services` and `src/mocks` may know
 * whether data is mock or real. Units are explicit in field names.
 */

export type DataMode = 'mock' | 'real'

export type PropertyAttributes = {
  sqft_living: number
  bedrooms: number
  bathrooms: number
  /** King County building grade, 1–13. */
  grade: number
  /** King County condition rating, 1–5. */
  condition: number
  yr_built: number
  waterfront: boolean
}

export type AttributeKey = keyof PropertyAttributes

export type PropertyRole = 'held_out_example' | 'reference_only'

export type PropertyRecord = {
  id: string
  latitude: number
  longitude: number
  zipcode: string | null
  /** ISO date (YYYY-MM-DD) of the recorded historical sale, when known. */
  sale_date: string | null
  /** Recorded historical sale price. Only meaningful for the unchanged record. */
  actual_price_usd: number | null
  attributes: PropertyAttributes
  role: PropertyRole
}

export type PropertyDetail = PropertyRecord & {
  /** Year whose market the estimate represents (from sale context). */
  valuation_year: number
  /** Neighborhood name only when supplied by data; never inferred. */
  neighborhood_label: string | null
}

export type PropertyQuery = {
  /** Free text matched against property ID or ZIP code (not an address). */
  q?: string
  zip?: string
  /** [west, south, east, north] in degrees. */
  bbox?: [number, number, number, number]
  waterfront?: boolean
  min_sqft?: number
  max_sqft?: number
  cursor?: string
  limit?: number
}

export type PropertyPage = {
  items: PropertyRecord[]
  next_cursor: string | null
  /** Total matches when the server can report it. */
  total: number | null
}

export type PredictSource = 'existing' | 'edited' | 'hypothetical'

export type PredictRequest = {
  client_request_id: string
  source: PredictSource
  property_id?: string
  latitude: number
  longitude: number
  valuation_year: number
  attributes: PropertyAttributes
  model_ids: string[]
}

/** A request snapshot before the stable client request id is attached. */
export type PredictInput = Omit<PredictRequest, 'client_request_id'>

export type ModelResultStatus = 'success' | 'unavailable' | 'error'

export type ModelResult = {
  model_id: string
  version: string
  status: ModelResultStatus
  predicted_price_usd: number | null
  message?: string
  /** Only present when the API documents what the interval means. */
  interval?: { lower_usd: number; upper_usd: number; label: string }
}

export type PredictResponse = {
  prediction_id: string
  client_request_id: string
  input_fingerprint: string
  data_mode: DataMode
  generated_at: string
  dataset_version: string
  results: ModelResult[]
  warnings: string[]
}

export type ExplanationOutputSpace = 'usd' | 'log_usd'

export type ExplanationFeature = {
  key: string
  label: string
  value: number | string
  /** Signed contribution, expressed in `output_space` units. */
  contribution: number
}

export type Explanation = {
  prediction_id: string
  model_id: string
  model_version: string
  scope: 'local'
  method: string
  output_space: ExplanationOutputSpace
  /** Reference/baseline output in `output_space` units, when provided. */
  reference_output: number | null
  features: ExplanationFeature[]
  /** Optional global ranking; only shown labeled "Across evaluated homes". */
  global_importance?: { key: string; label: string; importance: number }[]
}

export type EdgeType = 'geographic' | 'similarity' | 'combined'

export type Neighbor = {
  property: PropertyRecord
  distance_meters: number | null
  edge_type: EdgeType
}

export type NeighborContext = {
  prediction_id: string
  graph_version: string
  rule_label: string
  neighbors: Neighbor[]
}

export type ModelFamily = 'tabular' | 'graph'

export type ModelInfo = {
  id: string
  display_name: string
  /** Plain-language name, e.g. "Property-feature model". */
  perspective_label: string
  family: ModelFamily
  version: string
  description: string
  explanation_available: boolean
}

export type FieldConstraint = {
  key: AttributeKey
  label: string
  unit?: string
  kind: 'number' | 'integer' | 'boolean'
  min?: number
  max?: number
  step?: number
  /** Hard constraints block submission; soft ranges only warn. */
  training_range?: { min: number; max: number }
  help?: string
}

export type VerifiedMetric = {
  model_id: string
  name: string
  value: number
  unit: string
  split: string
  target_scale: string
  provenance: string
}

export type Coverage = {
  label: string
  /** [west, south, east, north] */
  bounds: [number, number, number, number]
  /** Closed ring of [longitude, latitude] pairs. */
  polygon: [number, number][]
}

export type Metadata = {
  data_mode: DataMode
  dataset: {
    name: string
    region_label: string
    period_label: string
    period_start: string
    period_end: string
    version: string
    source_label: string
    source_url: string
    currency: 'USD'
    area_unit: 'sqft'
  }
  primary_model_id: string
  models: ModelInfo[]
  fields: FieldConstraint[]
  coverage: Coverage
  default_valuation_year: number
  valuation_year_range: { min: number; max: number }
  graph: {
    available: boolean
    version: string
    rule_label: string
    description: string
  }
  /** Only verified metrics with split/scale/provenance; null in mock mode. */
  metrics: VerifiedMetric[] | null
}

export type HealthStatus = {
  status: 'ok' | 'degraded' | 'unavailable'
  data_mode: DataMode
}

export type ApiErrorCode =
  | 'invalid_input'
  | 'out_of_coverage'
  | 'not_found'
  | 'timeout'
  | 'rate_limited'
  | 'service_unavailable'
  | 'malformed_payload'
  | 'model_failure'
  | 'network'
  | 'unknown'

export type ApiErrorBody = {
  code: ApiErrorCode
  message: string
  field_errors?: Partial<Record<AttributeKey | 'latitude' | 'longitude', string>>
  retryable: boolean
  request_id?: string
}
