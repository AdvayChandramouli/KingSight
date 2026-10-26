/**
 * Developer-only deterministic failure scenarios for mock mode.
 * Activate with `?scenario=slow,partial` or the development panel.
 * Retryable failures fail on the first attempt for a given input and succeed
 * on explicit retry, so retry flows can be exercised deterministically.
 */
export const SCENARIOS = [
  { id: 'slow', label: 'Slow loading', description: 'Adds ~2.5 s latency to every request.' },
  { id: 'empty', label: 'Empty results', description: 'Property search returns no matches.' },
  { id: 'partial', label: 'Partial model failure', description: 'Graph model fails on the combined request; retry succeeds.' },
  { id: 'predict-error', label: 'Prediction failure', description: 'First estimate request fails; retry succeeds.' },
  { id: 'explain-error', label: 'Explanation failure', description: 'First explanation request per model fails; retry succeeds.' },
  { id: 'neighbors-unavailable', label: 'Neighbors unavailable', description: 'First neighbor request fails; retry succeeds.' },
  { id: 'map-unavailable', label: 'Map unavailable', description: 'Map cannot render; list and coordinate inputs remain.' },
  { id: 'out-of-coverage', label: 'Out of coverage', description: 'Every estimate is rejected as outside the supported area.' },
] as const

export type ScenarioId = (typeof SCENARIOS)[number]['id']

const IDS = new Set<string>(SCENARIOS.map((s) => s.id))

export function parseScenarios(search: string): Set<ScenarioId> {
  const params = new URLSearchParams(search)
  const raw = params.get('scenario') ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is ScenarioId => IDS.has(s)),
  )
}

type Listener = () => void

/** Tiny observable store so the mock client and UI read the same scenarios. */
export class ScenarioStore {
  private active: Set<ScenarioId>
  private listeners = new Set<Listener>()

  constructor(initial: Iterable<ScenarioId> = []) {
    this.active = new Set(initial)
  }

  has(id: ScenarioId): boolean {
    return this.active.has(id)
  }

  list(): ScenarioId[] {
    return [...this.active]
  }

  set(ids: Iterable<ScenarioId>): void {
    this.active = new Set(ids)
    this.listeners.forEach((l) => l())
  }

  toggle(id: ScenarioId): void {
    const next = new Set(this.active)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    this.set(next)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Stable snapshot for useSyncExternalStore. */
  snapshot = (): string => [...this.active].sort().join(',')
}
