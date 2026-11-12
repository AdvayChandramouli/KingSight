import { ChevronDown, Map as MapIcon, Network } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { useExplorer } from '@/features/explorer/explorerState'
import type { EstimateWorkflow } from '@/features/property/useEstimateWorkflow'
import { formatBathrooms, formatDistance, formatSaleDate, formatSqft, formatUsd } from '@/lib/format'
import { describeError } from '@/services/client'
import { useNeighbors } from '@/services/queries'
import type { EdgeType, Metadata, Neighbor, NeighborContext } from '@/services/types'
import { StaleFrame } from './StaleFrame'
import type { PredictionView } from './usePredictionView'

type Props = { workflow: EstimateWorkflow; metadata: Metadata; targetKey: string }

const VISIBLE = 6

const EDGE_LABEL: Record<EdgeType, string> = {
  geographic: 'Nearby location',
  similarity: 'Similar attributes',
  combined: 'Nearby with similar attributes',
}

/** The graph model's own prediction when it succeeded (possibly via a per-model retry). */
function neighborPredictionId(view: PredictionView, metadata: Metadata): string | null {
  const graphIds = new Set(metadata.models.filter((m) => m.family === 'graph').map((m) => m.id))
  const graph = view.outcomes.find((o) => graphIds.has(o.modelId) && o.state === 'success')
  return graph?.predictionId ?? view.response?.prediction_id ?? null
}

export function NeighborSection({ workflow, metadata, targetKey }: Props) {
  const view = workflow.current
  // Graph context belongs to a valid prediction; nothing to show before one exists.
  if (!view || view.status !== 'success' || !view.outcomes.some((o) => o.state === 'success')) return null

  if (!metadata.graph.available) {
    return (
      <section aria-label="Connected homes" className="space-y-3">
        <h3 className="font-display text-xl text-ink">Connected homes</h3>
        <Notice tone="neutral" title="Graph context unavailable">
          The neighborhood-graph context isn’t available right now, so connected homes can’t be shown. The estimate
          above is unaffected.
        </Notice>
      </section>
    )
  }

  return (
    <NeighborBody
      key={neighborPredictionId(view, metadata) ?? 'none'}
      predictionId={neighborPredictionId(view, metadata)}
      pending={false}
      origin={{ latitude: view.request.latitude, longitude: view.request.longitude }}
      stale={workflow.isStale}
      targetKey={targetKey}
    />
  )
}

type BodyProps = {
  predictionId: string | null
  pending: boolean
  origin: { latitude: number; longitude: number }
  stale: boolean
  targetKey: string
}

function NeighborBody({ predictionId, pending, origin, stale, targetKey }: BodyProps) {
  const headingId = useId()
  const query = useNeighbors(predictionId)
  const { showNeighbors, setShowNeighbors, setNeighborOverlay, inspectNeighbor } = useExplorer()
  const data = query.data
  const { latitude, longitude } = origin

  // A neighbor inspected for one prediction does not belong to the next.
  useEffect(() => () => inspectNeighbor(null), [inspectNeighbor])

  useEffect(() => {
    if (!data || stale) {
      setNeighborOverlay(null)
      return
    }
    setNeighborOverlay({ targetKey, origin: { latitude, longitude }, context: data })
    return () => setNeighborOverlay(null)
  }, [data, stale, targetKey, latitude, longitude, setNeighborOverlay])

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 id={headingId} className="font-display text-xl text-ink">
          Connected homes
        </h3>
        <MapToggle checked={showNeighbors} onChange={setShowNeighbors} />
      </div>
      <p className="max-w-[65ch] text-[0.95rem] text-ink-muted">
        These are the properties connected to this home in the graph model. Connections are context the model uses,
        not proof of influence or a ranked list of comparable sales.
      </p>

      <StaleFrame stale={stale} message="These connections belong to your previous inputs.">
        {pending || (query.isFetching && !data) ? (
          <NeighborSkeleton />
        ) : query.error ? (
          <Notice tone="error" title="Connected homes couldn’t load" onRetry={stale ? undefined : () => void query.refetch()}>
            {describeError(query.error).message} The estimate above is unaffected.
          </Notice>
        ) : !data ? (
          <NeighborSkeleton />
        ) : (
          <NeighborList context={data} />
        )}
      </StaleFrame>
    </section>
  )
}

function MapToggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="-mr-2 inline-flex min-h-11 items-center gap-2.5 rounded-sm px-2 text-sm font-medium text-ink transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-canvas"
    >
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 rounded-sm border transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
          checked ? 'border-brass bg-ink ring-1 ring-brass' : 'border-ink bg-canvas',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4.5 bg-surface transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          )}
        />
      </span>
      Show connections on map
    </button>
  )
}

/** Inline thread diagram of connected ids. The list below remains the accessible record. */
function NeighborThreads({ ids }: { ids: string[] }) {
  const shown = ids.slice(0, 6)
  const extra = ids.length - shown.length
  if (shown.length === 0) return null
  const row = 18
  const height = shown.length * row + 8
  const originY = height / 2
  return (
    <figure className="border border-border bg-canvas px-3 py-2 text-ink">
      <svg viewBox={`0 0 280 ${height}`} className="h-auto w-full max-w-sm text-ink" aria-hidden>
        {shown.map((id, i) => {
          const y = 8 + i * row + 4
          return (
            <g key={id}>
              <line x1="22" y1={originY} x2="72" y2={y} className="text-clay" stroke="currentColor" strokeWidth="1" />
              <text x="80" y={y + 4} className="fill-current font-mono text-[11px]">
                {id}
              </text>
            </g>
          )
        })}
        <polygon
          points={`16,${originY - 6} 22,${originY} 16,${originY + 6} 10,${originY}`}
          className="text-brass"
          fill="currentColor"
        />
      </svg>
      {extra > 0 && (
        <p className="mt-1 text-[0.8125rem] text-ink-muted">
          {extra} more connected {extra === 1 ? 'home' : 'homes'} in the list
        </p>
      )}
    </figure>
  )
}

function NeighborList({ context }: { context: NeighborContext }) {
  const [showAll, setShowAll] = useState(false)
  const listId = useId()
  const { inspectedNeighbor, inspectNeighbor } = useExplorer()
  const count = context.neighbors.length

  if (count === 0) {
    return (
      <p className="border border-border bg-canvas px-4 py-3 text-sm text-ink-muted">
        This home has few close connections in the graph, so there is limited neighborhood context.
      </p>
    )
  }

  const shown = showAll ? context.neighbors : context.neighbors.slice(0, VISIBLE)

  return (
    <div className="space-y-3">
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="sr-only">Connected homes returned</dt>
          <dd className="font-semibold text-ink tabular">
            {count} connected {count === 1 ? 'home' : 'homes'} returned
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">Graph rule:</dt>
          <dd className="text-ink">{context.rule_label}</dd>
        </div>
      </dl>
      <NeighborThreads ids={context.neighbors.map((n) => n.property.id)} />
      <ul id={listId} className="divide-y divide-border border-y border-border">
        {shown.map((n) => (
          <NeighborItem
            key={n.property.id}
            neighbor={n}
            expanded={inspectedNeighbor?.property.id === n.property.id}
            onToggle={(open) => inspectNeighbor(open ? n : null)}
          />
        ))}
      </ul>
      {count > VISIBLE && (
        <Button
          variant="ghost"
          className="-ml-3"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? `Show first ${VISIBLE}` : `Show all ${count} connected homes`}
        </Button>
      )}
    </div>
  )
}

function RoleBadge({ explorable }: { explorable: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.8125rem] font-medium',
        explorable ? 'border-ink text-ink' : 'border-border text-ink-muted',
      )}
    >
      {explorable ? 'Explorable example' : 'Reference-only'}
    </span>
  )
}

function NeighborItem({
  neighbor,
  expanded,
  onToggle,
}: {
  neighbor: Neighbor
  expanded: boolean
  onToggle: (open: boolean) => void
}) {
  const detailId = useId()
  const p = neighbor.property
  const explorable = p.role === 'held_out_example'

  return (
    <li
      className={cn(
        'bg-surface transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
        expanded && 'ring-1 ring-brass ring-inset',
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => onToggle(!expanded)}
        className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left hover:bg-canvas"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">
              {expanded && <span aria-hidden className="mr-1.5 inline-block size-2 rotate-45 bg-brass ring-1 ring-ink align-middle" />}
              Property <span className="font-mono">{p.id}</span>
            </span>
            <RoleBadge explorable={explorable} />
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-muted tabular">
            <span>{formatDistance(neighbor.distance_meters)}</span>
            <span>{formatSqft(p.attributes.sqft_living)}</span>
            <span>Grade {p.attributes.grade}</span>
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn('mt-1 size-5 shrink-0 text-ink-muted transition-transform duration-150', expanded && 'rotate-180')}
        />
      </button>
      {expanded && <NeighborDetail id={detailId} neighbor={neighbor} />}
    </li>
  )
}

function NeighborDetail({ id, neighbor }: { id: string; neighbor: Neighbor }) {
  const { selectProperty, setShowNeighbors, setMobileView } = useExplorer()
  const p = neighbor.property
  const a = p.attributes
  const explorable = p.role === 'held_out_example'

  return (
    <div id={id} className="border-t border-border px-4 pt-3 pb-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Fact label="Connection" value={EDGE_LABEL[neighbor.edge_type]} />
        <Fact label="ZIP code" value={p.zipcode ?? 'Not recorded'} />
        <Fact label="Bedrooms" value={String(a.bedrooms)} />
        <Fact label="Bathrooms" value={formatBathrooms(a.bathrooms)} />
        <Fact label="Built" value={String(a.yr_built)} />
        <Fact label="Condition" value={`${a.condition} of 5`} />
        <Fact label="Waterfront" value={a.waterfront ? 'Yes' : 'No'} />
      </dl>
      {p.actual_price_usd != null && (
        <p className="mt-3 border border-border bg-canvas px-3 py-2 text-sm text-ink-muted">
          Recorded sale <span className="font-semibold text-ink tabular">{formatUsd(p.actual_price_usd)}</span>
          {p.sale_date ? ` (${formatSaleDate(p.sale_date)})` : ''} — historical observation, not a model input.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {explorable ? (
          <Button size="md" variant="secondary" onClick={() => selectProperty(p.id)}>
            Explore this property
          </Button>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <Network aria-hidden className="size-4" />
            Reference-only: part of the graph’s context, not an explorable example.
          </p>
        )}
        <Button
          size="md"
          variant="ghost"
          className="lg:hidden"
          onClick={() => {
            setShowNeighbors(true)
            setMobileView('map')
          }}
        >
          <MapIcon aria-hidden className="size-4" />
          View on map
        </Button>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink tabular">{value}</dd>
    </div>
  )
}

function NeighborSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      <p className="text-sm text-ink-muted">Loading connected homes…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-border p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-2 h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  )
}
