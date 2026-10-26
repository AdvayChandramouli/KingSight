import { z } from 'zod'
import { ApiError } from './client'
import type {
  ApiErrorBody,
  Explanation,
  HealthStatus,
  Metadata,
  NeighborContext,
  PredictResponse,
  PropertyDetail,
  PropertyPage,
} from './types'

/** Runtime validation at the adapter boundary. Mirrors `types.ts`. */

const attributes = z.object({
  sqft_living: z.number().finite(),
  bedrooms: z.number().int(),
  bathrooms: z.number().finite(),
  grade: z.number().int(),
  condition: z.number().int(),
  yr_built: z.number().int(),
  waterfront: z.boolean(),
})

export const propertyRecordSchema = z.object({
  id: z.string().min(1),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  zipcode: z.string().nullable(),
  sale_date: z.string().nullable(),
  actual_price_usd: z.number().nonnegative().nullable(),
  attributes,
  role: z.enum(['held_out_example', 'reference_only']),
})

export const propertyDetailSchema = propertyRecordSchema.extend({
  valuation_year: z.number().int(),
  neighborhood_label: z.string().nullable(),
})

export const propertyPageSchema = z.object({
  items: z.array(propertyRecordSchema),
  next_cursor: z.string().nullable(),
  total: z.number().int().nullable(),
})

const modelResult = z.object({
  model_id: z.string(),
  version: z.string(),
  status: z.enum(['success', 'unavailable', 'error']),
  predicted_price_usd: z.number().finite().nullable(),
  message: z.string().optional(),
  interval: z
    .object({ lower_usd: z.number(), upper_usd: z.number(), label: z.string() })
    .optional(),
})

export const predictResponseSchema = z.object({
  prediction_id: z.string(),
  client_request_id: z.string(),
  input_fingerprint: z.string(),
  data_mode: z.enum(['mock', 'real']),
  generated_at: z.string(),
  dataset_version: z.string(),
  results: z.array(modelResult),
  warnings: z.array(z.string()),
})

export const explanationSchema = z.object({
  prediction_id: z.string(),
  model_id: z.string(),
  model_version: z.string(),
  scope: z.literal('local'),
  method: z.string(),
  output_space: z.enum(['usd', 'log_usd']),
  reference_output: z.number().finite().nullable(),
  features: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.union([z.number(), z.string()]),
      contribution: z.number().finite(),
    }),
  ),
  global_importance: z
    .array(z.object({ key: z.string(), label: z.string(), importance: z.number() }))
    .optional(),
})

export const neighborContextSchema = z.object({
  prediction_id: z.string(),
  graph_version: z.string(),
  rule_label: z.string(),
  neighbors: z.array(
    z.object({
      property: propertyRecordSchema,
      distance_meters: z.number().nonnegative().nullable(),
      edge_type: z.enum(['geographic', 'similarity', 'combined']),
    }),
  ),
})

const attributeKey = z.enum([
  'sqft_living',
  'bedrooms',
  'bathrooms',
  'grade',
  'condition',
  'yr_built',
  'waterfront',
])

export const metadataSchema = z.object({
  data_mode: z.enum(['mock', 'real']),
  dataset: z.object({
    name: z.string(),
    region_label: z.string(),
    period_label: z.string(),
    period_start: z.string(),
    period_end: z.string(),
    version: z.string(),
    source_label: z.string(),
    source_url: z.string(),
    currency: z.literal('USD'),
    area_unit: z.literal('sqft'),
  }),
  primary_model_id: z.string(),
  models: z.array(
    z.object({
      id: z.string(),
      display_name: z.string(),
      perspective_label: z.string(),
      family: z.enum(['tabular', 'graph']),
      version: z.string(),
      description: z.string(),
      explanation_available: z.boolean(),
    }),
  ),
  fields: z.array(
    z.object({
      key: attributeKey,
      label: z.string(),
      unit: z.string().optional(),
      kind: z.enum(['number', 'integer', 'boolean']),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
      training_range: z.object({ min: z.number(), max: z.number() }).optional(),
      help: z.string().optional(),
    }),
  ),
  coverage: z.object({
    label: z.string(),
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    polygon: z.array(z.tuple([z.number(), z.number()])).min(4),
  }),
  default_valuation_year: z.number().int(),
  valuation_year_range: z.object({ min: z.number().int(), max: z.number().int() }),
  graph: z.object({
    available: z.boolean(),
    version: z.string(),
    rule_label: z.string(),
    description: z.string(),
  }),
  metrics: z
    .array(
      z.object({
        model_id: z.string(),
        name: z.string(),
        value: z.number(),
        unit: z.string(),
        split: z.string(),
        target_scale: z.string(),
        provenance: z.string(),
      }),
    )
    .nullable(),
})

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'unavailable']),
  data_mode: z.enum(['mock', 'real']),
})

export const apiErrorBodySchema = z.object({
  code: z.enum([
    'invalid_input',
    'out_of_coverage',
    'not_found',
    'timeout',
    'rate_limited',
    'service_unavailable',
    'malformed_payload',
    'model_failure',
    'network',
    'unknown',
  ]),
  message: z.string(),
  field_errors: z.record(z.string(), z.string()).optional(),
  retryable: z.boolean(),
  request_id: z.string().optional(),
})

/** Parse or throw a friendly `malformed_payload` ApiError. */
export function parseWith<T>(schema: z.ZodType<T>, payload: unknown, what: string): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    throw new ApiError({
      code: 'malformed_payload',
      message: `The ${what} response was not in the expected format.`,
      retryable: true,
    })
  }
  return result.data
}

export const parse = {
  metadata: (p: unknown): Metadata => parseWith(metadataSchema, p, 'metadata') as Metadata,
  propertyPage: (p: unknown): PropertyPage => parseWith(propertyPageSchema, p, 'property list'),
  propertyDetail: (p: unknown): PropertyDetail => parseWith(propertyDetailSchema, p, 'property'),
  predictResponse: (p: unknown): PredictResponse => parseWith(predictResponseSchema, p, 'estimate'),
  explanation: (p: unknown): Explanation => parseWith(explanationSchema, p, 'explanation'),
  neighbors: (p: unknown): NeighborContext => parseWith(neighborContextSchema, p, 'neighbor'),
  health: (p: unknown): HealthStatus => parseWith(healthSchema, p, 'health'),
  errorBody: (p: unknown): ApiErrorBody | null => {
    const r = apiErrorBodySchema.safeParse(p)
    return r.success ? (r.data as ApiErrorBody) : null
  },
}
