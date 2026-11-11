import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { MapErrorBoundary } from '@/features/explorer/map/MapErrorBoundary'
import { hasWebGL } from '@/features/explorer/map/webgl'
import { useScenarios } from '@/services/context'
import { ART } from './art/geometry'
import { useCachedPreviewNeighbors, usePreviewEstimate } from './usePreviewEstimate'

const PreviewMapLibre = lazy(() => import('./PreviewMapLibre').then((m) => ({ default: m.PreviewMapLibre })))

type Props = {
  /** True when the frame is showing the non-interactive schematic fallback. */
  onFallbackChange: (fallback: boolean) => void
}

/**
 * Landing preview: the same MapLibre style as the explorer, fitted to the
 * preview home (and cached neighbor points when they are already loaded).
 * Failure stays inside this frame as a quiet coverage tint.
 */
export function PreviewMap({ onFallbackChange }: Props) {
  const { active } = useScenarios()
  const { property } = usePreviewEstimate()
  const neighbors = useCachedPreviewNeighbors()
  const [webgl] = useState(hasWebGL)
  const [failed, setFailed] = useState(false)
  const schematic = !webgl || active.has('map-unavailable') || failed || property.isError
  const point = property.data

  useEffect(() => {
    onFallbackChange(schematic)
  }, [onFallbackChange, schematic])

  if (schematic) return <CoverageTint />
  if (!point) return <CoverageTint waiting />

  return (
    <MapErrorBoundary
      fallback={
        <FallbackSignal onFallbackChange={onFallbackChange}>
          <CoverageTint />
        </FallbackSignal>
      }
    >
      <Suspense fallback={<CoverageTint waiting />}>
        <PreviewMapLibre
          latitude={point.latitude}
          longitude={point.longitude}
          label={point.id}
          neighbors={neighbors}
          onFail={() => setFailed(true)}
        />
      </Suspense>
    </MapErrorBoundary>
  )
}

function FallbackSignal({ onFallbackChange, children }: { onFallbackChange: (fallback: boolean) => void; children: ReactNode }) {
  useEffect(() => {
    onFallbackChange(true)
  }, [onFallbackChange])
  return children
}

/** Quiet stand-in for the preview frame. Not a geographic map. */
function CoverageTint({ waiting = false }: { waiting?: boolean }) {
  return (
    <div className="absolute inset-0 bg-land" aria-busy={waiting || undefined} aria-label={waiting ? 'Loading map' : undefined}>
      <svg aria-hidden focusable="false" viewBox="0 0 560 420" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 block h-full w-full">
        <rect width="560" height="420" fill={ART.land} />
        <path d="M-40 -40H168C152 70 176 130 154 196C136 252 164 318 142 460H-40Z" fill={ART.water} />
        <path d="M268 16C286 68 274 132 286 198C298 268 280 332 262 404C246 332 258 250 246 176C236 108 250 52 268 16Z" fill={ART.water} />
      </svg>
    </div>
  )
}
