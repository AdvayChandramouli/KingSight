import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ScenarioId, ScenarioStore } from '@/mocks/scenarios'
import type { KingSightClient } from './client'

export type ClientContextValue = {
  client: KingSightClient
  /** Present only in mock mode. */
  scenarios: ScenarioStore | null
}

export const ClientContext = createContext<ClientContextValue | null>(null)

export function useClient(): KingSightClient {
  const value = useContext(ClientContext)
  if (!value) throw new Error('useClient must be used inside <ClientProvider>')
  return value.client
}

export function useDataMode(): 'mock' | 'api' {
  return useClient().mode
}

const EMPTY = new Set<ScenarioId>()
const noopSubscribe = () => () => {}

/** Active developer scenarios (always empty outside mock mode). */
export function useScenarios(): { store: ScenarioStore | null; active: ReadonlySet<ScenarioId> } {
  const value = useContext(ClientContext)
  const store = value?.scenarios ?? null
  const snapshot = useSyncExternalStore(
    store ? store.subscribe.bind(store) : noopSubscribe,
    store ? store.snapshot : () => '',
  )
  const active = snapshot ? new Set(snapshot.split(',') as ScenarioId[]) : EMPTY
  return { store, active }
}
