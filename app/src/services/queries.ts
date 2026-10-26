import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useClient } from './context'
import type { PredictRequest, PropertyQuery } from './types'

export const PROPERTY_PAGE_SIZE = 24

export const queryKeys = {
  metadata: ['metadata'] as const,
  properties: (query: PropertyQuery) => ['properties', query] as const,
  property: (id: string) => ['property', id] as const,
  // Predictions are cached by the full input snapshot (client_request_id is
  // derived from it), never by property id alone.
  prediction: (clientRequestId: string) => ['prediction', clientRequestId] as const,
  explanation: (predictionId: string, modelId: string) =>
    ['explanation', predictionId, modelId] as const,
  neighbors: (predictionId: string) => ['neighbors', predictionId] as const,
}

/** Prediction-related requests never retry or refetch on their own. */
const manualOnly = {
  retry: false,
  staleTime: Infinity,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const

export function useMetadata() {
  const client = useClient()
  return useQuery({
    queryKey: queryKeys.metadata,
    queryFn: ({ signal }) => client.getMetadata(signal),
    staleTime: Infinity,
    retry: false,
  })
}

export function usePropertyList(query: PropertyQuery) {
  const client = useClient()
  return useInfiniteQuery({
    queryKey: queryKeys.properties(query),
    queryFn: ({ pageParam, signal }) =>
      client.listProperties(
        { ...query, limit: query.limit ?? PROPERTY_PAGE_SIZE, cursor: pageParam ?? undefined },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useProperty(id: string | null) {
  const client = useClient()
  return useQuery({
    queryKey: queryKeys.property(id ?? ''),
    queryFn: ({ signal }) => client.getProperty(id as string, signal),
    enabled: Boolean(id),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}

export function usePrediction(request: PredictRequest | null) {
  const client = useClient()
  return useQuery({
    queryKey: queryKeys.prediction(request?.client_request_id ?? ''),
    queryFn: ({ signal }) => client.predict(request as PredictRequest, signal),
    enabled: Boolean(request),
    ...manualOnly,
  })
}

export function useExplanation(predictionId: string | null, modelId: string | null) {
  const client = useClient()
  return useQuery({
    queryKey: queryKeys.explanation(predictionId ?? '', modelId ?? ''),
    queryFn: ({ signal }) =>
      client.getExplanation(predictionId as string, modelId as string, signal),
    enabled: Boolean(predictionId && modelId),
    ...manualOnly,
  })
}

export function useNeighbors(predictionId: string | null) {
  const client = useClient()
  return useQuery({
    queryKey: queryKeys.neighbors(predictionId ?? ''),
    queryFn: ({ signal }) => client.getNeighbors(predictionId as string, signal),
    enabled: Boolean(predictionId),
    ...manualOnly,
  })
}
