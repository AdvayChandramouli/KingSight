import { ArrowRight, RotateCcw } from 'lucide-react'
import { ModelTag } from '@/components/brand'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Skeleton } from '@/components/ui/Skeleton'
import { ATTRIBUTE_ORDER } from '@/features/property/attributeSchema'
import { formatSignedUsd, formatUsd } from '@/lib/format'
import type { Metadata } from '@/services/types'
import { fieldLabel, findModel, formatFeatureValue, modelName, orderedOutcomes } from './modelDisplay'
import type { ModelOutcome, PredictionView } from './usePredictionView'

export const SENSITIVITY_LABEL =
  'Original vs. your changes: how each model responds to the changed details, not what a renovation would be worth'

type Props = {
  original: PredictionView
  updated: PredictionView
  metadata: Metadata
  stale: boolean
}

/** Original vs. updated estimate for the same model and version. */
export function SensitivityComparison({ original, updated, metadata, stale }: Props) {
  const changed = ATTRIBUTE_ORDER.filter(
    (key) => !Object.is(original.request.attributes[key], updated.request.attributes[key]),
  )

  return (
    <section aria-labelledby="sensitivity-heading" className="rounded-xl border border-border bg-surface p-5">
      <h3 id="sensitivity-heading" className="font-display text-lg text-ink">
        Sensitivity exploration
      </h3>
      <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">{SENSITIVITY_LABEL}.</p>

      {changed.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-ink">Changed attributes</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {changed.map((key) => (
              <li
                key={key}
                className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-sand-soft px-3 py-1 text-[0.8125rem] text-ink"
              >
                <span className="font-medium">{fieldLabel(metadata, key)}</span>
                <span className="text-ink-muted tabular">
                  {formatFeatureValue(key, original.request.attributes[key])}
                </span>
                <ArrowRight aria-label="changed to" className="size-3.5 text-ink-muted" />
                <span className="font-medium tabular">{formatFeatureValue(key, updated.request.attributes[key])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {original.status === 'error' && original.error ? (
        <Notice
          tone="error"
          className="mt-4"
          title="Original estimate unavailable"
          onRetry={original.error.retryable && !stale ? original.retry : undefined}
        >
          {original.error.message} The comparison needs the original estimate.
        </Notice>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {orderedOutcomes(updated, metadata).map((u) => (
            <li key={u.modelId} className="py-3 first:pt-0 last:pb-0">
              <ModelRow
                updated={u}
                original={original.outcomes.find((o) => o.modelId === u.modelId)}
                metadata={metadata}
                stale={stale}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ModelRow({
  updated,
  original,
  metadata,
  stale,
}: {
  updated: ModelOutcome
  original: ModelOutcome | undefined
  metadata: Metadata
  stale: boolean
}) {
  const model = findModel(metadata, updated.modelId)
  const header = model ? <ModelTag model={model} /> : <span className="text-sm font-semibold">{updated.modelId}</span>

  if (updated.state === 'pending' || original?.state === 'pending') {
    return (
      <div>
        {header}
        <Skeleton className="mt-2 h-10 w-full" />
      </div>
    )
  }

  const before = original?.state === 'success' ? original.result : null
  const after = updated.state === 'success' ? updated.result : null

  if (!before || !after || before.predicted_price_usd == null || after.predicted_price_usd == null) {
    const missing = !before ? 'original' : 'updated'
    const retry = !before ? original : updated
    return (
      <div>
        {header}
        <p className="mt-1 text-sm text-ink-muted">
          Not compared: the {missing} estimate from the {modelName(metadata, updated.modelId)} is unavailable.
        </p>
        {retry?.retryable && !stale && (
          <Button size="md" variant="quiet" className="mt-1 -ml-3" onClick={retry.retry}>
            <RotateCcw aria-hidden className="size-4" />
            Retry {missing} estimate
          </Button>
        )}
      </div>
    )
  }

  if (before.version !== after.version) {
    return (
      <div>
        {header}
        <p className="mt-1 text-sm text-ink-muted">
          Not compared: the original ({before.version}) and updated ({after.version}) estimates came from different
          model versions, so the difference wouldn’t reflect your changes alone.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {header}
        <span className="text-[0.8125rem] text-ink-muted">
          {model?.display_name ?? updated.modelId} · {after.version}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-ink-muted">Original</dt>
          <dd className="mt-0.5 font-medium text-ink tabular">{formatUsd(before.predicted_price_usd)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Updated</dt>
          <dd className="mt-0.5 font-medium text-ink tabular">{formatUsd(after.predicted_price_usd)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Difference</dt>
          <dd className="mt-0.5 font-semibold text-ink tabular">
            {formatSignedUsd(after.predicted_price_usd - before.predicted_price_usd)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
