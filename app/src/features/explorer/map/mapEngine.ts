/** How long MapLibre may take to fire `load` before the labeled schematic fallback. */
export const MAP_STYLE_LOAD_TIMEOUT_MS = 15_000

export type MapEngineName = 'maplibre' | 'schematic' | 'unavailable'

/**
 * Why a MapLibre instance gave up.
 * `style` and `timeout` are recoverable with the schematic map.
 * `webgl` (context could not be created) and `context-lost` use the unavailable notice.
 */
export type MapEngineFailure = 'style' | 'timeout' | 'webgl' | 'context-lost'

/**
 * Explorer engine policy (Phase 3):
 * scenario `map-unavailable` → unavailable;
 * no WebGL → labeled schematic;
 * otherwise MapLibre, and a style/timeout failure falls back to schematic
 * while a lost or uncreatable WebGL context uses the unavailable notice.
 */
export function chooseMapEngine(options: {
  scenarioUnavailable: boolean
  webgl: boolean
  failure: MapEngineFailure | null
}): MapEngineName {
  if (options.scenarioUnavailable) return 'unavailable'
  if (!options.webgl) return 'schematic'
  if (options.failure === 'webgl' || options.failure === 'context-lost') return 'unavailable'
  if (options.failure === 'style' || options.failure === 'timeout') return 'schematic'
  return 'maplibre'
}

export function asMapEngineFailure(reason: string): MapEngineFailure {
  if (reason === 'style' || reason === 'timeout' || reason === 'webgl' || reason === 'context-lost') return reason
  return 'style'
}
