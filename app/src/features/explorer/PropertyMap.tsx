import { lazy, Suspense, useMemo, useState } from 'react'
import { config } from '@/app/config'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Skeleton'
import { useScenarios } from '@/services/context'
import { useMetadata } from '@/services/queries'
import type { Neighbor } from '@/services/types'
import { useExplorer } from './explorerState'
import { MapErrorBoundary } from './map/MapErrorBoundary'
import type { MapNeighborOverlay, MapViewProps } from './map/mapTypes'
import { MapUnavailable } from './map/MapUnavailable'
import { SchematicMap } from './map/SchematicMap'
import { hasWebGL } from './map/webgl'
import { useMapRecords, useSelectedRecord, useVisibleNeighborOverlay } from './useDiscoveryResults'
import { usePrefersReducedMotion } from './useMediaQuery'

// maplibre-gl (and its CSS) only download when a style URL is configured.
const MapLibreMap = lazy(() => import('./map/MapLibreMap').then((m) => ({ default: m.MapLibreMap })))

type Engine = 'maplibre' | 'schematic' | 'unavailable'

/**
 * Chooses the map engine: MapLibre when a style URL and WebGL exist, the
 * labeled schematic fallback when no style is configured, and a calm
 * unavailable state when the map cannot render.
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
  const [failure, setFailure] = useState<string | null>(null)
  const [webgl] = useState(() => (config.mapStyleUrl ? hasWebGL() : false))

  const engine: Engine = active.has('map-unavailable')
    ? 'unavailable'
    : !config.mapStyleUrl
      ? 'schematic'
      : failure || !webgl
        ? 'unavailable'
        : 'maplibre'

  const overlay = useMemo<MapNeighborOverlay | null>(
    () => (visible ? { origin: visible.origin, neighbors: visible.context.neighbors } : null),
    [visible],
  )

  if (engine === 'unavailable') {
    return (
      <MapUnavailable
        insetLeft={insetLeft}
        detail={!webgl && config.mapStyleUrl && !active.has('map-unavailable') ? 'This browser can’t display the interactive map.' : undefined}
      />
    )
  }

  if (metadata.isError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-sand-soft p-6" style={{ paddingLeft: insetLeft + 24 }}>
        <Notice tone="error" title="The map couldn’t load its coverage area" onRetry={() => void metadata.refetch()} className="max-w-sm bg-surface">
          The property list still works while the map is unavailable.
        </Notice>
      </div>
    )
  }

  if (!metadata.data) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-sand-soft">
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
          <SchematicMap {...props} onFail={setFailure} />
        ) : (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-sand-soft">
                <Spinner label="Loading map…" className="text-ink-muted" />
              </div>
            }
          >
            <MapLibreMap {...props} onFail={setFailure} />
          </Suspense>
        )}
    </MapErrorBoundary>
  )
}
