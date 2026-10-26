import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { describeError, isApiError } from '@/services/client'
import { useClient } from '@/services/context'
import { toPredictRequest } from '@/services/fingerprint'
import { queryKeys, usePrediction } from '@/services/queries'
import type { ModelResult, PredictRequest, PredictResponse } from '@/services/types'

export type ModelOutcomeState = 'pending' | 'success' | 'unavailable' | 'error'

export type ModelOutcome = {
  modelId: string
  state: ModelOutcomeState
  result: ModelResult | null
  /** Prediction id whose explanation belongs to this model's result. */
  predictionId: string | null
  message: string | null
  retryable: boolean
  retry: () => void
}

export type PredictionView = {
  request: PredictRequest
  status: 'pending' | 'error' | 'success'
  /** Whole-request error (no model results at all). */
  error: {
    title: string
    message: string
    retryable: boolean
    code: string | null
    fieldErrors: Record<string, string> | null
  } | null
  response: PredictResponse | null
  outcomes: ModelOutcome[]
  /** Re-sends the same snapshot. Never changes the inputs. */
  retry: () => void
}

/**
 * Merges the combined prediction request with any per-model retries for the
 * same input snapshot, so a failed graph model can be retried without losing
 * a successful tabular result.
 */
export function usePredictionView(request: PredictRequest | null): PredictionView | null {
  const client = useClient()
  const queryClient = useQueryClient()
  const main = usePrediction(request)

  // Per-model retry requests, scoped to the snapshot they were created for.
  const [retries, setRetries] = useState<{ forId: string; byModel: Record<string, PredictRequest> }>({
    forId: '',
    byModel: {},
  })
  const activeRetries = useMemo<Record<string, PredictRequest>>(
    () => (request && retries.forId === request.client_request_id ? retries.byModel : {}),
    [request, retries],
  )
  const retryEntries = Object.entries(activeRetries)

  const retryQueries = useQueries({
    queries: retryEntries.map(([, retryRequest]) => ({
      queryKey: queryKeys.prediction(retryRequest.client_request_id),
      queryFn: ({ signal }: { signal: AbortSignal }) => client.predict(retryRequest, signal),
      retry: false,
      staleTime: Infinity,
      gcTime: 30 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  })

  const retryModel = useCallback(
    (modelId: string) => {
      if (!request) return
      const existing = activeRetries[modelId]
      if (existing) {
        void queryClient.refetchQueries({ queryKey: queryKeys.prediction(existing.client_request_id) })
        return
      }
      const { client_request_id: _omit, ...input } = request
      void _omit
      const retryRequest = toPredictRequest({ ...input, model_ids: [modelId] })
      setRetries({
        forId: request.client_request_id,
        byModel: { ...activeRetries, [modelId]: retryRequest },
      })
    },
    [request, activeRetries, queryClient],
  )

  if (!request) return null

  const mainError = main.error
  const described = mainError ? describeError(mainError) : null

  const outcomes: ModelOutcome[] = request.model_ids.map((modelId) => {
    const retryIndex = retryEntries.findIndex(([id]) => id === modelId)
    const retryQuery = retryIndex >= 0 ? retryQueries[retryIndex] : undefined
    const retry = () => retryModel(modelId)

    if (retryQuery) {
      if (retryQuery.isFetching || retryQuery.isPending) {
        return { modelId, state: 'pending', result: null, predictionId: null, message: null, retryable: false, retry }
      }
      if (retryQuery.error) {
        const d = describeError(retryQuery.error)
        return { modelId, state: 'error', result: null, predictionId: null, message: d.message, retryable: d.retryable, retry }
      }
      const data = retryQuery.data as PredictResponse
      return fromResult(modelId, data, retry)
    }

    if (main.isFetching || main.isPending) {
      return { modelId, state: 'pending', result: null, predictionId: null, message: null, retryable: false, retry }
    }
    if (mainError || !main.data) {
      return {
        modelId,
        state: 'error',
        result: null,
        predictionId: null,
        message: described?.message ?? null,
        retryable: described?.retryable ?? true,
        retry,
      }
    }
    return fromResult(modelId, main.data, retry)
  })

  const status: PredictionView['status'] =
    main.isFetching || main.isPending ? 'pending' : mainError ? 'error' : 'success'

  return {
    request,
    status,
    error: described
      ? {
          ...described,
          code: isApiError(mainError) ? mainError.code : null,
          fieldErrors: isApiError(mainError) ? ((mainError.field_errors as Record<string, string>) ?? null) : null,
        }
      : null,
    response: main.data ?? null,
    outcomes,
    retry: () => void main.refetch(),
  }
}

function fromResult(modelId: string, response: PredictResponse, retry: () => void): ModelOutcome {
  const result = response.results.find((r) => r.model_id === modelId) ?? null
  if (!result) {
    return {
      modelId,
      state: 'unavailable',
      result: null,
      predictionId: null,
      message: 'This model did not return a result for this request.',
      retryable: true,
      retry,
    }
  }
  const state: ModelOutcomeState =
    result.status === 'success' && result.predicted_price_usd != null ? 'success' : result.status === 'unavailable' ? 'unavailable' : 'error'
  return {
    modelId,
    state,
    result,
    predictionId: response.prediction_id,
    message: state === 'success' ? null : (result.message ?? 'This model could not produce an estimate.'),
    retryable: state !== 'success',
    retry,
  }
}
