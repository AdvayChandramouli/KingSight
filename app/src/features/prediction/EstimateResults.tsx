import { HistoricalLabel } from '@/components/brand'
import { Notice } from '@/components/ui/Notice'
import { Skeleton, Spinner } from '@/components/ui/Skeleton'
import type { EstimateWorkflow } from '@/features/property/useEstimateWorkflow'
import type { Metadata } from '@/services/types'
import { ModelComparison, SecondaryModelAlerts } from './ModelComparison'
import { PrimaryEstimateCard } from './PrimaryEstimateCard'
import { SensitivityComparison } from './SensitivityComparison'
import { StaleFrame } from './StaleFrame'
import { fieldLabel, modelName } from './modelDisplay'
import type { PredictionView } from './usePredictionView'

type Props = { workflow: EstimateWorkflow; metadata: Metadata }

export function EstimateResults({ workflow, metadata }: Props) {
  const view = workflow.current
  if (!view) return null
  const stale = workflow.isStale

  return (
    <section aria-label="Estimate results" className="space-y-4">
      <StaleFrame
        stale={stale}
        message="These results are for your previous inputs. Update the estimate to see results for your changes."
      >
        {view.status === 'pending' ? (
          <PendingEstimate />
        ) : view.status === 'error' ? (
          <RequestError view={view} metadata={metadata} stale={stale} />
        ) : (
          <div className="space-y-4">
            <PrimaryEstimateCard workflow={workflow} view={view} metadata={metadata} stale={stale} />
            <SecondaryModelAlerts view={view} metadata={metadata} stale={stale} />
            {workflow.original && (
              <SensitivityComparison original={workflow.original} updated={view} metadata={metadata} stale={stale} />
            )}
            <ModelComparison view={view} metadata={metadata} stale={stale} />
          </div>
        )}
      </StaleFrame>
    </section>
  )
}

function PendingEstimate() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-soft sm:p-6" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl text-ink">Estimated historical value</h3>
        <span className="text-sm font-medium text-ink-muted">
          <Spinner label="Estimating…" />
        </span>
      </div>
      <Skeleton className="mt-3 h-12 w-56 max-w-full" />
      <div className="mt-4 flex flex-wrap gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-48" />
      </div>
      <HistoricalLabel className="mt-4" />
    </div>
  )
}

function RequestError({ view, metadata, stale }: { view: PredictionView; metadata: Metadata; stale: boolean }) {
  const error = view.error
  const outOfCoverage = error?.code === 'out_of_coverage'
  const fieldErrors = error?.fieldErrors ? Object.entries(error.fieldErrors) : []
  const canRetry = !stale && !outOfCoverage && (error?.retryable ?? true)

  return (
    <Notice
      tone="error"
      role="alert"
      title={error?.title ?? 'Estimate unavailable'}
      onRetry={canRetry ? view.retry : undefined}
    >
      {outOfCoverage ? (
        <p>
          This location is outside the area the models cover ({metadata.coverage.label}). Choose a location inside the
          coverage area — on the map or with the latitude and longitude fields — then request the estimate again.
        </p>
      ) : (
        <p>{error?.message ?? `The ${modelName(metadata, metadata.primary_model_id)} could not be reached.`}</p>
      )}
      {fieldErrors.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {fieldErrors.map(([key, message]) => (
            <li key={key}>
              <strong>{fieldLabel(metadata, key)}:</strong> {message}
            </li>
          ))}
        </ul>
      )}
      {canRetry && <p className="mt-1">Your inputs are kept; trying again sends the same details.</p>}
    </Notice>
  )
}
