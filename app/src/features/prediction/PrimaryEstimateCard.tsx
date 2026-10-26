import { FlaskConical, RotateCcw } from 'lucide-react'
import { useId } from 'react'
import { HistoricalLabel, ModelTag } from '@/components/brand'
import { Button } from '@/components/ui/Button'
import { Skeleton, Spinner } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import type { EstimateWorkflow } from '@/features/property/useEstimateWorkflow'
import { formatSaleDate, formatSignedUsd, formatUsd } from '@/lib/format'
import type { Metadata } from '@/services/types'
import {
  canCompareRecordedPrice,
  findModel,
  isMockEstimate,
  modelName,
  orderedOutcomes,
  primaryOutcomeOf,
} from './modelDisplay'
import type { PredictionView } from './usePredictionView'

type Props = {
  workflow: EstimateWorkflow
  view: PredictionView
  metadata: Metadata
  stale: boolean
}

export function PrimaryEstimateCard({ workflow, view, metadata, stale }: Props) {
  const primary = primaryOutcomeOf(view, metadata)
  const model = findModel(metadata, metadata.primary_model_id)
  const mock = isMockEstimate(view, metadata)
  const headingId = useId()

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-surface p-5 shadow-soft sm:p-6"
    >
      {primary?.state === 'success' && primary.result ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 id={headingId} className="font-display text-xl text-ink">
              Estimated historical value
            </h3>
            {mock && <IllustrativeChip />}
          </div>
          <p
            data-testid="primary-estimate-value"
            className={cn(
              'mt-2 font-display text-[2.75rem] leading-none font-medium tracking-[-0.02em] tabular sm:text-[3.25rem]',
              stale ? 'text-ink-muted' : 'text-ink',
            )}
          >
            {formatUsd(primary.result.predicted_price_usd)}
          </p>
          {primary.result.interval && (
            <p className="mt-3 text-sm text-ink-muted">
              <span className="font-medium text-ink">{primary.result.interval.label}:</span>{' '}
              <span className="tabular">
                {formatUsd(primary.result.interval.lower_usd)} – {formatUsd(primary.result.interval.upper_usd)}
              </span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {model && <ModelTag model={{ ...model, version: primary.result.version }} showVersion />}
            <HistoricalLabel />
          </div>
          <p className="mt-2 text-sm text-ink-muted">{sourceLine(workflow, view)}</p>
          <RecordedPriceComparison workflow={workflow} predicted={primary.result.predicted_price_usd} />
        </>
      ) : primary?.state === 'pending' ? (
        <>
          <h3 id={headingId} className="font-display text-xl text-ink">
            Estimated historical value
          </h3>
          <div className="mt-3 text-sm text-ink-muted">
            <Spinner label={`Estimating with the ${modelName(metadata, metadata.primary_model_id)}…`} />
          </div>
          <Skeleton className="mt-3 h-12 w-56" />
          <HistoricalLabel className="mt-4" />
        </>
      ) : (
        <PrimaryUnavailable view={view} metadata={metadata} stale={stale} headingId={headingId} />
      )}
    </article>
  )
}

function IllustrativeChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-clay/40 bg-clay-soft px-2.5 py-0.5 text-[0.8125rem] font-medium text-clay-ink">
      <FlaskConical aria-hidden className="size-3.5" />
      Illustrative demo estimate
    </span>
  )
}

function sourceLine(workflow: EstimateWorkflow, view: PredictionView): string {
  const { source } = view.request
  if (source === 'hypothetical' || workflow.target.kind !== 'existing') {
    return 'For the hypothetical property you described.'
  }
  const id = workflow.target.property.id
  if (source === 'edited') return `For your edited version of Property ${id}.`
  return `For Property ${id} as recorded.`
}

function RecordedPriceComparison({ workflow, predicted }: { workflow: EstimateWorkflow; predicted: number | null }) {
  if (!canCompareRecordedPrice(workflow) || workflow.target.kind !== 'existing') return null
  const property = workflow.target.property
  const actual = property.actual_price_usd

  if (actual == null || predicted == null) {
    return (
      <p className="mt-5 rounded-md bg-sand-soft px-4 py-3 text-sm text-ink-muted">
        Recorded sale price unavailable — no comparison
      </p>
    )
  }

  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-sand-soft px-4 py-3 text-sm">
      <div>
        <dt className="text-ink-muted">Recorded sale price</dt>
        <dd className="mt-0.5 font-semibold text-ink tabular">{formatUsd(actual)}</dd>
        {property.sale_date && <dd className="text-[0.8125rem] text-ink-muted">{formatSaleDate(property.sale_date)}</dd>}
      </div>
      <div>
        <dt className="text-ink-muted">Estimate − recorded sale price</dt>
        <dd className="mt-0.5 font-semibold text-ink tabular">{formatSignedUsd(predicted - actual)}</dd>
      </div>
    </dl>
  )
}

function PrimaryUnavailable({
  view,
  metadata,
  stale,
  headingId,
}: {
  view: PredictionView
  metadata: Metadata
  stale: boolean
  headingId: string
}) {
  const primary = primaryOutcomeOf(view, metadata)
  const name = modelName(metadata, metadata.primary_model_id)
  const alternatives = orderedOutcomes(view, metadata).filter(
    (o) => o.modelId !== metadata.primary_model_id && o.state === 'success' && o.result,
  )

  return (
    <>
      <h3 id={headingId} className="font-display text-xl text-ink">
        Primary estimate unavailable
      </h3>
      <p className="mt-2 text-[0.95rem] text-ink-muted">
        The {name} couldn’t produce an estimate for this request.
        {primary?.message ? ` ${primary.message}` : ''}
      </p>
      {primary?.retryable && !stale && (
        <Button variant="secondary" className="mt-4" onClick={primary.retry}>
          <RotateCcw aria-hidden className="size-4" />
          Retry {name}
        </Button>
      )}
      {alternatives.map((alt) => {
        const altModel = findModel(metadata, alt.modelId)
        return (
          <div key={alt.modelId} className="mt-5 rounded-md bg-sand-soft px-4 py-3">
            {altModel && <ModelTag model={altModel} />}
            <p className="mt-1 font-display text-2xl text-ink tabular">{formatUsd(alt.result?.predicted_price_usd)}</p>
            <p className="mt-1 text-sm text-ink-muted">
              This is the {modelName(metadata, alt.modelId)}’s estimate, not the primary estimate. Open Compare
              models to see each model separately.
            </p>
          </div>
        )
      })}
      <HistoricalLabel className="mt-4" />
    </>
  )
}
