import { lazy, Suspense, useMemo, useState } from 'react'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Skeleton'
import { useScenarios } from '@/services/context'
import { useMetadata } from '@/services/queries'
import type { Neighbor } from '@/services/types'
import { useExplorer } from './explorerState'
import { MapErrorBoundary } from './map/MapErrorBoundary'
import { asMapEngineFailure, chooseMapEngine, type MapEngineFailure } from './map/mapEngine'
import type { MapNeighborOverlay, MapViewProps } from './map/mapTypes'
import { MapUnavailable } from './map/MapUnavailable'
import { SchematicMap } from './map/SchematicMap'
import { hasWebGL } from './map/webgl'
import { useMapRecords, useSelectedRecord, useVisibleNeighborOverlay } from './useDiscoveryResults'
import { usePrefersReducedMotion } from './useMediaQuery'

// MapLibre (and its CSS) load for the default OSM style. The chunk stays lazy so the list can render first.
const MapLibreMap = lazy(() => import('./map/MapLibreMap').then((m) => ({ default: m.MapLibreMap })))

/**
 * Chooses the map engine: MapLibre on the default or overridden OSM style when
 * WebGL is available, the labeled schematic map when WebGL or the style fails,
 * and the unavailable notice for the map-unavailable scenario or a lost WebGL context.
 */
type Props = {
  insetLeft: number
  insetBottom: number
  /** Called when a connected home is chosen on the map (rather than in the details panel). */
  onInspectNeighbor: (neighbor: Neighbor) => void
}

export function PropertyMap({ insetLeft, insetBottom, onInspectNeighbor }: Props) {
  const explorer = useExplorer()
  const { active } = useScenarios()
  const metadata = useMetadata()
  const { records } = useMapRecords()
  const selected = useSelectedRecord(records)
  const { visible } = useVisibleNeighborOverlay()
  const reducedMotion = usePrefersReducedMotion()
  const [failure, setFailure] = useState<MapEngineFailure | null>(null)
  const [webgl] = useState(hasWebGL)

  const engine = chooseMapEngine({
    scenarioUnavailable: active.has('map-unavailable'),
    webgl,
    failure,
  })

  const overlay = useMemo<MapNeighborOverlay | null>(
    () => (visible ? { origin: visible.origin, neighbors: visible.context.neighbors } : null),
    [visible],
  )

  if (engine === 'unavailable') {
    const contextGone = failure === 'webgl' || failure === 'context-lost'
    return (
      <MapUnavailable
        insetLeft={insetLeft}
        detail={contextGone && !active.has('map-unavailable') ? 'This browser can’t display the interactive map.' : undefined}
      />
    )
  }

  if (metadata.isError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-land p-6" style={{ paddingLeft: insetLeft + 24 }}>
        <Notice tone="error" title="The map couldn’t load its coverage area" onRetry={() => void metadata.refetch()} className="max-w-sm bg-surface">
          The property list still works while the map is unavailable.
        </Notice>
      </div>
    )
  }

  if (!metadata.data) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-land">
        <Spinner label="Loading map…" className="text-ink-muted" />
      </div>
    )
  }

  const props: MapViewProps = {
    coverage: metadata.data.coverage,
    records,
    selected,
    draft: explorer.mode === 'create' ? explorer.draftLocation : null,
    overlay,
    inspectedId: explorer.inspectedNeighbor?.property.id ?? null,
    mode: explorer.mode,
    resetToken: explorer.mapResetToken,
    insetLeft,
    insetBottom,
    reducedMotion,
    onSelect: explorer.selectProperty,
    onPlaceDraft: explorer.setDraftLocation,
    onInspectNeighbor,
    onReset: explorer.requestMapReset,
  }

  const unavailable = <MapUnavailable insetLeft={insetLeft} />

  return (
    <MapErrorBoundary fallback={unavailable}>
        {engine === 'schematic' ? (
          <SchematicMap {...props} onFail={(reason) => setFailure(asMapEngineFailure(reason))} />
        ) : (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-land">
                <Spinner label="Loading map…" className="text-ink-muted" />
              </div>
            }
          >
            <MapLibreMap {...props} onFail={(reason) => setFailure(asMapEngineFailure(reason))} />
          </Suspense>
        )}
    </MapErrorBoundary>
  )
}
