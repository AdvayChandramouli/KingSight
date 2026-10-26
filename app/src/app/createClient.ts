import { MockKingSightClient } from '@/mocks/MockKingSightClient'
import { ScenarioStore, parseScenarios } from '@/mocks/scenarios'
import { HttpKingSightClient } from '@/services/HttpKingSightClient'
import type { ClientContextValue } from '@/services/context'
import type { AppConfig } from './config'

/** Mode is chosen once from configuration; API mode never falls back to mocks. */
export function createClient(config: AppConfig, search: string): ClientContextValue {
  if (config.dataMode === 'api') {
    return {
      client: new HttpKingSightClient({
        baseUrl: config.apiBaseUrl ?? '',
        timeoutMs: config.requestTimeoutMs,
      }),
      scenarios: null,
    }
  }
  const scenarios = new ScenarioStore(config.scenariosEnabled ? parseScenarios(search) : [])
  return {
    client: new MockKingSightClient({ scenarios }),
    scenarios,
  }
}
