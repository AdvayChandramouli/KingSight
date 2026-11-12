import { useState } from 'react'
import { useMediaQuery, usePrefersReducedMotion } from '@/features/explorer/useMediaQuery'
import { hasWebGL } from '@/features/explorer/map/webgl'

/**
 * The relief chunk mounts only on a wide viewport with motion and WebGL.
 * Narrow screens and reduced motion keep the photograph and never import the scene.
 */
export function useReliefGate(): boolean {
  const wide = useMediaQuery('(min-width: 768px)')
  const reduced = usePrefersReducedMotion()
  const [webgl] = useState(hasWebGL)
  return wide && !reduced && webgl
}
