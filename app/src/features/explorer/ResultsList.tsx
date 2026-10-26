import { Check, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, Spinner } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { formatInteger, formatSqft } from '@/lib/format'
import type { PropertyRecord } from '@/services/types'
import { useExplorer } from './explorerState'
import { bedsBathsText, recordedSaleText, zipText } from './recordText'
import type { DiscoveryResults } from './useDiscoveryResults'
import { countText } from './countText'

/** Polite live count so filter changes are announced without moving focus. */
export function ResultCount({ results, className }: { results: DiscoveryResults; className?: string }) {
  const refreshing = results.isFetching && !results.isFetchingNextPage && !results.isPending
  return (
    <div className={cn('flex min-h-6 items-center justify-between gap-3 text-[0.8125rem]', className)}>
      <output aria-live="polite" className="font-medium text-ink tabular">
        {results.isPending ? 'Loading properties…' : results.isError && results.items.length === 0 ? '' : countText(results)}
      </output>
      {refreshing && <Spinner label="Updating" className="size-3.5" />}
    </div>
  )
}

function ResultRow({ record, selected, onSelect }: { record: PropertyRecord; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(record.id)}
        className={cn(
          'group relative block min-h-11 w-full rounded-md border px-3.5 py-2.5 text-left transition-colors duration-150',
          selected
            ? 'border-evergreen bg-evergreen-soft'
            : 'border-transparent hover:border-border hover:bg-sand-soft',
        )}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-ink">Property {record.id}</span>
          {selected && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold text-evergreen">
              <Check aria-hidden className="size-3.5" strokeWidth={2.75} />
              Selected
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[0.8125rem] text-ink-muted tabular">
          {zipText(record)} · {formatSqft(record.attributes.sqft_living)} · {bedsBathsText(record)}
        </span>
        <span
          className={cn(
            'mt-0.5 block text-[0.8125rem] tabular',
            record.actual_price_usd == null ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {recordedSaleText(record)}
        </span>
      </button>
    </li>
  )
}

type Props = {
  results: DiscoveryResults
  onSelect: (id: string) => void
  onClearFilters: () => void
  className?: string
}

/** The accessible list alternative to the map: same filtered records, paginated. */
export function ResultsList({ results, onSelect, onClearFilters, className }: Props) {
  const { selectedId, mode } = useExplorer()
  const activeId = mode === 'browse' ? selectedId : null
  const { items, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, total } = results

  if (isPending) {
    return (
      <div className={cn('space-y-2 px-1', className)} aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-1.5 px-2.5 py-2.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-52" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    )
  }

  if (isError && items.length === 0) {
    return (
      <Notice tone="error" role="alert" title="Properties couldn’t load" onRetry={() => void refetch()} className={className}>
        Check your connection and try again. The map stays available.
      </Notice>
    )
  }

  if (items.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border bg-sand-soft/60 px-5 py-6 text-center', className)}>
        <SearchX aria-hidden className="mx-auto size-6 text-ink-muted" />
        <p className="mt-2 font-semibold text-ink">No properties match these filters</p>
        <p className="mt-1 text-sm text-ink-muted">
          Search matches property IDs and ZIP codes. Try a wider living-area range or a different waterfront setting.
        </p>
        <Button variant="secondary" size="sm" className="mt-4 min-h-11" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div className={className}>
      <ul aria-label="Properties" className="space-y-1">
        {items.map((record) => (
          <ResultRow key={record.id} record={record} selected={record.id === activeId} onSelect={onSelect} />
        ))}
      </ul>
      {isError && (
        <Notice tone="error" title="More properties couldn’t load" onRetry={() => void fetchNextPage()} className="mt-3" />
      )}
      {hasNextPage && !isError && (
        <div className="mt-3 flex flex-col items-center gap-1.5 pb-1">
          <Button variant="secondary" size="sm" className="min-h-11 w-full" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? <Spinner label="Loading more…" /> : 'Show more results'}
          </Button>
          {total != null && (
            <p className="text-[0.8125rem] text-ink-muted tabular">
              Showing {formatInteger(items.length)} of {formatInteger(total)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
