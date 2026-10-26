import { BookOpen, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Skeleton } from '@/components/ui/Skeleton'
import { useExplorer } from '@/features/explorer/explorerState'
import { formatSqft, formatUsd } from '@/lib/format'
import { describeError } from '@/services/client'
import { usePropertyList } from '@/services/queries'
import type { PropertyRecord } from '@/services/types'
import { PanelShell } from './PanelStates'

const STEPS = [
  'Pick a property on the map or in the list.',
  'Request its estimates — one from each model.',
  'See what shaped them, and which homes the graph connects it to.',
]

/** Shown when nothing is selected, so the panel is never blank. */
export function ExplorerIntro() {
  const { setMode, setMobileView, openHowItWorks } = useExplorer()

  return (
    <PanelShell>
      <div className="space-y-3 pt-2">
        <h2 className="font-display text-[2rem] leading-tight font-semibold text-ink sm:text-[2.25rem]">
          Explore a home’s value in context
        </h2>
        <p className="text-[0.95rem] text-ink-muted">
          Each property is a historical example from King County sales. Estimate it with two models, then see the
          details and neighboring homes behind each estimate.
        </p>
      </div>

      <ol className="space-y-2.5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 text-[0.95rem] text-ink">
            <span
              aria-hidden
              className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-evergreen-soft text-sm font-semibold text-evergreen"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <ExampleProperties />

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Button
          variant="secondary"
          onClick={() => {
            setMode('create')
            setMobileView('details')
          }}
        >
          <Plus aria-hidden className="size-4" />
          Create a property
        </Button>
        <Button variant="ghost" onClick={openHowItWorks}>
          <BookOpen aria-hidden className="size-4" />
          How it works
        </Button>
      </div>
    </PanelShell>
  )
}

function ExampleProperties() {
  const list = usePropertyList({ limit: 4 })
  const items = list.data?.pages[0]?.items.slice(0, 4) ?? []

  return (
    <section aria-labelledby="examples-heading" className="space-y-3">
      <h3 id="examples-heading" className="font-sans text-sm font-semibold tracking-normal text-ink">
        Start with an example
      </h3>
      {list.isPending ? (
        <output className="block space-y-2" aria-label="Loading example properties">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </output>
      ) : list.error ? (
        <Notice tone="warning" title="Examples unavailable" onRetry={() => void list.refetch()}>
          {describeError(list.error).message} You can still pick a property on the map or in the list.
        </Notice>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">No example properties are available right now.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {items.map((p) => (
            <ExampleRow key={p.id} property={p} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ExampleRow({ property }: { property: PropertyRecord }) {
  const { selectProperty, setMobileView } = useExplorer()
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          selectProperty(property.id)
          setMobileView('details')
        }}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-sand-soft focus-visible:-outline-offset-2"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-ink">
            {property.id}
            <span className="font-normal text-ink-muted"> · {property.zipcode ? `ZIP ${property.zipcode}` : 'ZIP unavailable'}</span>
          </span>
          <span className="tabular block text-[0.8125rem] text-ink-muted">
            {formatSqft(property.attributes.sqft_living)} ·{' '}
            {property.actual_price_usd != null
              ? `Recorded sale ${formatUsd(property.actual_price_usd)}`
              : 'No recorded sale price'}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
      </button>
    </li>
  )
}
