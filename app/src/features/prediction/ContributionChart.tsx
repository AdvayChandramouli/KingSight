import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import type { ExplanationFeature, ExplanationOutputSpace } from '@/services/types'
import { formatContribution, formatFeatureValue } from './modelDisplay'

const VISIBLE = 6

type Props = { features: ExplanationFeature[]; space: ExplanationOutputSpace }

/** Signed local contributions diverging from a center axis, largest first. */
export function ContributionChart({ features, space }: Props) {
  const [showAll, setShowAll] = useState(false)
  const listId = useId()
  const sorted = [...features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  const shown = showAll ? sorted : sorted.slice(0, VISIBLE)
  const max = Math.max(...sorted.map((f) => Math.abs(f.contribution)), Number.EPSILON)

  return (
    <div>
      <ul id={listId} className="space-y-3.5">
        {shown.map((f) => {
          const direction = f.contribution > 0 ? 'raised' : f.contribution < 0 ? 'lowered' : 'no effect'
          const half = (Math.abs(f.contribution) / max) * 50
          return (
            <li key={f.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{f.label}</span>{' '}
                  <span className="text-ink-muted tabular">{formatFeatureValue(f.key, f.value)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-semibold text-ink tabular">{formatContribution(f.contribution, space)}</span>{' '}
                  <span className="text-ink-muted">{direction}</span>
                </span>
              </div>
              <div aria-hidden className="relative mt-1.5 h-2.5 rounded-full bg-sand-soft">
                <div
                  className={cn(
                    'absolute inset-y-0',
                    f.contribution >= 0 ? 'left-1/2 rounded-r-full bg-evergreen' : 'right-1/2 rounded-l-full bg-warning/80',
                  )}
                  style={{ width: `${Math.max(half, f.contribution === 0 ? 0 : 0.75)}%` }}
                />
                <div className="absolute -inset-y-1 left-1/2 w-px -translate-x-1/2 bg-control" />
              </div>
            </li>
          )
        })}
      </ul>
      <div aria-hidden className="mt-2 flex justify-between text-[0.8125rem] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Lowered the estimate
        </span>
        <span className="inline-flex items-center gap-1">
          Raised the estimate
          <ArrowRight className="size-3.5" />
        </span>
      </div>
      {sorted.length > VISIBLE && (
        <Button
          variant="ghost"
          className="mt-3 -ml-3"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? `Show top ${VISIBLE}` : `Show all ${sorted.length} attributes`}
        </Button>
      )}
    </div>
  )
}
