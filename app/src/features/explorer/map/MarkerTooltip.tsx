import { formatSqft } from '@/lib/format'
import { cn } from '@/components/ui/cn'
import type { PropertyRecord } from '@/services/types'
import { recordedSaleText } from '../recordText'

type Props = {
  record: PropertyRecord
  x: number
  y: number
  /** Width of the map area, used to keep the tooltip on screen. */
  containerWidth: number
  /** Distance from the anchor point, in px. */
  lift?: number
  note?: string
}

const HALF_WIDTH = 120

/** Property ID, size, and recorded historical sale only; never a predicted value. */
export function MarkerTooltip({ record, x, y, containerWidth, lift = 14, note }: Props) {
  const below = y - lift < 110
  const left = containerWidth > 2 * HALF_WIDTH ? Math.min(Math.max(x, HALF_WIDTH + 8), containerWidth - HALF_WIDTH - 8) : x
  return (
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none absolute z-20 w-max max-w-60 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-[0.8125rem] leading-snug text-ink shadow-lift motion-safe:animate-[ks-fade_120ms_ease-out]',
        !below && '-translate-y-full',
      )}
      style={{ left, top: below ? y + lift : y - lift }}
    >
      <p className="font-semibold">Property {record.id}</p>
      <p className="tabular text-ink-muted">{formatSqft(record.attributes.sqft_living)}</p>
      <p className={cn('tabular', record.actual_price_usd == null ? 'text-ink-muted' : 'text-ink')}>
        {recordedSaleText(record)}
      </p>
      {note && <p className="mt-0.5 text-ink-muted">{note}</p>}
    </div>
  )
}
