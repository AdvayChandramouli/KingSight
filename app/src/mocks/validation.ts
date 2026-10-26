import { pointInPolygon } from '@/lib/geo'
import { ApiError } from '@/services/client'
import type { ApiErrorBody, FieldConstraint, Metadata, PredictRequest, PropertyAttributes } from '@/services/types'

type FieldErrors = NonNullable<ApiErrorBody['field_errors']>

function checkNumber(field: FieldConstraint, value: unknown, maxOverride?: number): string | null {
  const label = field.label
  if (typeof value !== 'number' || !Number.isFinite(value)) return `Enter ${label.toLowerCase()}.`
  if (field.kind === 'integer' && !Number.isInteger(value)) return `${label} must be a whole number.`
  if (field.key === 'sqft_living' && value <= 0) return 'Living area must be greater than 0 sq ft.'
  if (field.min != null && value < field.min) return `${label} must be at least ${field.min}.`
  const max = maxOverride ?? field.max
  if (max != null && value > max) return `${label} must be ${max} or less.`
  if (field.kind === 'number' && field.step != null && field.step > 0) {
    const steps = value / field.step
    if (Math.abs(steps - Math.round(steps)) > 1e-9) {
      return field.step === 0.25
        ? `${label} must use quarter increments (e.g. 1.75).`
        : `${label} must use steps of ${field.step}.`
    }
  }
  return null
}

/**
 * Mirrors the UI's metadata-driven validation so the mock rejects exactly the
 * inputs the form would block. Throws `invalid_input` or `out_of_coverage`.
 */
export function validatePredictRequest(request: PredictRequest, metadata: Metadata): void {
  const { min: yearMin, max: yearMax } = metadata.valuation_year_range
  if (!Number.isInteger(request.valuation_year) || request.valuation_year < yearMin || request.valuation_year > yearMax) {
    throw new ApiError({
      code: 'invalid_input',
      message: `Estimates are available for the ${yearMin}–${yearMax} market only.`,
      retryable: false,
    })
  }

  const errors: FieldErrors = {}
  const attrs: Partial<Record<keyof PropertyAttributes, unknown>> = request.attributes ?? {}
  for (const field of metadata.fields) {
    const value = attrs[field.key]
    if (field.kind === 'boolean') {
      if (typeof value !== 'boolean') errors[field.key] = `Choose whether the property is ${field.label.toLowerCase()}.`
      continue
    }
    const maxOverride = field.key === 'yr_built' ? Math.min(field.max ?? Infinity, request.valuation_year) : undefined
    const message = checkNumber(field, value, maxOverride)
    if (message) errors[field.key] = message
  }
  if (!Number.isFinite(request.latitude)) errors.latitude = 'Enter a latitude.'
  if (!Number.isFinite(request.longitude)) errors.longitude = 'Enter a longitude.'

  if (Object.keys(errors).length > 0) {
    throw new ApiError({
      code: 'invalid_input',
      message: 'Some property details need attention before an estimate can be made.',
      field_errors: errors,
      retryable: false,
    })
  }

  if (!pointInPolygon(request.longitude, request.latitude, metadata.coverage.polygon)) {
    throw outOfCoverage(metadata)
  }
}

export function outOfCoverage(metadata: Metadata): ApiError {
  const [w, s, e, n] = metadata.coverage.bounds
  return new ApiError({
    code: 'out_of_coverage',
    message: `This location is outside ${metadata.coverage.label}, so no estimate can be made. Choose a point inside the outlined area (roughly latitude ${s.toFixed(2)} to ${n.toFixed(2)}, longitude ${w.toFixed(2)} to ${e.toFixed(2)}).`,
    retryable: false,
  })
}

/** Soft warnings for values outside the observed historical data. */
export function trainingRangeWarnings(attributes: PropertyAttributes, metadata: Metadata): string[] {
  const warnings: string[] = []
  for (const field of metadata.fields) {
    const value = attributes[field.key]
    if (typeof value !== 'number' || !field.training_range) continue
    const { min, max } = field.training_range
    if (value < min || value > max) {
      warnings.push(
        `${field.label} (${value.toLocaleString('en-US')}) is outside the range seen in the historical sales data (${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}). Treat this estimate with extra caution.`,
      )
    }
  }
  return warnings
}
