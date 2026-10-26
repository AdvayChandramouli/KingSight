import { useMemo } from 'react'
import { toPredictRequest } from '@/services/fingerprint'
import { useExplanation, useMetadata, usePrediction, useProperty } from '@/services/queries'
import type { Metadata, ModelFamily, ModelInfo, ModelResult, PredictResponse } from '@/services/types'

export const PREVIEW_PROPERTY_ID = 'KC-1042'
export const PREVIEW_HREF = `/explore?property=${PREVIEW_PROPERTY_ID}`

/**
 * The landing preview requests the same snapshot the explorer would for the
 * unchanged property (all served models), so both share one cached result.
 */
export function usePreviewEstimate() {
  const metadata = useMetadata()
  const property = useProperty(PREVIEW_PROPERTY_ID)

  const request = useMemo(() => {
    const p = property.data
    const m = metadata.data
    if (!p || !m) return null
    return toPredictRequest({
      source: 'existing',
      property_id: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      valuation_year: p.valuation_year,
      attributes: p.attributes,
      model_ids: m.models.map((model) => model.id),
    })
  }, [property.data, metadata.data])

  const prediction = usePrediction(request)
  const blocked = metadata.isError || property.isError
  const loading = !blocked && (metadata.isPending || property.isPending || prediction.isPending)

  return { metadata, property, prediction, loading, blocked }
}

export function usePreviewExplanation() {
  const { metadata, prediction, loading, blocked } = usePreviewEstimate()
  const primaryId = metadata.data?.primary_model_id ?? null
  const primaryOk = resultFor(prediction.data, primaryId)?.status === 'success'
  const explanation = useExplanation(primaryOk ? (prediction.data?.prediction_id ?? null) : null, primaryId)
  const model = metadata.data?.models.find((m) => m.id === primaryId) ?? null
  const unavailable =
    blocked || prediction.isError || (prediction.isSuccess && !primaryOk) || model?.explanation_available === false
  return { explanation, model, loading: !unavailable && (loading || explanation.isPending), unavailable }
}

export function resultFor(response: PredictResponse | undefined, modelId: string | null): ModelResult | undefined {
  if (!response || !modelId) return undefined
  return response.results.find((r) => r.model_id === modelId)
}

export function modelByFamily(metadata: Metadata | undefined, family: ModelFamily): ModelInfo | undefined {
  return metadata?.models.find((m) => m.family === family)
}
