import { useSyncExternalStore } from 'react'

const NARROW_QUERY = '(max-width: 767px)'
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

let webglCached: boolean | null = null

/** Throwaway context only. The scene chunk is a separate module and is not imported here. */
function probeWebGL(): boolean {
  if (webglCached !== null) return webglCached
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    webglCached = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglCached = false
  }
  return webglCached
}

function mediaBlocksScene(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  if (window.matchMedia(REDUCE_QUERY).matches) return true
  if (window.matchMedia(NARROW_QUERY).matches) return true
  return false
}

function sceneAllowedSnapshot(): boolean {
  if (mediaBlocksScene()) return false
  return probeWebGL()
}

function subscribeReliefGate(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const lists = [window.matchMedia(NARROW_QUERY), window.matchMedia(REDUCE_QUERY)]
  for (const list of lists) list.addEventListener('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

/** False on narrow viewports, reduced motion, or when WebGL cannot be created. */
export function useReliefSceneAllowed(): boolean {
  return useSyncExternalStore(subscribeReliefGate, sceneAllowedSnapshot, () => false)
}
