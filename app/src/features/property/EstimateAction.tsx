import { Calculator, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Skeleton'
import type { EstimateWorkflow } from './useEstimateWorkflow'

type Props = {
  workflow: EstimateWorkflow
  /** Label before any estimate exists for this target. */
  firstLabel?: string
}

/**
 * Explicit submit: inference never runs on keystroke. An invalid form keeps
 * the button focusable (aria-disabled) so pressing it focuses the first
 * invalid field instead of silently doing nothing.
 */
export function EstimateAction({ workflow, firstLabel = 'Estimate this property' }: Props) {
  const { current, isStale, isSubmitting, form } = workflow
  const invalid = !form.formState.isValid
  const upToDate = current != null && !isStale && current.status === 'success'
  // A failed request offers "Try again" with the same snapshot in its notice.
  const failedCurrent = current != null && !isStale && current.status === 'error'
  const label = current == null ? firstLabel : 'Update estimate'

  return (
    <div className={failedCurrent ? undefined : 'space-y-2'}>
      {failedCurrent ? null : upToDate ? (
        <p className="flex min-h-11 items-center gap-2 text-sm text-ink-muted">
          <CheckCircle2 aria-hidden className="size-4 text-evergreen" />
          The results below match these details.
        </p>
      ) : (
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isSubmitting}
          aria-disabled={invalid || undefined}
        >
          {isSubmitting ? (
            <Spinner className="text-white" label="Estimating…" />
          ) : (
            <>
              <Calculator aria-hidden className="size-4" />
              {label}
            </>
          )}
        </Button>
      )}
      {invalid && !upToDate && !failedCurrent && (
        <p className="text-[0.8125rem] text-ink-muted">Fix the highlighted details to request an estimate.</p>
      )}
      <EstimateLiveRegion workflow={workflow} />
    </div>
  )
}

function EstimateLiveRegion({ workflow }: { workflow: EstimateWorkflow }) {
  const { current, isStale } = workflow
  let message = ''
  if (current && !isStale) {
    if (current.status === 'pending') message = 'Estimating…'
    else if (current.status === 'error') message = 'The estimate could not be completed.'
    else {
      const ok = current.outcomes.filter((o) => o.state === 'success').length
      const pending = current.outcomes.some((o) => o.state === 'pending')
      message = pending
        ? 'Estimating…'
        : ok === current.outcomes.length
          ? 'Estimate ready.'
          : ok > 0
            ? 'Estimate ready. One model was unavailable.'
            : 'No model could produce an estimate.'
    }
  } else if (current && isStale) {
    message = 'Details changed. The previous estimate is out of date.'
  }
  return (
    <output aria-live="polite" className="sr-only">
      {message}
    </output>
  )
}
