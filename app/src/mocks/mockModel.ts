import type { ExplanationFeature, ExplanationOutputSpace, PropertyAttributes } from '@/services/types'

/**
 * Demo valuation functions for mock mode. These are hand-written, deterministic
 * formulas whose coefficients were loosely calibrated to 2014–2015 King County
 * price levels so the UI shows plausible numbers. They are not trained models
 * and their outputs are illustrative only.
 */

export type ValuationInput = {
  latitude: number
  longitude: number
  attributes: PropertyAttributes
}

export type DemoValuation = {
  predicted_price_usd: number
  output_space: ExplanationOutputSpace
  reference_output: number
  features: ExplanationFeature[]
}

/** A typical-size, average-grade home at a mid-county location. */
export const REFERENCE_PROFILE: ValuationInput = {
  latitude: 47.5,
  longitude: -122.2,
  attributes: {
    sqft_living: 1910,
    bedrooms: 3,
    bathrooms: 2,
    grade: 7,
    condition: 3,
    yr_built: 1975,
    waterfront: false,
  },
}

const KM_PER_DEG_LAT = 111.2
const KM_PER_DEG_LNG = 111.2 * Math.cos((47.5 * Math.PI) / 180)

function bump(lat: number, lng: number, centerLat: number, centerLng: number, sigmaKm: number): number {
  const d = Math.hypot((lat - centerLat) * KM_PER_DEG_LAT, (lng - centerLng) * KM_PER_DEG_LNG)
  return Math.exp(-(d ** 2) / (2 * sigmaKm ** 2))
}

/**
 * Smooth location surface: weighted bumps near the Seattle core, Bellevue, and
 * a broad Eastside region. It depends on both coordinates jointly, so neither
 * coordinate alone has a fixed direction of effect.
 */
function locationSurface(weights: [number, number, number]) {
  return (lat: number, lng: number) =>
    weights[0] * bump(lat, lng, 47.655, -122.33, 8) +
    weights[1] * bump(lat, lng, 47.615, -122.21, 7) +
    weights[2] * bump(lat, lng, 47.63, -122.1, 26)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function interpolateGrade(table: Record<number, number>, grade: number): number {
  const g = clamp(grade, 1, 13)
  const lo = Math.floor(g)
  const hi = Math.ceil(g)
  const a = table[lo] ?? 0
  const b = table[hi] ?? 0
  return a + (b - a) * (g - lo)
}

function sumValues(terms: Record<string, number>): number {
  return Object.values(terms).reduce((s, v) => s + v, 0)
}

/**
 * Exact two-player Shapley split of a joint location term between latitude and
 * longitude, so the pair still sums to term(x) − term(reference).
 */
function splitLocation(
  term: (lat: number, lng: number) => number,
  x: ValuationInput,
  ref: ValuationInput,
): { latitude: number; longitude: number } {
  const both = term(x.latitude, x.longitude)
  const none = term(ref.latitude, ref.longitude)
  const latOnly = term(x.latitude, ref.longitude)
  const lngOnly = term(ref.latitude, x.longitude)
  const latitude = (latOnly - none + (both - lngOnly)) / 2
  return { latitude, longitude: both - none - latitude }
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4

const FEATURE_SPECS: { key: string; label: string; value: (x: ValuationInput) => number | string }[] = [
  { key: 'sqft_living', label: 'Living area', value: (x) => x.attributes.sqft_living },
  { key: 'grade', label: 'Grade', value: (x) => x.attributes.grade },
  { key: 'latitude', label: 'Location (latitude)', value: (x) => round4(x.latitude) },
  { key: 'longitude', label: 'Location (longitude)', value: (x) => round4(x.longitude) },
  { key: 'yr_built', label: 'Year built', value: (x) => x.attributes.yr_built },
  { key: 'condition', label: 'Condition', value: (x) => x.attributes.condition },
  { key: 'bathrooms', label: 'Bathrooms', value: (x) => x.attributes.bathrooms },
  { key: 'bedrooms', label: 'Bedrooms', value: (x) => x.attributes.bedrooms },
  { key: 'waterfront', label: 'Waterfront', value: (x) => (x.attributes.waterfront ? 'Yes' : 'No') },
]

/** Features ordered by contribution magnitude, ties broken by key for stability. */
function buildFeatures(
  input: ValuationInput,
  contributions: Record<string, number>,
  extra: ExplanationFeature[],
): ExplanationFeature[] {
  const features = FEATURE_SPECS.map((spec) => ({
    key: spec.key,
    label: spec.label,
    value: spec.value(input),
    contribution: contributions[spec.key] ?? 0,
  }))
  return [...features, ...extra].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || (a.key < b.key ? -1 : 1),
  )
}

// ---------------------------------------------------------------------------
// Property-feature demo function: additive in USD.

const TABULAR_INTERCEPT_USD = 20_000
const TABULAR_FLOOR_USD = 60_000
const tabularLocationUsd = locationSurface([185_000, 132_000, 150_000])

const GRADE_USD: Record<number, number> = {
  1: -75_000, 2: -70_000, 3: -65_000, 4: -60_000, 5: -50_000, 6: -32_000, 7: 0,
  8: 48_000, 9: 147_000, 10: 290_000, 11: 600_000, 12: 1_000_000, 13: 2_000_000,
}

/** Per-feature USD terms rounded to whole dollars, so every sum is exact. */
function tabularTerms(x: ValuationInput): Record<string, number> {
  const a = x.attributes
  return {
    sqft_living: Math.round(110 * Math.max(a.sqft_living, 0)),
    grade: Math.round(interpolateGrade(GRADE_USD, a.grade)),
    yr_built: Math.round(-140 * (clamp(a.yr_built, 1900, 2015) - 1975)),
    condition: Math.round(27_000 * (clamp(a.condition, 1, 5) - 3)),
    bathrooms: Math.round(12_500 * (clamp(a.bathrooms, 0, 8) - 2)),
    bedrooms: Math.round(-9_000 * (clamp(a.bedrooms, 0, 10) - 3)),
    waterfront: a.waterfront ? 400_000 : 0,
  }
}

const roundedLocationUsd = (lat: number, lng: number) => Math.round(tabularLocationUsd(lat, lng))

export function tabularValuation(x: ValuationInput): DemoValuation {
  const ref = REFERENCE_PROFILE
  const terms = tabularTerms(x)
  const refTerms = tabularTerms(ref)
  const reference = TABULAR_INTERCEPT_USD + sumValues(refTerms) + roundedLocationUsd(ref.latitude, ref.longitude)

  const contributions: Record<string, number> = {}
  for (const key of Object.keys(terms)) contributions[key] = (terms[key] ?? 0) - (refTerms[key] ?? 0)
  const loc = splitLocation(roundedLocationUsd, x, ref)
  contributions.latitude = Math.round(loc.latitude)
  contributions.longitude =
    roundedLocationUsd(x.latitude, x.longitude) - roundedLocationUsd(ref.latitude, ref.longitude) - contributions.latitude

  const raw = reference + sumValues(contributions)
  const extra: ExplanationFeature[] = []
  if (raw < TABULAR_FLOOR_USD) {
    // Keeps the decomposition exact when the demo floor applies.
    extra.push({ key: 'demo_floor', label: 'Demo minimum value', value: 'Applied', contribution: TABULAR_FLOOR_USD - raw })
  }

  return {
    predicted_price_usd: Math.max(raw, TABULAR_FLOOR_USD),
    output_space: 'usd',
    reference_output: reference,
    features: buildFeatures(x, contributions, extra),
  }
}

// ---------------------------------------------------------------------------
// Neighborhood-graph demo function: additive in log-price space.

const GRAPH_LOG_INTERCEPT = 12.295
/** Upper bound on the share of the log value drawn from connected homes. */
const GRAPH_CONTEXT_WEIGHT = 0.5
const graphLocationLog = locationSurface([0.468, 0.248, 0.612])

const GRADE_LOG: Record<number, number> = {
  1: -0.4, 2: -0.35, 3: -0.3, 4: -0.22, 5: -0.154, 6: -0.098, 7: 0,
  8: 0.146, 9: 0.336, 10: 0.484, 11: 0.644, 12: 0.829, 13: 1.115,
}

/** Own-feature log effects relative to the reference profile. */
function graphOwnTerms(x: ValuationInput): Record<string, number> {
  const a = x.attributes
  const r = REFERENCE_PROFILE.attributes
  const loc = splitLocation(graphLocationLog, x, REFERENCE_PROFILE)
  return {
    sqft_living: 0.534 * Math.log(Math.max(a.sqft_living, 1) / r.sqft_living),
    grade: interpolateGrade(GRADE_LOG, a.grade) - interpolateGrade(GRADE_LOG, r.grade),
    yr_built: -0.0013 * (clamp(a.yr_built, 1900, 2015) - r.yr_built),
    condition: 0.0514 * (clamp(a.condition, 1, 5) - r.condition),
    bathrooms: 0.0343 * (clamp(a.bathrooms, 0, 8) - r.bathrooms),
    bedrooms: -0.0359 * (clamp(a.bedrooms, 0, 10) - r.bedrooms),
    waterfront: (a.waterfront ? 0.5 : 0) - (r.waterfront ? 0.5 : 0),
    latitude: loc.latitude,
    longitude: loc.longitude,
  }
}

const GRAPH_LOG_REFERENCE =
  GRAPH_LOG_INTERCEPT + graphLocationLog(REFERENCE_PROFILE.latitude, REFERENCE_PROFILE.longitude)

export type ConnectedHome = ValuationInput & {
  /** Combined distance from the neighbor ranking; lower is closer and more similar. */
  score: number
}

/**
 * log p = reference + (1 − λ)·own(x) + λ·context, where context is the
 * similarity-weighted mean own-feature score of connected homes and λ grows
 * with how similar those homes are (λ = 0 with no connections). Homes unlike
 * their surroundings are pulled toward them only as far as the edges are strong.
 */
export function graphValuation(x: ValuationInput, connected: ConnectedHome[]): DemoValuation {
  const own = graphOwnTerms(x)
  const edgeWeights = connected.map((n) => Math.exp(-n.score))
  const strength = edgeWeights.reduce((s, w) => s + w, 0)
  const weight = strength > 0 ? (GRAPH_CONTEXT_WEIGHT * strength) / (strength + 1) : 0
  const contextMean =
    strength > 0
      ? connected.reduce((s, n, i) => s + (edgeWeights[i] ?? 0) * sumValues(graphOwnTerms(n)), 0) / strength
      : 0

  const contributions: Record<string, number> = {}
  for (const [key, value] of Object.entries(own)) contributions[key] = (1 - weight) * value
  let context = weight * contextMean

  const logValue = GRAPH_LOG_REFERENCE + sumValues(contributions) + context
  const predicted = Math.round(Math.exp(logValue))
  // Absorb the whole-dollar rounding residual (well under 1e-5 log units) so
  // the reference plus contributions reproduces ln(predicted).
  context += Math.log(predicted) - logValue

  return {
    predicted_price_usd: predicted,
    output_space: 'log_usd',
    reference_output: GRAPH_LOG_REFERENCE,
    features: buildFeatures(x, contributions, [
      {
        key: 'graph_context',
        label: 'Connected homes (graph context)',
        value: connected.length === 1 ? '1 connected home' : `${connected.length} connected homes`,
        contribution: context,
      },
    ]),
  }
}
