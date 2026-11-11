import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useClient } from '@/services/context'
import { toPredictRequest } from '@/services/fingerprint'
import { queryKeys, useExplanation, useMetadata, usePrediction, useProperty } from '@/services/queries'
import type { Metadata, ModelFamily, ModelInfo, ModelResult, Neighbor, NeighborContext, PredictResponse } from '@/services/types'

/** Mock-mode landing example. API mode uses the first held-out catalog home instead. */
export const PREVIEW_PROPERTY_ID = 'KC-1042'
export const PREVIEW_HREF = `/explore?property=${PREVIEW_PROPERTY_ID}`

/**
 * The landing preview requests the same snapshot the explorer would for the
 * unchanged property (all served models), so both share one cached result.
 * In API mode the id is a real held-out sale, so the preview is not a mock id.
 */
export function usePreviewEstimate() {
  const client = useClient()
  const metadata = useMetadata()
  const catalogPick = useQuery({
    queryKey: ['properties', 'landing-preview'],
    queryFn: ({ signal }) => client.listProperties({ limit: 1 }, signal),
    enabled: client.mode === 'api',
    staleTime: Infinity,
    retry: false,
  })
  const previewId = client.mode === 'mock' ? PREVIEW_PROPERTY_ID : (catalogPick.data?.items[0]?.id ?? null)
  const previewHref = previewId ? `/explore?property=${encodeURIComponent(previewId)}` : '/explore'
  const property = useProperty(previewId)

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
  const blocked = metadata.isError || property.isError || (client.mode === 'api' && catalogPick.isError)
  const waitingForId = client.mode === 'api' && previewId === null && !catalogPick.isError
  const loading =
    !blocked && (waitingForId || metadata.isPending || property.isPending || prediction.isPending)

  return { metadata, property, prediction, loading, blocked, previewId, previewHref }
}

export function usePreviewExplanation() {
  const { metadata, prediction, loading, blocked, previewId, previewHref } = usePreviewEstimate()
  const primaryId = metadata.data?.primary_model_id ?? null
  const primaryOk = resultFor(prediction.data, primaryId)?.status === 'success'
  const explanation = useExplanation(primaryOk ? (prediction.data?.prediction_id ?? null) : null, primaryId)
  const model = metadata.data?.models.find((m) => m.id === primaryId) ?? null
  const unavailable =
    blocked || prediction.isError || (prediction.isSuccess && !primaryOk) || model?.explanation_available === false
  return {
    explanation,
    model,
    previewId,
    previewHref,
    loading: !unavailable && (loading || explanation.isPending),
    unavailable,
  }
}

export function resultFor(response: PredictResponse | undefined, modelId: string | null): ModelResult | undefined {
  if (!response || !modelId) return undefined
  return response.results.find((r) => r.model_id === modelId)
}

export function modelByFamily(metadata: Metadata | undefined, family: ModelFamily): ModelInfo | undefined {
  return metadata?.models.find((m) => m.family === family)
}

const NO_NEIGHBORS: Neighbor[] = []

/** Connected homes already stored for this prediction. Does not fetch. */
export function cachedPreviewNeighbors(predictionId: string | null, cached: NeighborContext | undefined): Neighbor[] {
  if (!predictionId || !cached || cached.prediction_id !== predictionId) return NO_NEIGHBORS
  return cached.neighbors
}

/**
 * Neighbor overlay for the landing map. Reads the preview prediction's
 * neighbors query only when something else has already filled it.
 */
export function useCachedPreviewNeighbors(): Neighbor[] {
  const client = useClient()
  const { prediction } = usePreviewEstimate()
  const predictionId = prediction.data?.prediction_id ?? null
  const cached = useQuery({
    queryKey: queryKeys.neighbors(predictionId ?? ''),
    queryFn: ({ signal }) => client.getNeighbors(predictionId as string, signal),
    enabled: false,
  })
  return cachedPreviewNeighbors(predictionId, cached.data)
}
