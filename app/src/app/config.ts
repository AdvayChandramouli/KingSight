export type ClientMode = 'mock' | 'api'

export type AppConfig = {
  dataMode: ClientMode
  apiBaseUrl: string | null
  /** MapLibre style URL. When absent the offline schematic map is used. */
  mapStyleUrl: string | null
  mapAttribution: string | null
  /** Developer-only deterministic scenario controls (mock mode only). */
  scenariosEnabled: boolean
  requestTimeoutMs: number
  /** Configuration problems are surfaced, never silently corrected. */
  configError: string | null
}

type Env = Partial<Record<string, string | boolean | undefined>>

export function readConfig(env: Env): AppConfig {
  const rawMode = String(env.VITE_DATA_MODE ?? 'mock').trim()
  const apiBaseUrl = clean(env.VITE_API_BASE_URL)
  let configError: string | null = null
  let dataMode: ClientMode = 'mock'

  if (rawMode === 'mock' || rawMode === 'api') {
    dataMode = rawMode
  } else {
    configError = `VITE_DATA_MODE must be "mock" or "api" (received "${rawMode}").`
    dataMode = 'api'
  }
  if (dataMode === 'api' && !apiBaseUrl && !configError) {
    configError = 'VITE_DATA_MODE is "api" but VITE_API_BASE_URL is not set.'
  }

  return {
    dataMode,
    apiBaseUrl,
    mapStyleUrl: clean(env.VITE_MAP_STYLE_URL),
    mapAttribution: clean(env.VITE_MAP_ATTRIBUTION),
    scenariosEnabled: dataMode === 'mock' && (env.DEV === true || env.VITE_ENABLE_SCENARIOS === 'true'),
    requestTimeoutMs: Number(env.VITE_REQUEST_TIMEOUT_MS) > 0 ? Number(env.VITE_REQUEST_TIMEOUT_MS) : 15000,
    configError,
  }
}

function clean(value: string | boolean | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const config: AppConfig = readConfig(import.meta.env as Env)
