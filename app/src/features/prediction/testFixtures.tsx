import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { ExplorerContext, type ExplorerState } from '@/features/explorer/explorerState'
import type { EstimateWorkflow } from '@/features/property/useEstimateWorkflow'
import type { KingSightClient } from '@/services/client'
import { ClientContext } from '@/services/context'
import type {
  Metadata,
  ModelResult,
  PredictRequest,
  PredictResponse,
  PropertyAttributes,
  PropertyDetail,
} from '@/services/types'
import type { ModelOutcome, PredictionView } from './usePredictionView'

export const metadata: Metadata = {
  data_mode: 'mock',
  dataset: {
    name: 'King County House Sales',
    region_label: 'King County, Washington',
    period_label: 'May 2014 – May 2015',
    period_start: '2014-05-01',
    period_end: '2015-05-31',
    version: 'demo-1',
    source_label: 'Kaggle',
    source_url: 'https://www.kaggle.com/datasets/harlfoxem/housesalesprediction',
    currency: 'USD',
    area_unit: 'sqft',
  },
  primary_model_id: 'xgboost',
  models: [
    {
      id: 'xgboost',
      display_name: 'XGBoost',
      perspective_label: 'Property-feature model',
      family: 'tabular',
      version: 'v1',
      description: 'Tabular model',
      explanation_available: true,
    },
    {
      id: 'gnn',
      display_name: 'GraphSAGE',
      perspective_label: 'Neighborhood-graph model',
      family: 'graph',
      version: 'v1',
      description: 'Graph model',
      explanation_available: true,
    },
  ],
  fields: [
    { key: 'sqft_living', label: 'Living area', unit: 'sq ft', kind: 'number', min: 1 },
    { key: 'bedrooms', label: 'Bedrooms', kind: 'integer', min: 0 },
    { key: 'grade', label: 'Grade', kind: 'integer', min: 1, max: 13 },
  ],
  coverage: { label: 'King County, WA', bounds: [-122.5, 47.1, -121.3, 47.8], polygon: [] },
  default_valuation_year: 2015,
  valuation_year_range: { min: 2014, max: 2015 },
  graph: { available: true, version: 'g1', rule_label: '8 nearest homes', description: 'Graph' },
  metrics: null,
}

export const attributes: PropertyAttributes = {
  sqft_living: 1800,
  bedrooms: 3,
  bathrooms: 2,
  grade: 7,
  condition: 3,
  yr_built: 1975,
  waterfront: false,
}

export const property: PropertyDetail = {
  id: 'KC-1042',
  latitude: 47.6,
  longitude: -122.3,
  zipcode: '98103',
  sale_date: '2014-10-13',
  actual_price_usd: 500_000,
  attributes,
  role: 'held_out_example',
  valuation_year: 2014,
  neighborhood_label: null,
}

export function request(overrides: Partial<PredictRequest> = {}): PredictRequest {
  return {
    client_request_id: 'req-1',
    source: 'existing',
    property_id: property.id,
    latitude: property.latitude,
    longitude: property.longitude,
    valuation_year: 2014,
    attributes,
    model_ids: ['xgboost', 'gnn'],
    ...overrides,
  }
}

export function success(modelId: string, price: number, predictionId = 'pred-1', version = 'v1'): ModelOutcome {
  const result: ModelResult = { model_id: modelId, version, status: 'success', predicted_price_usd: price }
  return { modelId, state: 'success', result, predictionId, message: null, retryable: false, retry: vi.fn<() => void>() }
}

export function failed(modelId: string, message = 'The graph model timed out.'): ModelOutcome {
  return { modelId, state: 'error', result: null, predictionId: null, message, retryable: true, retry: vi.fn<() => void>() }
}

export function view(outcomes: ModelOutcome[], overrides: Partial<PredictionView> = {}): PredictionView {
  const req = overrides.request ?? request()
  const response: PredictResponse = {
    prediction_id: 'pred-1',
    client_request_id: req.client_request_id,
    input_fingerprint: 'fp',
    data_mode: 'mock',
    generated_at: '2026-10-25T00:00:00Z',
    dataset_version: 'demo-1',
    results: outcomes.flatMap((o) => (o.result ? [o.result] : [])),
    warnings: [],
  }
  return {
    request: req,
    status: 'success',
    error: null,
    response,
    outcomes,
    retry: vi.fn<() => void>(),
    ...overrides,
  }
}

export function workflow(overrides: Partial<EstimateWorkflow> = {}): EstimateWorkflow {
  return {
    target: { kind: 'existing', property },
    values: { ...attributes, latitude: property.latitude, longitude: property.longitude },
    originalValues: { ...attributes, latitude: property.latitude, longitude: property.longitude },
    valuationYear: 2014,
    changedFields: new Set(),
    warnings: {},
    isStale: false,
    hasUnsavedChanges: false,
    isSubmitting: false,
    submit: vi.fn<() => Promise<void>>(),
    resetChanges: vi.fn<() => void>(),
    current: null,
    original: null,
    session: { submitted: null, original: null },
    ...overrides,
  } as unknown as EstimateWorkflow
}

export function fakeClient(overrides: Partial<KingSightClient> = {}): KingSightClient {
  const never = () => new Promise<never>(() => {})
  return {
    mode: 'mock',
    getMetadata: vi.fn<KingSightClient['getMetadata']>(async () => metadata),
    listProperties: vi.fn<KingSightClient['listProperties']>(never),
    getProperty: vi.fn<KingSightClient['getProperty']>(never),
    predict: vi.fn<KingSightClient['predict']>(never),
    getExplanation: vi.fn<KingSightClient['getExplanation']>(never),
    getNeighbors: vi.fn<KingSightClient['getNeighbors']>(never),
    getHealth: vi.fn<KingSightClient['getHealth']>(never),
    ...overrides,
  }
}

export function explorerStub(overrides: Partial<ExplorerState> = {}): ExplorerState {
  return {
    selectedId: property.id,
    mode: 'browse',
    selectProperty: vi.fn<ExplorerState['selectProperty']>(),
    setMode: vi.fn<ExplorerState['setMode']>(),
    filters: { q: '', minSqft: null, maxSqft: null, waterfront: 'any' },
    setFilters: vi.fn<ExplorerState['setFilters']>(),
    clearFilters: vi.fn<ExplorerState['clearFilters']>(),
    showNeighbors: false,
    setShowNeighbors: vi.fn<ExplorerState['setShowNeighbors']>(),
    neighborOverlay: null,
    setNeighborOverlay: vi.fn<ExplorerState['setNeighborOverlay']>(),
    inspectedNeighbor: null,
    inspectNeighbor: vi.fn<ExplorerState['inspectNeighbor']>(),
    draftLocation: null,
    setDraftLocation: vi.fn<ExplorerState['setDraftLocation']>(),
    mapResetToken: 0,
    requestMapReset: vi.fn<ExplorerState['requestMapReset']>(),
    mapUnavailable: false,
    setMapUnavailable: vi.fn<ExplorerState['setMapUnavailable']>(),
    mobileView: 'details',
    setMobileView: vi.fn<ExplorerState['setMobileView']>(),
    hasUnsavedChanges: false,
    setHasUnsavedChanges: vi.fn<ExplorerState['setHasUnsavedChanges']>(),
    rememberSession: vi.fn<ExplorerState['rememberSession']>(),
    recallSession: vi.fn<ExplorerState['recallSession']>(() => null),
    openHowItWorks: vi.fn<ExplorerState['openHowItWorks']>(),
    ...overrides,
  }
}

export function renderWith(
  ui: ReactNode,
  { client = fakeClient(), explorer = explorerStub() }: { client?: KingSightClient; explorer?: ExplorerState } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <ClientContext.Provider value={{ client, scenarios: null }}>
      <QueryClientProvider client={queryClient}>
        <ExplorerContext.Provider value={explorer}>{ui}</ExplorerContext.Provider>
      </QueryClientProvider>
    </ClientContext.Provider>,
  )
  return { ...utils, client, explorer, queryClient }
}
