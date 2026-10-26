import { formatBathrooms, formatInteger, formatSignedLog, formatSignedUsd, formatSqft } from '@/lib/format'
import type { ExplanationOutputSpace, Metadata, ModelInfo } from '@/services/types'
import type { ModelOutcome, PredictionView } from './usePredictionView'
import type { EstimateWorkflow } from '@/features/property/useEstimateWorkflow'

export function findModel(metadata: Metadata, modelId: string): ModelInfo | undefined {
  return metadata.models.find((m) => m.id === modelId)
}

/** "Neighborhood-graph model" → "Neighborhood-graph", for tight labels. */
export function shortModelName(model: ModelInfo | undefined, fallbackId = 'Model'): string {
  if (!model) return fallbackId
  return model.perspective_label.replace(/\s+model$/i, '')
}

export function modelName(metadata: Metadata, modelId: string): string {
  return findModel(metadata, modelId)?.perspective_label ?? modelId
}

/** Outcomes with the configured primary model first, then metadata order. */
export function orderedOutcomes(view: PredictionView, metadata: Metadata): ModelOutcome[] {
  const order = (id: string) => {
    if (id === metadata.primary_model_id) return -1
    const i = metadata.models.findIndex((m) => m.id === id)
    return i < 0 ? metadata.models.length : i
  }
  return [...view.outcomes].sort((a, b) => order(a.modelId) - order(b.modelId))
}

export function primaryOutcomeOf(view: PredictionView, metadata: Metadata): ModelOutcome | undefined {
  return view.outcomes.find((o) => o.modelId === metadata.primary_model_id)
}

export function isMockEstimate(view: PredictionView, metadata: Metadata): boolean {
  return view.response?.data_mode === 'mock' || metadata.data_mode === 'mock'
}

/**
 * The recorded sale price is ground truth only for the unchanged record whose
 * result is current; edited, hypothetical, and stale results never compare.
 */
export function canCompareRecordedPrice(workflow: EstimateWorkflow): boolean {
  return (
    workflow.target.kind === 'existing' &&
    workflow.current?.request.source === 'existing' &&
    !workflow.isStale
  )
}

export function fieldLabel(metadata: Metadata, key: string): string {
  const field = metadata.fields.find((f) => f.key === key)
  if (field) return field.label
  if (key === 'latitude') return 'Latitude'
  if (key === 'longitude') return 'Longitude'
  return key.replace(/_/g, ' ')
}

/** Log-price contributions are never formatted as dollars. */
export function formatContribution(value: number, space: ExplanationOutputSpace): string {
  return space === 'usd' ? formatSignedUsd(value) : formatSignedLog(value)
}

/** Human-readable value for an attribute or explanation feature. */
export function formatFeatureValue(key: string, value: number | string | boolean): string {
  if (typeof value === 'string') return value
  if (key === 'waterfront') return value ? 'Yes' : 'No'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (!Number.isFinite(value)) return '—'
  if (key.includes('sqft')) return formatSqft(value)
  if (key === 'bathrooms') return formatBathrooms(value)
  if (key.startsWith('yr_') || key.includes('year')) return String(Math.round(value))
  if (key === 'latitude' || key === 'longitude' || key === 'lat' || key === 'long') return value.toFixed(4)
  if (Number.isInteger(value)) return formatInteger(value)
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}
