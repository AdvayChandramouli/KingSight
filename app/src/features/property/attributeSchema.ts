import { z } from 'zod'
import { pointInPolygon } from '@/lib/geo'
import type { AttributeKey, FieldConstraint, Metadata, PropertyAttributes } from '@/services/types'

export type EstimateFormValues = PropertyAttributes & { latitude: number; longitude: number }

export const ATTRIBUTE_ORDER: AttributeKey[] = [
  'sqft_living',
  'bedrooms',
  'bathrooms',
  'grade',
  'condition',
  'yr_built',
  'waterfront',
]

/**
 * Starting values for a hypothetical property. These are illustrative and
 * labeled as such in the UI; they are not dataset records.
 */
export const ILLUSTRATIVE_DEFAULTS: PropertyAttributes = {
  sqft_living: 1900,
  bedrooms: 3,
  bathrooms: 2,
  grade: 7,
  condition: 3,
  yr_built: 1975,
  waterfront: false,
}

function numberField(field: FieldConstraint, maxOverride?: number) {
  const name = field.label.toLowerCase()
  const max = maxOverride ?? field.max
  const isInt = field.kind === 'integer'
  return z
    .number({ error: `Enter ${name}.` })
    .refine(Number.isFinite, `Enter ${name}.`)
    .superRefine((value, ctx) => {
    if (isInt && !Number.isInteger(value)) {
      ctx.addIssue({ code: 'custom', message: `${field.label} must be a whole number.` })
      return
    }
    if (field.key === 'sqft_living' && value <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Living area must be greater than 0 sq ft.' })
      return
    }
    if (field.min != null && value < field.min) {
      ctx.addIssue({ code: 'custom', message: `${field.label} must be at least ${field.min}.` })
      return
    }
    if (max != null && value > max) {
      ctx.addIssue({ code: 'custom', message: `${field.label} must be ${max} or less.` })
      return
    }
    if (field.step != null && field.step > 0 && !isInt) {
      const steps = value / field.step
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        const hint = field.step === 0.25 ? 'quarter increments (e.g. 1.75)' : `steps of ${field.step}`
        ctx.addIssue({ code: 'custom', message: `${field.label} must use ${hint}.` })
      }
    }
  })
}

/**
 * Builds the form schema from metadata so validation follows the API's
 * declared constraints. Training ranges are warnings, never hard limits.
 */
export function buildFormSchema(metadata: Metadata, valuationYear: number) {
  const byKey = new Map(metadata.fields.map((f) => [f.key, f]))
  const field = (key: AttributeKey): FieldConstraint =>
    byKey.get(key) ?? { key, label: key, kind: key === 'waterfront' ? 'boolean' : 'number' }

  const coverage = metadata.coverage
  return z
    .object({
      sqft_living: numberField(field('sqft_living')),
      bedrooms: numberField(field('bedrooms')),
      bathrooms: numberField(field('bathrooms')),
      grade: numberField(field('grade')),
      condition: numberField(field('condition')),
      yr_built: numberField(field('yr_built'), valuationYear),
      waterfront: z.boolean({ error: 'Choose whether the property is waterfront.' }),
      latitude: z.number({ error: 'Enter a latitude.' }).refine(Number.isFinite, 'Enter a latitude.'),
      longitude: z
        .number({ error: 'Enter a longitude.' })
        .refine(Number.isFinite, 'Enter a longitude.'),
    })
    .superRefine((values, ctx) => {
      if (!Number.isFinite(values.latitude) || !Number.isFinite(values.longitude)) return
      if (!pointInPolygon(values.longitude, values.latitude, coverage.polygon)) {
        const [w, s, e, n] = coverage.bounds
        ctx.addIssue({
          code: 'custom',
          path: ['latitude'],
          message: `This location is outside ${coverage.label}. Pick a point inside the outlined area (roughly latitude ${s.toFixed(2)} to ${n.toFixed(2)}, longitude ${w.toFixed(2)} to ${e.toFixed(2)}).`,
        })
      }
    })
}

/** Soft warnings for values outside the range seen during training. */
export function trainingRangeWarnings(
  values: Partial<PropertyAttributes>,
  fields: FieldConstraint[],
): Partial<Record<AttributeKey, string>> {
  const warnings: Partial<Record<AttributeKey, string>> = {}
  for (const f of fields) {
    const v = values[f.key]
    if (typeof v !== 'number' || !Number.isFinite(v) || !f.training_range) continue
    if (v < f.training_range.min || v > f.training_range.max) {
      warnings[f.key] =
        `Outside the range seen in training data (${f.training_range.min}–${f.training_range.max}). The estimate may be less reliable.`
    }
  }
  return warnings
}

export function attributesOf(values: EstimateFormValues): PropertyAttributes {
  return {
    sqft_living: values.sqft_living,
    bedrooms: values.bedrooms,
    bathrooms: values.bathrooms,
    grade: values.grade,
    condition: values.condition,
    yr_built: values.yr_built,
    waterfront: values.waterfront,
  }
}
