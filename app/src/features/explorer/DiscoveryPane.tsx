import { List, Map as MapIcon, MousePointerClick, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Spinner } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { countText } from './countText'
import { useExplorer } from './explorerState'
import { ClearFiltersButton, FilterFields, SearchField } from './FilterControls'
import { NeighborContextCard } from './NeighborContextCard'
import { NeighborLegend } from './NeighborLegend'
import { ResultCount, ResultsList } from './ResultsList'
import { activeFilterCount } from './toPropertyQuery'
import {
  MAP_MARKER_LIMIT,
  useDiscoveryResults,
  useMapRecords,
  useVisibleNeighborOverlay,
  type DiscoveryResults,
} from './useDiscoveryResults'
import { useFilterDraft, type FilterDraftApi } from './useFilterDraft'
import { useElementSize } from './map/useElementSize'
import { useIsDesktop } from './useMediaQuery'
import type { Neighbor } from '@/services/types'

// The map engine loads after the list so discovery is usable before map code arrives.
const PropertyMap = lazy(() => import('./PropertyMap').then((m) => ({ default: m.PropertyMap })))

const TRAY_WIDTH = 360
const TRAY_GAP = 12
const MOBILE_STACK_OFFSET = 68

type InnerView = 'map' | 'list'

/** Left explorer pane: map with results tray (desktop) or map/list switch (mobile). */
export function DiscoveryPane() {
  const explorer = useExplorer()
  const isDesktop = useIsDesktop()
  const filterApi = useFilterDraft()
  const results = useDiscoveryResults()
  const [trayOpen, setTrayOpen] = useState(true)
  const [innerView, setInnerView] = useState<InnerView>('map')
  const [mapInspectedId, setMapInspectedId] = useState<string | null>(null)
  const { inspectNeighbor } = explorer
  const inspectFromMap = useCallback(
    (neighbor: Neighbor) => {
      setMapInspectedId(neighbor.property.id)
      inspectNeighbor(neighbor)
    },
    [inspectNeighbor],
  )

  const insetLeft = isDesktop && trayOpen ? TRAY_WIDTH + TRAY_GAP * 2 : 0
  // Small screens float the legend and selection bar over the lower map; frame content above them.
  const [floatingHeight, setFloatingHeight] = useState(0)
  const insetBottom = isDesktop || floatingHeight === 0 ? 0 : floatingHeight + MOBILE_STACK_OFFSET - 28
  const showMap = isDesktop || innerView === 'map'

  const onSelect = (id: string) => {
    explorer.selectProperty(id)
    if (!isDesktop) explorer.setMobileView('details')
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {!isDesktop && (
        <MobileDiscoveryBar api={filterApi} results={results} innerView={innerView} onInnerViewChange={setInnerView} />
      )}
      <div className="relative min-h-0 flex-1">
        <div className={cn('absolute inset-0', !showMap && 'hidden')}>
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-sand-soft">
                <Spinner label="Loading map…" className="text-ink-muted" />
              </div>
            }
          >
            <PropertyMap insetLeft={insetLeft} insetBottom={insetBottom} onInspectNeighbor={inspectFromMap} />
          </Suspense>
          <MapOverlays
            insetLeft={insetLeft}
            isDesktop={isDesktop}
            mapInspectedId={mapInspectedId}
            onFloatingHeightChange={setFloatingHeight}
          />
        </div>

        {isDesktop ? (
          <ResultsTray
            open={trayOpen}
            onOpenChange={setTrayOpen}
            api={filterApi}
            results={results}
            onSelect={onSelect}
          />
        ) : (
          innerView === 'list' && (
            <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-surface px-4 pt-3 pb-6">
              <ResultCount results={results} className="mb-2 px-1" />
              <MapCapNote className="mb-2 px-1" />
              <ResultsList results={results} onSelect={onSelect} onClearFilters={filterApi.clear} />
            </div>
          )
        )}
      </div>
    </div>
  )
}

function ResultsTray({
  open,
  onOpenChange,
  api,
  results,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  api: FilterDraftApi
  results: DiscoveryResults
  onSelect: (id: string) => void
}) {
  const bodyId = useId()

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => onOpenChange(true)}
        className="absolute top-3 left-3 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink shadow-lift transition-colors duration-150 hover:border-evergreen hover:bg-evergreen-soft"
      >
        <PanelLeftOpen aria-hidden className="size-4 text-evergreen" />
        Search &amp; results
        {!results.isPending && <span className="text-ink-muted tabular">· {countText(results)}</span>}
      </button>
    )
  }

  return (
    <aside
      aria-label="Search and results"
      className="absolute top-3 bottom-3 left-3 z-20 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lift motion-safe:animate-[ks-fade_160ms_ease-out]"
      style={{ width: TRAY_WIDTH }}
    >
      <div className="border-b border-border px-4 pt-3.5 pb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-[1.35rem] text-ink">Find a property</h2>
          <button
            type="button"
            aria-expanded
            aria-controls={bodyId}
            onClick={() => onOpenChange(false)}
            className="-mr-1.5 inline-flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sand-soft hover:text-ink"
          >
            <PanelLeftClose aria-hidden className="size-4.5" />
            <span className="sr-only">Hide search and results</span>
          </button>
        </div>
        <div id={bodyId} className="space-y-3.5">
          <SearchField api={api} />
          <FilterFields api={api} showClear={false} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-1.5">
        <ResultCount results={results} className="flex-1" />
        <ClearFiltersButton api={api} className="-mr-2" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-2.5">
        <ResultsList results={results} onSelect={onSelect} onClearFilters={api.clear} />
      </div>
    </aside>
  )
}

function MobileDiscoveryBar({
  api,
  results,
  innerView,
  onInnerViewChange,
}: {
  api: FilterDraftApi
  results: DiscoveryResults
  innerView: InnerView
  onInnerViewChange: (view: InnerView) => void
}) {
  const { filters } = useExplorer()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const count = activeFilterCount({ ...filters, q: '' })

  return (
    <div className="space-y-2.5 border-b border-border bg-canvas px-4 pt-2.5 pb-3">
      <SearchField api={api} />
      <div className="flex items-center gap-2">
        <SegmentedControl<InnerView>
          label="Show map or list"
          size="sm"
          className="flex min-w-0 flex-1 [&>*]:min-h-11"
          value={innerView}
          onChange={onInnerViewChange}
          options={[
            {
              value: 'map',
              label: (
                <>
                  <MapIcon aria-hidden className="size-4" /> Map
                </>
              ),
            },
            {
              value: 'list',
              label: (
                <>
                  <List aria-hidden className="size-4" /> List
                </>
              ),
            },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11 shrink-0 px-4"
          onClick={() => setFiltersOpen(true)}
          aria-label={count ? `Filters, ${count} active` : 'Filters'}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Filters
          {count > 0 && (
            <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-full bg-evergreen text-[0.75rem] font-semibold text-white">
              {count}
            </span>
          )}
        </Button>
      </div>
      <Drawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        side="bottom"
        title="Filters"
        description="Narrow the example properties by size and waterfront."
        footer={
          <div className="flex items-center justify-between gap-3">
            <ClearFiltersButton api={api} />
            <Button className="min-h-11" onClick={() => setFiltersOpen(false)}>
              {results.isPending ? 'Show properties' : `Show ${countText(results)}`}
            </Button>
          </div>
        }
      >
        <FilterFields api={api} showClear={false} />
      </Drawer>
    </div>
  )
}

function MapCapNote({ className }: { className?: string }) {
  const { truncated } = useMapRecords()
  if (!truncated) return null
  return (
    <p className={cn('text-[0.8125rem] text-ink-muted', className)}>
      The map shows the first {MAP_MARKER_LIMIT} matches; this list includes them all.
    </p>
  )
}

/** Everything drawn above the map: create hint, legend, neighbor card, notes. */
function MapOverlays({
  insetLeft,
  isDesktop,
  mapInspectedId,
  onFloatingHeightChange,
}: {
  insetLeft: number
  isDesktop: boolean
  mapInspectedId: string | null
  onFloatingHeightChange: (height: number) => void
}) {
  const stackRef = useRef<HTMLDivElement>(null)
  const stack = useElementSize(stackRef)
  useEffect(() => onFloatingHeightChange(stack.height), [stack.height, onFloatingHeightChange])
  const explorer = useExplorer()
  const { available } = useVisibleNeighborOverlay()
  const { truncated } = useMapRecords()
  const creating = explorer.mode === 'create'
  const mapUp = !explorer.mapUnavailable
  // Neighbors opened from the details panel are highlighted on the map; the panel shows their details.
  const inspected =
    explorer.inspectedNeighbor?.property.id === mapInspectedId ? explorer.inspectedNeighbor : null

  const hint = creating && mapUp && (
    <output
      className="pointer-events-auto flex max-w-[24rem] items-start gap-2 rounded-lg border border-evergreen/40 bg-surface px-3.5 py-2.5 text-sm text-ink shadow-soft"
    >
      <MousePointerClick aria-hidden className="mt-0.5 size-4 shrink-0 text-evergreen" />
      Click the map to place your property, or enter coordinates in the form
    </output>
  )

  const legend = available && mapUp && (
    <NeighborLegend context={available.context} compact={!isDesktop} className="pointer-events-auto" />
  )
  const card = inspected && (
    <NeighborContextCard
      key={inspected.property.id}
      focusOnOpen
      neighbor={inspected}
      onClose={() => explorer.inspectNeighbor(null)}
      className="pointer-events-auto"
    />
  )
  const note = truncated && mapUp && (
    <p className="rounded-full border border-border bg-surface/95 px-3 py-1 text-[0.75rem] text-ink-muted shadow-soft">
      Showing the first {MAP_MARKER_LIMIT} matches on the map
    </p>
  )

  if (isDesktop) {
    return (
      <>
        {hint && (
          <div className="pointer-events-none absolute top-3 z-10" style={{ left: insetLeft + TRAY_GAP, right: 196 }}>
            {hint}
          </div>
        )}
        {legend && <div className="pointer-events-none absolute top-[7.25rem] right-3 z-10 w-[19rem]">{legend}</div>}
        {/* The card sits over the lower tray so the selection and its connections stay visible. */}
        {card && (
          <div className="pointer-events-none absolute bottom-5 left-5 z-30 flex" style={{ width: TRAY_WIDTH - 16 }}>
            {card}
          </div>
        )}
        {note && (
          <div className="pointer-events-none absolute bottom-12 z-10" style={{ left: insetLeft + TRAY_GAP }}>
            {note}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {hint && <div className="pointer-events-none absolute inset-x-3 top-[6.75rem] z-10">{hint}</div>}
      <div
        ref={stackRef}
        className="pointer-events-none absolute inset-x-3 z-10 flex flex-col items-stretch gap-2"
        style={{ bottom: MOBILE_STACK_OFFSET }}
      >
        {card ?? legend}
      </div>
    </>
  )
}
