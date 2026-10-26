import { Info } from 'lucide-react'
import { useId, useState } from 'react'
import { ModelTag } from '@/components/brand'
import { modelFamilyStyle } from '@/components/modelFamilyStyle'
import { Notice } from '@/components/ui/Notice'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import type { EstimateWorkflow } from '@/features/property/useEstimateWorkflow'
import { formatUsd } from '@/lib/format'
import { describeError } from '@/services/client'
import { useExplanation } from '@/services/queries'
import type { Explanation, Metadata, ModelInfo } from '@/services/types'
import { ContributionChart } from './ContributionChart'
import { StaleFrame } from './StaleFrame'
import { findModel, shortModelName } from './modelDisplay'
import type { ModelOutcome, PredictionView } from './usePredictionView'

type Props = { workflow: EstimateWorkflow; metadata: Metadata }

export function ExplanationSection({ workflow, metadata }: Props) {
  const view = workflow.current
  if (!view || view.status === 'error') return null
  return <ExplanationBody view={view} stale={workflow.isStale} metadata={metadata} />
}

type Eligible = { outcome: ModelOutcome; model: ModelInfo }

function ExplanationBody({ view, stale, metadata }: { view: PredictionView; stale: boolean; metadata: Metadata }) {
  const headingId = useId()
  const [selected, setSelected] = useState<string | null>(null)

  const eligible: Eligible[] = []
  for (const outcome of view.outcomes) {
    const model = findModel(metadata, outcome.modelId)
    if (model?.explanation_available && outcome.state === 'success' && outcome.predictionId) {
      eligible.push({ outcome, model })
    }
  }
  eligible.sort((a, b) => Number(b.model.id === metadata.primary_model_id) - Number(a.model.id === metadata.primary_model_id))

  const active = eligible.find((e) => e.model.id === selected) ?? eligible[0] ?? null
  const query = useExplanation(active?.outcome.predictionId ?? null, active?.model.id ?? null)
  const waitingForEstimate = view.status === 'pending' || (!active && view.outcomes.some((o) => o.state === 'pending'))

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-3">
        <h3 id={headingId} className="font-display text-xl text-ink">
          See what shaped the estimate
        </h3>
        <p className="max-w-[65ch] text-[0.95rem] text-ink-muted">
          These attributes pushed this model’s estimate higher or lower relative to its reference prediction.
        </p>
        {eligible.length > 1 && active ? (
          <SegmentedControl
            label="Model whose explanation is shown"
            className="flex w-full max-w-md"
            value={active.model.id}
            onChange={setSelected}
            options={eligible.map(({ model }) => {
              const Icon = modelFamilyStyle(model.family).icon
              return {
                value: model.id,
                ariaLabel: model.perspective_label,
                label: (
                  <>
                    <Icon aria-hidden className={cn('size-4', modelFamilyStyle(model.family).text)} />
                    {shortModelName(model)}
                  </>
                ),
              }
            })}
          />
        ) : (
          active && <ModelTag model={active.model} />
        )}
      </div>

      <StaleFrame stale={stale} message="This explanation belongs to your previous inputs.">
        {waitingForEstimate ? (
          <ChartSkeleton label="The explanation appears once the estimate is ready." />
        ) : !active ? (
          <Unavailable />
        ) : query.error ? (
          <Notice
            tone="error"
            title="Explanation couldn’t load"
            onRetry={stale ? undefined : () => void query.refetch()}
          >
            {describeError(query.error).message} The estimate above is unaffected.
          </Notice>
        ) : !query.data ? (
          <ChartSkeleton label="Loading explanation…" />
        ) : query.data.features.length === 0 ? (
          <Unavailable />
        ) : (
          <ExplanationDetail explanation={query.data} outcome={active.outcome} />
        )}
      </StaleFrame>
    </section>
  )
}

function ExplanationDetail({ explanation, outcome }: { explanation: Explanation; outcome: ModelOutcome }) {
  const usd = explanation.output_space === 'usd'
  const versionMismatch = outcome.result && outcome.result.version !== explanation.model_version

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className="font-semibold text-ink">
          {usd ? 'Contributions in US dollars' : 'Contributions in log-price units — not dollars'}
        </p>
        {explanation.reference_output != null && (
          <p className="text-ink-muted">
            Reference prediction:{' '}
            <span className="font-medium text-ink tabular">
              {usd ? formatUsd(explanation.reference_output) : `${explanation.reference_output.toFixed(3)} log-price`}
            </span>
            {!usd && Number.isFinite(explanation.reference_output) && (
              <span className="tabular"> (≈ {formatUsd(Math.exp(explanation.reference_output))})</span>
            )}
          </p>
        )}
      </div>
      {!usd && (
        <p className="text-[0.8125rem] text-ink-muted">
          Log-price contributions act roughly like percentages: +0.10 ≈ 10% higher than the reference.
        </p>
      )}
      {versionMismatch && (
        <Notice tone="warning">
          This explanation describes model version {explanation.model_version}, while the estimate came from version{' '}
          {outcome.result?.version}.
        </Notice>
      )}
      <ContributionChart features={explanation.features} space={explanation.output_space} />
      <p className="flex gap-2 text-[0.8125rem] text-ink-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Correlated attributes can share importance, so credit may be split between related details. Contributions
          describe how this model behaves, not causes or guaranteed price changes.
        </span>
      </p>
      {explanation.global_importance && explanation.global_importance.length > 0 && (
        <GlobalImportance items={explanation.global_importance} />
      )}
    </div>
  )
}

function GlobalImportance({ items }: { items: NonNullable<Explanation['global_importance']> }) {
  const sorted = [...items].sort((a, b) => b.importance - a.importance)
  const max = Math.max(...sorted.map((i) => Math.abs(i.importance)), Number.EPSILON)
  const fmt = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
  return (
    <div className="border-t border-border pt-4">
      <h4 className="text-sm font-semibold text-ink">Across evaluated homes</h4>
      <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
        How much each attribute matters to this model on average. This ranking isn’t specific to this home.
      </p>
      <ul className="mt-3 space-y-2">
        {sorted.map((item) => (
          <li key={item.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-ink">{item.label}</span>
            <span aria-hidden className="h-1.5 rounded-full bg-sand-soft">
              <span
                className="block h-full rounded-full bg-control"
                style={{ width: `${(Math.abs(item.importance) / max) * 100}%` }}
              />
            </span>
            <span className="text-ink-muted tabular">{fmt.format(item.importance)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Unavailable() {
  return (
    <p className="rounded-md bg-sand-soft px-4 py-3 text-sm text-ink-muted">
      Feature explanation unavailable for this estimate
    </p>
  )
}

function ChartSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-5" aria-busy="true">
      <p className="text-sm text-ink-muted">{label}</p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-2.5 w-full" />
        </div>
      ))}
    </div>
  )
}
