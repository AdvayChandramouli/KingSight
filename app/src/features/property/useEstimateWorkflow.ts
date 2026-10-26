import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { usePredictionView, type PredictionView } from '@/features/prediction/usePredictionView'
import { attributesEqual, toPredictRequest } from '@/services/fingerprint'
import type {
  AttributeKey,
  Metadata,
  PredictInput,
  PredictRequest,
  PropertyDetail,
} from '@/services/types'
import type { LngLat, RememberedSession } from '@/features/explorer/explorerState'
import {
  ATTRIBUTE_ORDER,
  ILLUSTRATIVE_DEFAULTS,
  attributesOf,
  buildFormSchema,
  trainingRangeWarnings,
  type EstimateFormValues,
} from './attributeSchema'

export type EstimateTarget =
  | { kind: 'existing'; property: PropertyDetail }
  | { kind: 'hypothetical'; initialLocation: LngLat | null }

export type EstimateWorkflow = {
  target: EstimateTarget
  form: UseFormReturn<EstimateFormValues>
  values: EstimateFormValues
  /** Original values: the dataset record, or the illustrative defaults. */
  originalValues: EstimateFormValues
  valuationYear: number
  /** Fields that differ from the original record (existing properties only). */
  changedFields: Set<AttributeKey>
  warnings: Partial<Record<AttributeKey, string>>
  /** The current inputs differ from the last submitted snapshot. */
  isStale: boolean
  /** Inputs not yet submitted (drives the navigation confirmation). */
  hasUnsavedChanges: boolean
  isSubmitting: boolean
  /** Submits current inputs; invalid input focuses the first invalid field. */
  submit: () => Promise<void>
  /** Restores the exact original attributes and, if available, its estimate. */
  resetChanges: () => void
  /** Latest submitted snapshot's results. */
  current: PredictionView | null
  /** Unchanged original's results, present only when `current` is an edit. */
  original: PredictionView | null
  session: RememberedSession
}

type Options = {
  target: EstimateTarget
  metadata: Metadata
  remembered?: RememberedSession | null
}

/**
 * Owns the attribute form and the prediction snapshots for one target.
 * Mount it under a component keyed by the target so switching properties can
 * never let an older response overwrite the newer selection.
 */
export function useEstimateWorkflow({ target, metadata, remembered }: Options): EstimateWorkflow {
  const valuationYear =
    target.kind === 'existing' ? target.property.valuation_year : metadata.default_valuation_year

  const originalValues = useMemo<EstimateFormValues>(() => {
    if (target.kind === 'existing') {
      const p = target.property
      return { ...p.attributes, latitude: p.latitude, longitude: p.longitude }
    }
    return {
      ...ILLUSTRATIVE_DEFAULTS,
      latitude: target.initialLocation?.latitude ?? Number.NaN,
      longitude: target.initialLocation?.longitude ?? Number.NaN,
    }
    // The original is fixed for the life of this workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const schema = useMemo(() => buildFormSchema(metadata, valuationYear), [metadata, valuationYear])

  const initialValues = remembered?.submitted
    ? valuesFromRequest(remembered.submitted)
    : originalValues

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: initialValues,
    shouldFocusError: true,
  })
  const watched = useWatch({ control: form.control }) as EstimateFormValues
  const values = { ...initialValues, ...watched }

  useEffect(() => {
    void form.trigger()
  }, [form])

  const [submitted, setSubmitted] = useState<PredictRequest | null>(remembered?.submitted ?? null)
  const [original, setOriginal] = useState<PredictRequest | null>(remembered?.original ?? null)

  const modelIds = useMemo(() => metadata.models.map((m) => m.id), [metadata])

  const buildInput = (v: EstimateFormValues): PredictInput => {
    const attributes = attributesOf(v)
    if (target.kind === 'existing') {
      const p = target.property
      return {
        source: attributesEqual(attributes, p.attributes) ? 'existing' : 'edited',
        property_id: p.id,
        // Location is locked when editing an existing property.
        latitude: p.latitude,
        longitude: p.longitude,
        valuation_year: valuationYear,
        attributes,
        model_ids: modelIds,
      }
    }
    return {
      source: 'hypothetical',
      latitude: v.latitude,
      longitude: v.longitude,
      valuation_year: valuationYear,
      attributes,
      model_ids: modelIds,
    }
  }

  const originalRequest = useMemo(
    () => (target.kind === 'existing' ? toPredictRequest(buildInput(originalValues)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originalValues, modelIds],
  )

  const draftRequestId = safeRequestId(() => toPredictRequest(buildInput(values)))
  const isStale = submitted != null && draftRequestId !== submitted.client_request_id

  const changedFields = new Set<AttributeKey>()
  if (target.kind === 'existing') {
    for (const key of ATTRIBUTE_ORDER) {
      if (!Object.is(values[key], originalValues[key])) changedFields.add(key)
    }
  }

  const baseline = submitted ? valuesFromRequest(submitted) : originalValues
  const hasUnsavedChanges =
    !attributesEqual(attributesOf(values), attributesOf(baseline)) ||
    (target.kind === 'hypothetical' &&
      (!Object.is(values.latitude, baseline.latitude) || !Object.is(values.longitude, baseline.longitude)))

  const current = usePredictionView(submitted)
  const showOriginal = target.kind === 'existing' && submitted?.source === 'edited' ? original : null
  const originalView = usePredictionView(showOriginal)

  const isSubmitting = current?.status === 'pending' && !isStale

  const submit = async () => {
    if (isSubmitting) return
    await form.handleSubmit((v) => {
      const request = toPredictRequest(buildInput(v))
      setSubmitted(request)
      if (originalRequest) setOriginal(originalRequest)
    })()
  }

  const resetChanges = () => {
    form.reset(originalValues)
    void form.trigger()
    if (target.kind === 'existing' && original) setSubmitted(original)
  }

  return {
    target,
    form,
    values,
    originalValues,
    valuationYear,
    changedFields,
    warnings: trainingRangeWarnings(values, metadata.fields),
    isStale,
    hasUnsavedChanges,
    isSubmitting,
    submit,
    resetChanges,
    current,
    original: originalView,
    session: { submitted, original },
  }
}

export function valuesFromRequest(request: PredictRequest): EstimateFormValues {
  return { ...request.attributes, latitude: request.latitude, longitude: request.longitude }
}

function safeRequestId(build: () => PredictRequest): string | null {
  try {
    return build().client_request_id
  } catch {
    return null
  }
}
