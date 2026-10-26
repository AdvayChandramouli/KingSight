import { AlertTriangle, RotateCcw } from 'lucide-react'
import { ModelTag } from '@/components/brand'
import { Disclosure } from '@/components/ui/Accordion'
import { Button } from '@/components/ui/Button'
import { Skeleton, Spinner } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { formatSignedUsd, formatUsd } from '@/lib/format'
import type { Metadata } from '@/services/types'
import { findModel, modelName, orderedOutcomes, shortModelName } from './modelDisplay'
import type { ModelOutcome, PredictionView } from './usePredictionView'

type Props = { view: PredictionView; metadata: Metadata; stale: boolean }

export function ModelComparison({ view, metadata, stale }: Props) {
  const outcomes = orderedOutcomes(view, metadata)
  const primary = outcomes.find((o) => o.modelId === metadata.primary_model_id)
  const differences =
    primary?.state === 'success' && primary.result?.predicted_price_usd != null
      ? outcomes
          .filter((o) => o !== primary && o.state === 'success' && o.result?.predicted_price_usd != null)
          .map((o) => ({
            modelId: o.modelId,
            value: (o.result?.predicted_price_usd ?? 0) - (primary.result?.predicted_price_usd ?? 0),
          }))
      : []
  const primaryShort = shortModelName(findModel(metadata, metadata.primary_model_id), metadata.primary_model_id)

  return (
    <Disclosure
      title="Compare models"
      subtitle="Each model’s estimate, side by side"
      value="compare-models"
    >
      <div className="@container space-y-4">
        <p className="max-w-[65ch] text-sm text-ink-muted">
          The two models read this home differently, so their estimates can differ. Comparing them shows how each
          model behaves; a difference is not a measure of which one is right.
        </p>
        <ul className="grid gap-3 @md:grid-cols-2">
          {outcomes.map((o) => (
            <li key={o.modelId}>
              <ModelOutcomeCard
                outcome={o}
                metadata={metadata}
                isPrimary={o.modelId === metadata.primary_model_id}
                stale={stale}
              />
            </li>
          ))}
        </ul>
        {differences.length > 0 && (
          <dl className="space-y-1 rounded-md bg-sand-soft px-4 py-3 text-sm">
            {differences.map((d) => (
              <div key={d.modelId} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt className="text-ink-muted">
                  {shortModelName(findModel(metadata, d.modelId), d.modelId)} − {primaryShort}
                </dt>
                <dd className="font-semibold text-ink tabular">{formatSignedUsd(d.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Disclosure>
  )
}

function ModelOutcomeCard({
  outcome,
  metadata,
  isPrimary,
  stale,
}: {
  outcome: ModelOutcome
  metadata: Metadata
  isPrimary: boolean
  stale: boolean
}) {
  const model = findModel(metadata, outcome.modelId)
  const version = outcome.result?.version ?? model?.version
  return (
    <article
      aria-label={modelName(metadata, outcome.modelId)}
      className={cn(
        'flex h-full flex-col rounded-lg border bg-surface p-4',
        outcome.state === 'success' || outcome.state === 'pending' ? 'border-border' : 'border-danger/30',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {model ? <ModelTag model={model} /> : <span className="text-sm font-semibold text-ink">{outcome.modelId}</span>}
        {isPrimary && (
          <span className="rounded-full bg-evergreen-soft px-2 py-0.5 text-[0.8125rem] font-medium text-evergreen">
            Primary
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
        {model?.display_name ?? outcome.modelId}
        {version ? ` · ${version}` : ''}
      </p>
      <div className="mt-3 flex-1">
        {outcome.state === 'success' && outcome.result ? (
          <p className="font-display text-[1.75rem] leading-tight text-ink tabular">
            {formatUsd(outcome.result.predicted_price_usd)}
          </p>
        ) : outcome.state === 'pending' ? (
          <div className="space-y-2 text-sm text-ink-muted">
            <Spinner label="Estimating…" />
            <Skeleton className="h-8 w-36" />
          </div>
        ) : (
          <OutcomeFailure outcome={outcome} metadata={metadata} stale={stale} />
        )}
      </div>
    </article>
  )
}

function OutcomeFailure({ outcome, metadata, stale }: { outcome: ModelOutcome; metadata: Metadata; stale: boolean }) {
  return (
    <div className="text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-ink">
        <AlertTriangle aria-hidden className="size-4 text-danger" />
        {outcome.state === 'unavailable' ? 'Estimate unavailable' : 'Estimate failed'}
      </p>
      {outcome.message && <p className="mt-1 text-ink-muted">{outcome.message}</p>}
      {outcome.retryable && !stale && (
        <Button size="md" variant="secondary" className="mt-3" onClick={outcome.retry}>
          <RotateCcw aria-hidden className="size-4" />
          Retry {modelName(metadata, outcome.modelId)}
        </Button>
      )}
    </div>
  )
}

/**
 * Failed secondary models stay visible outside the collapsed comparison so a
 * partial result never hides the failure or its retry.
 */
export function SecondaryModelAlerts({ view, metadata, stale }: Props) {
  const failed = orderedOutcomes(view, metadata).filter(
    (o) => o.modelId !== metadata.primary_model_id && (o.state === 'error' || o.state === 'unavailable'),
  )
  const pending = orderedOutcomes(view, metadata).filter(
    (o) => o.modelId !== metadata.primary_model_id && o.state === 'pending',
  )
  if (failed.length === 0 && pending.length === 0) return null

  return (
    <ul className="space-y-2">
      {failed.map((o) => {
        const model = findModel(metadata, o.modelId)
        return (
          <li key={o.modelId}>
            <article
              aria-label={`${modelName(metadata, o.modelId)} estimate unavailable`}
              className="rounded-lg border border-danger/30 bg-danger-soft/60 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {model ? <ModelTag model={model} /> : <span className="text-sm font-semibold text-ink">{o.modelId}</span>}
                <span className="text-sm font-semibold text-ink">
                  · {o.state === 'unavailable' ? 'estimate unavailable' : 'estimate failed'}
                </span>
              </div>
              {o.message && <p className="mt-1 text-sm text-ink-muted">{o.message}</p>}
              {o.retryable && !stale && (
                <Button size="md" variant="secondary" className="mt-2.5" onClick={o.retry}>
                  <RotateCcw aria-hidden className="size-4" />
                  Retry {modelName(metadata, o.modelId)}
                </Button>
              )}
            </article>
          </li>
        )
      })}
      {pending.map((o) => (
        <li key={o.modelId} className="rounded-lg border border-border px-4 py-3 text-sm text-ink-muted">
          <Spinner label={`Estimating with the ${modelName(metadata, o.modelId)}…`} />
        </li>
      ))}
    </ul>
  )
}
