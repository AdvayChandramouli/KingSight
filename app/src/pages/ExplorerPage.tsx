import { List, Map as MapIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useBlocker, type Location } from 'react-router'
import { DemoBadge, HistoricalLabel } from '@/components/brand'
import { SiteHeader } from '@/components/SiteHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/components/ui/cn'
import { DiscoveryPane } from '@/features/explorer/DiscoveryPane'
import { ExplorerProvider } from '@/features/explorer/ExplorerProvider'
import { useExplorer } from '@/features/explorer/explorerState'
import { HowItWorksDrawer } from '@/features/howItWorks/HowItWorksDrawer'
import { DetailsPanel } from '@/features/property/DetailsPanel'
import { useDataMode } from '@/services/context'

export function ExplorerPage() {
  const [howOpen, setHowOpen] = useState(false)
  const openHow = useCallback(() => setHowOpen(true), [])

  useEffect(() => {
    document.title = 'Explore properties — KingSight'
  }, [])

  return (
    <ExplorerProvider onOpenHowItWorks={openHow}>
      <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
        <SiteHeader variant="explorer" onHowItWorks={openHow} />
        <ContextStrip />
        <ExplorerWorkspace />
      </div>
      <HowItWorksDrawer open={howOpen} onOpenChange={setHowOpen} />
      <UnsavedChangesGuard />
    </ExplorerProvider>
  )
}

function ContextStrip() {
  const mode = useDataMode()
  return (
    <div className="border-b border-border bg-sand-soft">
      <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <HistoricalLabel />
        {mode === 'mock' && (
          <p className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
            <DemoBadge className="sm:hidden" />
            <span>Demo mode: properties, estimates, and explanations are illustrative, not model results.</span>
          </p>
        )}
      </div>
    </div>
  )
}

function ExplorerWorkspace() {
  const { mobileView, setMobileView, selectedId, mode } = useExplorer()

  return (
    <>
      <div className="border-b border-border bg-canvas px-4 py-2 lg:hidden">
        <SegmentedControl
          label="Explorer view"
          size="sm"
          className="flex w-full"
          value={mobileView}
          onChange={setMobileView}
          options={[
            {
              value: 'map',
              label: (
                <>
                  <MapIcon aria-hidden className="size-4" /> Map &amp; list
                </>
              ),
            },
            {
              value: 'details',
              label: (
                <>
                  <List aria-hidden className="size-4" />
                  {mode === 'create' ? 'Details · New property' : selectedId ? `Details · ${selectedId}` : 'Details'}
                </>
              ),
            },
          ]}
        />
      </div>
      <main
        id="main"
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(400px,40%)]"
      >
        {/* Both panes stay mounted so the map is never re-initialized when switching views. */}
        <section
          aria-label="Map and property list"
          className={cn('relative min-h-0', mobileView === 'map' ? 'block' : 'hidden', 'lg:block')}
        >
          <DiscoveryPane />
        </section>
        <section
          aria-label="Property details"
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain border-border bg-surface lg:border-l',
            mobileView === 'details' ? 'block' : 'hidden',
            'lg:block',
          )}
        >
          <DetailsPanel />
        </section>
      </main>
    </>
  )
}

function targetOf(location: Location): string {
  const params = new URLSearchParams(location.search)
  return `${location.pathname}|${params.get('property') ?? ''}|${params.get('mode') ?? ''}`
}

/** Confirms before leaving a target with unsubmitted edits; never traps the user. */
function UnsavedChangesGuard() {
  const { hasUnsavedChanges, setHasUnsavedChanges } = useExplorer()
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && targetOf(currentLocation) !== targetOf(nextLocation),
  )

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Leave without updating?"
      confirmLabel="Discard changes"
      onCancel={() => blocker.reset?.()}
      onConfirm={() => {
        setHasUnsavedChanges(false)
        blocker.proceed?.()
      }}
    >
      You changed property details but haven’t requested an updated estimate. Leaving will discard
      those changes.
    </ConfirmDialog>
  )
}
