import { ArrowRight, Lock, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { formatDistance, formatSqft, formatUsd, formatSaleDate } from '@/lib/format'
import type { Neighbor } from '@/services/types'
import { useExplorer } from './explorerState'
import { EDGE_TYPE_LABEL, zipText } from './recordText'
import { useIsDesktop } from './useMediaQuery'

type Props = {
  neighbor: Neighbor
  onClose: () => void
  className?: string
  /** Move focus into the card when it opens (e.g. after choosing a map marker). */
  focusOnOpen?: boolean
}

/** Context for one connected home. Inspecting it never changes the selected target. */
export function NeighborContextCard({ neighbor, onClose, className, focusOnOpen = false }: Props) {
  const { selectProperty, setMobileView } = useExplorer()
  const isDesktop = useIsDesktop()
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  const { property } = neighbor
  const explorable = property.role === 'held_out_example'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const shouldFocus = useRef(focusOnOpen)
  useEffect(() => {
    if (shouldFocus.current) ref.current?.focus({ preventScroll: true })
  }, [])

  const explore = () => {
    selectProperty(property.id)
    if (!isDesktop) setMobileView('details')
  }

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        'w-full max-w-[22rem] rounded-xl border border-border bg-surface p-4 shadow-lift outline-none motion-safe:animate-[ks-reveal_180ms_var(--ease-out-expo)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-clay-ink">Connected home</p>
          <h3 id={titleId} className="mt-0.5 font-display text-xl text-ink">
            Property {property.id}
          </h3>
          <p className="text-[0.8125rem] text-ink-muted">{zipText(property)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close connected home details"
          className="-mt-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sand-soft hover:text-ink"
        >
          <X aria-hidden className="size-4.5" />
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-[0.8125rem] text-ink-muted">Distance</dt>
          <dd className="tabular text-ink">{formatDistance(neighbor.distance_meters)}</dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-ink-muted">Living area</dt>
          <dd className="tabular text-ink">{formatSqft(property.attributes.sqft_living)}</dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-ink-muted">Grade</dt>
          <dd className="tabular text-ink">{property.attributes.grade} of 13</dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-ink-muted">Connection</dt>
          <dd className="text-ink">{EDGE_TYPE_LABEL[neighbor.edge_type]}</dd>
        </div>
      </dl>

      {property.actual_price_usd != null && (
        <div className="mt-3 rounded-md bg-sand-soft px-3 py-2">
          <p className="text-[0.8125rem] text-ink-muted">Recorded sale (historical observation, not a model input)</p>
          <p className="tabular text-sm font-semibold text-ink">
            {formatUsd(property.actual_price_usd)}
            {property.sale_date && <span className="font-normal text-ink-muted"> · {formatSaleDate(property.sale_date)}</span>}
          </p>
        </div>
      )}

      <div className="mt-4">
        {explorable ? (
          <Button size="sm" variant="secondary" className="min-h-11 w-full" onClick={explore}>
            Explore this property
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
            <Lock aria-hidden className="size-3.5 shrink-0" />
            Reference-only property — not available to explore
          </p>
        )}
      </div>
    </section>
  )
}
