import { ModelTag } from '@/components/brand'
import { cn } from '@/components/ui/cn'
import { Notice } from '@/components/ui/Notice'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatSignedLog, formatSignedUsd, formatSqft, formatUsd } from '@/lib/format'
import type { Explanation, ExplanationFeature } from '@/services/types'
import { IllustrativeTag } from './IllustrativeTag'
import { PREVIEW_PROPERTY_ID, usePreviewExplanation } from './usePreviewEstimate'

const MAX_ROWS = 5

export function ContributionsSection() {
  return (
    <section aria-labelledby="contributions-title" className="border-y border-border bg-sand-soft/70">
      <div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20 lg:px-12 lg:py-28">
        <div className="lg:pt-2">
          <h2 id="contributions-title" className="max-w-[14ch] text-[2rem] font-medium text-ink sm:text-[2.5rem]">
            See what shaped the estimate
          </h2>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink">
            These attributes pushed this model’s estimate higher or lower relative to its reference
            prediction.
          </p>
          <p className="mt-4 max-w-[34rem] leading-relaxed text-ink-muted">
            Contributions describe how the model behaved for this one estimate. They aren’t guaranteed
            price changes: renovating a home wouldn’t necessarily move its price by the amount shown.
            Attributes that tend to move together, like living area and bathrooms, can share importance.
          </p>
        </div>
        <ContributionPanel />
      </div>
    </section>
  )
}

function ContributionPanel() {
  const { explanation, model, loading, unavailable } = usePreviewExplanation()
  const data = explanation.data

  let body
  if (unavailable || explanation.isError) {
    body = (
      <Notice
        tone="neutral"
        title="Feature explanation unavailable for this example"
        onRetry={explanation.isError ? () => void explanation.refetch() : undefined}
      >
        Open the property in the explorer to request an estimate and its explanation.
      </Notice>
    )
  } else if (loading || !data) {
    body = (
      <ul aria-busy="true" aria-label="Loading explanation" className="divide-y divide-border">
        {Array.from({ length: MAX_ROWS }, (_, i) => (
          <li key={i} className="flex items-center gap-4 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-4 w-20" />
          </li>
        ))}
      </ul>
    )
  } else if (data.features.length === 0) {
    body = <p className="text-sm text-ink-muted">Feature explanation unavailable for this estimate.</p>
  } else {
    body = <ContributionBars explanation={data} />
  }

  return (
    <div className="rounded-[18px] border border-border bg-surface p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-xl font-medium text-ink">Property {PREVIEW_PROPERTY_ID}</h3>
          {model && <ModelTag model={model} className="mt-1" />}
        </div>
        <IllustrativeTag realLabel="Example explanation" />
      </div>
      <div className="pt-2" aria-live="polite">
        {body}
      </div>
    </div>
  )
}

function ContributionBars({ explanation }: { explanation: Explanation }) {
  const isUsd = explanation.output_space === 'usd'
  const rows = [...explanation.features]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, MAX_ROWS)
  const max = Math.max(...rows.map((f) => Math.abs(f.contribution)), Number.EPSILON)
  const ref = explanation.reference_output

  return (
    <>
      {ref != null && (
        <p className="pt-2 pb-1 text-sm text-ink-muted">
          Reference prediction:{' '}
          <span className="font-medium text-ink tabular">
            {isUsd ? formatUsd(ref) : `${ref.toFixed(3)} log-price`}
          </span>
        </p>
      )}
      <ul className="divide-y divide-border">
        {rows.map((f) => (
          <ContributionRow key={f.key} feature={f} share={Math.abs(f.contribution) / max} isUsd={isUsd} />
        ))}
      </ul>
      <p className="mt-3 border-t border-border pt-4 text-[0.8125rem] text-ink-muted">
        {isUsd
          ? 'Contributions are in dollars, relative to the reference prediction.'
          : 'Contributions are in log-price units, not dollars. Positive values raised the estimate; negative values lowered it.'}
      </p>
    </>
  )
}

function ContributionRow({ feature, share, isUsd }: { feature: ExplanationFeature; share: number; isUsd: boolean }) {
  const c = feature.contribution
  const direction = c > 0 ? 'raised' : c < 0 ? 'lowered' : 'no effect'
  const amount = isUsd ? formatSignedUsd(c) : formatSignedLog(c)
  const width = `${Math.max(share * 50, c === 0 ? 0 : 1.5)}%`

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)_7rem]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{feature.label}</p>
        <p className="truncate text-[0.8125rem] text-ink-muted tabular">{formatFeatureValue(feature)}</p>
      </div>
      <div className="relative col-span-2 h-6 sm:col-span-1 sm:row-start-1 sm:col-start-2" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px bg-control/50" />
        <span
          className={cn(
            'absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full',
            c >= 0 ? 'left-1/2 bg-evergreen' : 'right-1/2 bg-clay',
          )}
          style={{ width }}
        />
      </div>
      <p className="row-start-1 col-start-2 text-right sm:col-start-3">
        <span className="block text-sm font-semibold text-ink tabular">{amount}</span>
        <span className={cn('block text-[0.8125rem]', c >= 0 ? 'text-evergreen' : 'text-clay-ink')}>{direction}</span>
      </p>
    </li>
  )
}

function formatFeatureValue(f: ExplanationFeature): string {
  if (typeof f.value === 'string') return f.value
  if (f.key === 'sqft_living') return formatSqft(f.value)
  if (Number.isInteger(f.value)) return String(f.value)
  return String(Number(f.value.toFixed(4)))
}
