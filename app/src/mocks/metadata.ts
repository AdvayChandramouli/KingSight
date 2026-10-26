import type { Coverage, Metadata } from '@/services/types'

export const DATASET_VERSION = 'demo-fixtures-1'
export const GRAPH_VERSION = 'demo-graph-0.1'
export const MODEL_VERSION = 'demo-0.1'
export const GRAPH_RULE_LABEL =
  'Each home connects to up to 6 nearby homes, weighted by distance and similarity in size and grade (within 6 km)'

/**
 * Simplified mainland King County outline (Vashon Island excluded). It covers
 * over 99% of the recorded 2014–2015 sales locations.
 */
const COVERAGE_POLYGON: [number, number][] = [
  [-122.395, 47.778],
  [-121.065, 47.778],
  [-121.12, 47.6],
  [-121.25, 47.35],
  [-121.37, 47.08],
  [-121.8, 47.13],
  [-121.97, 47.145],
  [-122.1, 47.2],
  [-122.23, 47.255],
  [-122.335, 47.258],
  [-122.43, 47.305],
  [-122.345, 47.395],
  [-122.385, 47.445],
  [-122.405, 47.515],
  [-122.425, 47.578],
  [-122.37, 47.612],
  [-122.44, 47.645],
  [-122.42, 47.685],
  [-122.39, 47.72],
  [-122.395, 47.778],
]

function boundsOf(ring: [number, number][]): Coverage['bounds'] {
  const lngs = ring.map(([lng]) => lng)
  const lats = ring.map(([, lat]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

export const COVERAGE: Coverage = {
  label: 'King County, Washington',
  bounds: boundsOf(COVERAGE_POLYGON),
  polygon: COVERAGE_POLYGON,
}

export const MOCK_METADATA: Metadata = {
  data_mode: 'mock',
  dataset: {
    name: 'King County House Sales',
    region_label: 'King County, Washington',
    period_label: '2014–2015 sales',
    period_start: '2014-05',
    period_end: '2015-05',
    version: DATASET_VERSION,
    source_label: 'King County house sales (Kaggle, harlfoxem)',
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
      version: MODEL_VERSION,
      description:
        'Estimates value from the home itself: its size, building grade, condition, age, rooms, waterfront status, and location coordinates.',
      explanation_available: true,
    },
    {
      id: 'gnn',
      display_name: 'Graph neural network',
      perspective_label: 'Neighborhood-graph model',
      family: 'graph',
      version: MODEL_VERSION,
      description:
        'Estimates value from the home together with the nearby, similar homes it is connected to, so its surroundings shape the result.',
      explanation_available: true,
    },
  ],
  // training_range values are the observed min/max in the 2014–2015 sales data.
  fields: [
    {
      key: 'sqft_living',
      label: 'Living area',
      unit: 'sq ft',
      kind: 'number',
      training_range: { min: 290, max: 13_540 },
    },
    {
      key: 'bedrooms',
      label: 'Bedrooms',
      kind: 'integer',
      min: 0,
      step: 1,
      training_range: { min: 0, max: 33 },
    },
    {
      key: 'bathrooms',
      label: 'Bathrooms',
      kind: 'number',
      min: 0,
      step: 0.25,
      training_range: { min: 0, max: 8 },
      help: 'Partial bathrooms count as fractions, such as 0.5 for a half bath or 0.75 for a bath with a shower but no tub.',
    },
    {
      key: 'grade',
      label: 'Grade',
      kind: 'integer',
      min: 1,
      max: 13,
      step: 1,
      training_range: { min: 1, max: 13 },
      help: 'King County building grade rates construction quality and design from 1 to 13. Grade 7 is average; higher grades reflect better materials and craftsmanship.',
    },
    {
      key: 'condition',
      label: 'Condition',
      kind: 'integer',
      min: 1,
      max: 5,
      step: 1,
      training_range: { min: 1, max: 5 },
      help: 'Condition rates upkeep and wear relative to age, from 1 (poor) to 5 (very good). 3 is average.',
    },
    {
      key: 'yr_built',
      label: 'Year built',
      kind: 'integer',
      min: 1800,
      max: 2015,
      step: 1,
      training_range: { min: 1900, max: 2015 },
    },
    {
      key: 'waterfront',
      label: 'Waterfront',
      kind: 'boolean',
    },
  ],
  coverage: COVERAGE,
  default_valuation_year: 2015,
  valuation_year_range: { min: 2014, max: 2015 },
  graph: {
    available: true,
    version: GRAPH_VERSION,
    rule_label: GRAPH_RULE_LABEL,
    description:
      'The neighborhood-graph model links each home to a few nearby homes that are similar in size and building grade. Those connections give the model context about its surroundings; they are not a list of comparable sales.',
  },
  metrics: null,
}
