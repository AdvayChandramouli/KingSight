import { AlertTriangle, OctagonAlert, PencilLine } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { InfoTip } from '@/components/ui/InfoTip'
import { cn } from '@/components/ui/cn'
import { fieldLabel, formatFeatureValue } from '@/features/prediction/modelDisplay'
import type { AttributeKey, FieldConstraint, Metadata } from '@/services/types'
import type { EstimateWorkflow } from './useEstimateWorkflow'
import { ATTRIBUTE_ORDER } from './attributeSchema'

export const inputClasses =
  'tabular h-11 w-full rounded-md border border-control/70 bg-surface px-3 text-base text-ink transition-colors duration-150 placeholder:text-ink-muted/80 hover:border-ink-muted focus-visible:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-1 aria-invalid:border-danger aria-invalid:bg-danger-soft/40'

const UNIT_SUFFIX: Partial<Record<AttributeKey, string>> = { sqft_living: 'sq ft' }

type Props = {
  workflow: EstimateWorkflow
  metadata: Metadata
  /** Field errors returned by the server for the submitted snapshot. */
  serverErrors?: Record<string, string> | null
  /** Show "was …" indicators against the original record. */
  showChanges?: boolean
}

/** The seven editable attributes, validated from metadata constraints. */
export function AttributeFields({ workflow, metadata, serverErrors, showChanges = false }: Props) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 min-[420px]:grid-cols-2">
      {ATTRIBUTE_ORDER.map((key) =>
        key === 'waterfront' ? (
          <WaterfrontField
            key={key}
            workflow={workflow}
            metadata={metadata}
            showChanges={showChanges}
          />
        ) : (
          <NumberField
            key={key}
            fieldKey={key}
            workflow={workflow}
            metadata={metadata}
            serverError={serverErrors?.[key] ?? null}
            showChanges={showChanges}
          />
        ),
      )}
    </div>
  )
}

function constraintFor(metadata: Metadata, key: AttributeKey): FieldConstraint | undefined {
  return metadata.fields.find((f) => f.key === key)
}

function NumberField({
  fieldKey,
  workflow,
  metadata,
  serverError,
  showChanges,
}: {
  fieldKey: Exclude<AttributeKey, 'waterfront'>
  workflow: EstimateWorkflow
  metadata: Metadata
  serverError: string | null
  showChanges: boolean
}) {
  const id = useId()
  const { form, warnings, changedFields, originalValues, valuationYear } = workflow
  const constraint = constraintFor(metadata, fieldKey)
  const label = fieldLabel(metadata, fieldKey)
  const error = form.formState.errors[fieldKey]?.message ?? serverError
  const changed = showChanges && changedFields.has(fieldKey)
  const warning = warnings[fieldKey]
  const isInteger = constraint?.kind === 'integer' || fieldKey !== 'bathrooms'
  const step = fieldKey === 'bathrooms' ? (constraint?.step ?? 0.25) : (constraint?.step ?? 1)
  const max = fieldKey === 'yr_built' ? valuationYear : constraint?.max
  const suffix = UNIT_SUFFIX[fieldKey]

  const ids = {
    hint: `${id}-hint`,
    error: `${id}-error`,
    warning: `${id}-warning`,
    changed: `${id}-changed`,
  }
  const hint = rangeHint(constraint, max, fieldKey)
  const describedBy = [
    error && ids.error,
    changed && ids.changed,
    warning && ids.warning,
    hint && ids.hint,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="min-w-0">
      <div className="flex min-h-6 items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {constraint?.help && <InfoTip label={label}>{constraint.help}</InfoTip>}
      </div>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="number"
          inputMode={isInteger ? 'numeric' : 'decimal'}
          step={step}
          min={constraint?.min}
          max={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(inputClasses, suffix && 'pr-14', changed && 'border-deep-blue')}
          {...form.register(fieldKey, { valueAsNumber: true })}
        />
        {suffix && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted"
          >
            {suffix}
          </span>
        )}
      </div>
      <FieldMessages
        ids={ids}
        error={error}
        warning={warning}
        hint={hint}
        changed={changed ? `was ${formatFeatureValue(fieldKey, originalValues[fieldKey])}` : null}
      />
    </div>
  )
}

function WaterfrontField({
  workflow,
  metadata,
  showChanges,
}: {
  workflow: EstimateWorkflow
  metadata: Metadata
  showChanges: boolean
}) {
  const id = useId()
  const { form, values, changedFields, originalValues } = workflow
  const label = fieldLabel(metadata, 'waterfront')
  const help = constraintFor(metadata, 'waterfront')?.help
  const changed = showChanges && changedFields.has('waterfront')
  const ids = { hint: `${id}-hint`, error: `${id}-error`, warning: `${id}-warning`, changed: `${id}-changed` }

  const choose = (next: boolean) =>
    form.setValue('waterfront', next, { shouldDirty: true, shouldValidate: true })

  return (
    <div className="min-w-0 min-[420px]:col-span-2">
      <div className="flex min-h-6 items-center gap-1.5">
        <span id={`${id}-label`} className="text-sm font-medium text-ink">
          {label}
        </span>
        {help && <InfoTip label={label}>{help}</InfoTip>}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={changed ? ids.changed : undefined}
        className="mt-1.5 flex gap-2"
      >
        {[
          { value: true, text: 'Yes' },
          { value: false, text: 'No' },
        ].map((option) => (
          <label
            key={option.text}
            className={cn(
              'relative inline-flex min-h-11 min-w-24 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-[0.95rem] font-medium transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-evergreen',
              values.waterfront === option.value
                ? 'border-evergreen bg-evergreen-soft text-ink'
                : 'border-control/60 bg-surface text-ink-muted hover:border-ink-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={`${id}-waterfront`}
              className="sr-only"
              checked={values.waterfront === option.value}
              onChange={() => choose(option.value)}
            />
            <span
              aria-hidden
              className={cn(
                'size-3.5 rounded-full border-2',
                values.waterfront === option.value ? 'border-evergreen bg-evergreen ring-2 ring-surface ring-inset' : 'border-control',
              )}
            />
            {option.text}
          </label>
        ))}
      </div>
      <FieldMessages
        ids={ids}
        changed={changed ? `was ${formatFeatureValue('waterfront', originalValues.waterfront)}` : null}
      />
    </div>
  )
}

export function FieldMessages({
  ids,
  error,
  warning,
  hint,
  changed,
}: {
  ids: { hint: string; error: string; warning: string; changed: string }
  error?: string | null
  warning?: string | null
  hint?: string | null
  changed?: string | null
}) {
  if (!error && !warning && !hint && !changed) return null
  return (
    <div className="mt-1.5 space-y-1 text-[0.8125rem] leading-snug">
      {error && (
        <Message id={ids.error} icon={<OctagonAlert aria-hidden className="size-3.5" />} className="font-medium text-danger">
          {error}
        </Message>
      )}
      {changed && (
        <Message id={ids.changed} icon={<PencilLine aria-hidden className="size-3.5" />} className="text-deep-blue">
          <span className="font-semibold">Changed</span> · {changed}
        </Message>
      )}
      {warning && (
        <Message id={ids.warning} icon={<AlertTriangle aria-hidden className="size-3.5" />} className="text-warning">
          {warning}
        </Message>
      )}
      {hint && !error && (
        <p id={ids.hint} className="text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

function Message({ id, icon, className, children }: { id: string; icon: ReactNode; className: string; children: ReactNode }) {
  return (
    <p id={id} className={cn('flex gap-1.5', className)}>
      <span className="mt-[0.2rem] shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

function rangeHint(constraint: FieldConstraint | undefined, max: number | undefined, key: AttributeKey): string | null {
  if (key === 'bathrooms') return 'Quarter steps, e.g. 2.25'
  if (key === 'sqft_living') return null
  if (constraint?.min != null && max != null) return `${constraint.min}–${max}`
  return null
}
