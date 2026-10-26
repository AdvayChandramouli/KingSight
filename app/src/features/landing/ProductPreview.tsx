import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { HistoricalLabel, ModelTag } from '@/components/brand'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Notice } from '@/components/ui/Notice'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatBathrooms, formatSaleDate, formatSqft, formatUsd } from '@/lib/format'
import { describeError } from '@/services/client'
import type { ModelInfo, ModelResult, PropertyDetail } from '@/services/types'
import { IllustrativeTag } from './IllustrativeTag'
import { PreviewMap } from './PreviewMap'
import { PREVIEW_HREF, PREVIEW_PROPERTY_ID, resultFor, usePreviewEstimate } from './usePreviewEstimate'

export function ProductPreview() {
  return (
    <section
      aria-labelledby="preview-title"
      className="mx-auto max-w-[90rem] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32"
    >
      <div className="mb-8 flex flex-col gap-3 lg:mb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <h2 id="preview-title" className="text-[2rem] font-medium text-ink sm:text-[2.5rem]">
          Start with one home
        </h2>
        <p className="max-w-[32rem] text-ink-muted lg:text-right">
          Pick a property on the map to see its recorded details, then ask for an estimate of its value
          in the 2014–2015 market.
        </p>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-border bg-surface shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
          <IllustrativeTag realLabel="Example property" mockLabel="Illustrative preview · demo data" />
          <HistoricalLabel />
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(23rem,1fr)]">
          <div className="flex flex-col bg-land">
            <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[26rem] lg:flex-1">
              <PreviewMap />
            </div>
            <MapLegend />
          </div>
          <PreviewDetails />
        </div>
      </div>
    </section>
  )
}

function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border bg-surface/80 px-4 py-2.5 text-[0.8125rem] text-ink-muted sm:px-5">
      <span className="inline-flex items-center gap-2">
        <svg aria-hidden viewBox="0 0 16 16" className="size-4">
          <circle cx="8" cy="8" r="5.5" fill="#FFFEFA" stroke="#31594A" strokeWidth="2.5" />
          <circle cx="8" cy="8" r="2" fill="#31594A" />
        </svg>
        Property {PREVIEW_PROPERTY_ID}
      </span>
      <span className="inline-flex items-center gap-2">
        <svg aria-hidden viewBox="0 0 20 8" className="h-2 w-5">
          <path d="M1 4H19" stroke="#9A654A" strokeWidth="1.8" strokeDasharray="3.5 3" strokeLinecap="round" />
        </svg>
        Graph connections
      </span>
      <span className="sm:ml-auto">Schematic map, not to scale</span>
    </div>
  )
}

function PreviewDetails() {
  const { metadata, property, prediction, loading, blocked } = usePreviewEstimate()

  return (
    <div className="flex flex-col gap-5 border-t border-border p-5 sm:p-6 lg:border-t-0 lg:border-l">
      {blocked ? (
        <Notice tone="neutral" title="Preview unavailable">
          This example couldn’t be loaded right now. You can still browse every example in the
          explorer.
        </Notice>
      ) : property.data ? (
        <PropertySummary property={property.data} />
      ) : (
        <PropertySummarySkeleton />
      )}

      {!blocked && (
        <EstimateCard
          loading={loading}
          error={prediction.isError ? prediction.error : null}
          onRetry={() => void prediction.refetch()}
          valuationYear={property.data?.valuation_year ?? null}
          result={resultFor(prediction.data, metadata.data?.primary_model_id ?? null)}
          model={metadata.data?.models.find((m) => m.id === metadata.data?.primary_model_id)}
        />
      )}

      <Link to={PREVIEW_HREF} className={buttonClasses('primary', 'lg', 'mt-auto w-full no-underline')}>
        Open this property
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  )
}

function PropertySummary({ property }: { property: PropertyDetail }) {
  const a = property.attributes
  const facts: [label: string, value: string][] = [
    ['Living area', formatSqft(a.sqft_living)],
    ['Bedrooms', String(a.bedrooms)],
    ['Bathrooms', formatBathrooms(a.bathrooms)],
    ['Grade', `${a.grade} of 13`],
    ['Built', String(a.yr_built)],
    ['Waterfront', a.waterfront ? 'Yes' : 'No'],
  ]
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-2xl font-medium text-ink">Property {property.id}</h3>
        {property.zipcode && <span className="text-sm text-ink-muted tabular">ZIP {property.zipcode}</span>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[0.8125rem] text-ink-muted">{label}</dt>
            <dd className="font-medium text-ink tabular">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 rounded-md bg-sand-soft px-4 py-3">
        {property.actual_price_usd != null ? (
          <>
            <p className="text-[0.8125rem] text-ink-muted">
              Recorded sale · {formatSaleDate(property.sale_date)}
            </p>
            <p className="mt-0.5 text-lg font-semibold text-ink tabular">{formatUsd(property.actual_price_usd)}</p>
            <p className="text-[0.8125rem] text-ink-muted">A historical sale record, not an estimate.</p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">No recorded sale price is available for this example.</p>
        )}
      </div>
    </div>
  )
}

function PropertySummarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading property">
      <Skeleton className="h-7 w-48" />
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-[5.25rem] w-full" />
    </div>
  )
}

type EstimateProps = {
  loading: boolean
  error: unknown
  onRetry: () => void
  valuationYear: number | null
  result: ModelResult | undefined
  model: ModelInfo | undefined
}

function EstimateCard({ loading, error, onRetry, valuationYear, result, model }: EstimateProps) {
  let body
  if (error) {
    const e = describeError(error)
    body = (
      <Notice tone="neutral" title="Estimate unavailable" onRetry={e.retryable ? onRetry : undefined} className="mt-3">
        The preview estimate couldn’t be loaded. You can request one from the explorer.
      </Notice>
    )
  } else if (loading || !result) {
    body = (
      <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading estimate">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-4 w-56" />
      </div>
    )
  } else if (result.status !== 'success' || result.predicted_price_usd == null) {
    body = (
      <p className="mt-3 text-sm text-ink-muted">
        {result.message ?? 'The primary model did not return an estimate for this example.'}
      </p>
    )
  } else {
    body = (
      <>
        <p className="mt-2 font-display text-[2.5rem] leading-none font-medium tracking-[-0.02em] text-ink tabular">
          {formatUsd(result.predicted_price_usd)}
        </p>
        {valuationYear != null && (
          <p className="mt-2.5 text-sm text-ink-muted">Valued in the {valuationYear} market.</p>
        )}
      </>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-canvas/60 p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-ink">Estimated historical value</p>
        {model && <ModelTag model={model} />}
      </div>
      {body}
    </div>
  )
}
