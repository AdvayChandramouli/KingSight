import { ArrowLeft, MapPinned } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { useExplorer, type LngLat, type RememberedSession } from '@/features/explorer/explorerState'
import { pointInPolygon } from '@/lib/geo'
import { useProperty } from '@/services/queries'
import type { Metadata } from '@/services/types'
import { AttributeFields, FieldMessages, inputClasses } from './AttributeFields'
import { EstimateAction } from './EstimateAction'
import { WorkspaceResults } from './WorkspaceResults'
import { PanelLoading } from './PanelStates'
import { useEstimateWorkflow, type EstimateTarget, type EstimateWorkflow } from './useEstimateWorkflow'
import { useSessionSync } from './useSessionSync'

const TARGET_KEY = 'hypothetical'

/**
 * Decides the starting location once: a remembered session, else the
 * previously selected property's coordinates (labeled), else the last map draft.
 */
export function HypotheticalPanel({ metadata }: { metadata: Metadata }) {
  const { selectedId, draftLocation, recallSession } = useExplorer()
  const [remembered] = useState(() => recallSession(TARGET_KEY))
  const needsSource = !remembered && Boolean(selectedId)
  const source = useProperty(needsSource ? selectedId : null)

  if (needsSource && source.isPending) return <PanelLoading label="Preparing a new property…" />

  const fromProperty = needsSource && source.data ? source.data : null
  const initialLocation: LngLat | null = fromProperty
    ? { latitude: fromProperty.latitude, longitude: fromProperty.longitude }
    : draftLocation

  return (
    <HypotheticalWorkspace
      metadata={metadata}
      remembered={remembered}
      initialLocation={initialLocation}
      startedFromId={fromProperty?.id ?? null}
    />
  )
}

function HypotheticalWorkspace({
  metadata,
  remembered,
  initialLocation,
  startedFromId,
}: {
  metadata: Metadata
  remembered: RememberedSession | null
  initialLocation: LngLat | null
  startedFromId: string | null
}) {
  const { setMode } = useExplorer()
  // The starting point is fixed for this workflow's lifetime.
  const [start] = useState(() => ({ location: initialLocation, fromId: startedFromId }))
  const target = useMemo<EstimateTarget>(
    () => ({ kind: 'hypothetical', initialLocation: start.location }),
    [start],
  )
  const workflow = useEstimateWorkflow({ target, metadata, remembered })
  useSessionSync(TARGET_KEY, workflow)
  useDraftLocationSync(workflow)

  const { current, isStale, valuationYear } = workflow
  const serverErrors = current?.status === 'error' && !isStale ? current.error?.fieldErrors : null

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-5 py-6 sm:px-7 sm:py-7">
      <header className="space-y-3">
        <Button variant="quiet" size="sm" className="-ml-3" onClick={() => setMode('browse')}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to browsing
        </Button>
        <h2 className="font-display text-[2rem] leading-tight font-semibold text-ink sm:text-[2.25rem]">
          Create a property
        </h2>
        <p className="text-[0.95rem] text-ink-muted">A hypothetical home you describe — it is not a dataset record.</p>
      </header>

      <form
        noValidate
        aria-label="Hypothetical property details"
        className="space-y-7"
        onSubmit={(e) => {
          e.preventDefault()
          void workflow.submit()
        }}
      >
        <LocationFields workflow={workflow} metadata={metadata} startedFromId={start.fromId} start={start.location} serverErrors={serverErrors} />

        <section aria-labelledby="hypo-attributes-heading" className="space-y-4">
          <div className="space-y-1">
            <h3 id="hypo-attributes-heading" className="font-display text-xl text-ink">
              Home details
            </h3>
            <p className="text-sm text-ink-muted">
              Illustrative starting values — replace them with the home you have in mind. Valued in the {valuationYear}{' '}
              market.
            </p>
          </div>
          <AttributeFields workflow={workflow} metadata={metadata} serverErrors={serverErrors} />
        </section>

        <EstimateAction workflow={workflow} />
      </form>

      <WorkspaceResults workflow={workflow} metadata={metadata} targetKey={TARGET_KEY} />
    </div>
  )
}

function LocationFields({
  workflow,
  metadata,
  startedFromId,
  start,
  serverErrors,
}: {
  workflow: EstimateWorkflow
  metadata: Metadata
  startedFromId: string | null
  start: LngLat | null
  serverErrors: Record<string, string> | null | undefined
}) {
  const id = useId()
  const { form, values } = workflow
  const { errors, touchedFields, isSubmitted } = form.formState
  const { latitude, longitude } = values
  const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude)
  const outside = hasPoint && !pointInPolygon(longitude, latitude, metadata.coverage.polygon)
  // An empty starting location is a prompt, not an error, until the user engages.
  const engaged = hasPoint || isSubmitted || Boolean(touchedFields.latitude || touchedFields.longitude)
  const locationError = engaged
    ? (errors.latitude?.message ??
      errors.longitude?.message ??
      (outside ? coverageMessage(metadata) : null) ??
      serverErrors?.latitude ??
      serverErrors?.longitude ??
      null)
    : null
  const atStart = start != null && Object.is(latitude, start.latitude) && Object.is(longitude, start.longitude)

  const ids = { hint: `${id}-hint`, error: `${id}-error`, warning: `${id}-warning`, changed: `${id}-changed` }
  const describedBy = [locationError && ids.error, `${id}-help`].filter(Boolean).join(' ')
  const latInvalid = engaged && Boolean(errors.latitude || outside || serverErrors?.latitude)
  const lngInvalid = engaged && Boolean(errors.longitude || outside || serverErrors?.longitude)

  return (
    <fieldset className="space-y-4">
      <legend className="font-display text-xl text-ink">Location</legend>
      <div id={`${id}-help`} className="space-y-1 text-sm text-ink-muted">
        <p className="flex items-center gap-1.5">
          <MapPinned aria-hidden className="size-4 shrink-0 text-evergreen" />
          Click the map to place it, or enter coordinates.
        </p>
        <p>Supported area: {metadata.coverage.label}.</p>
        {startedFromId && atStart && (
          <p className="font-medium text-ink">Starting from the location of {startedFromId} — edit as needed.</p>
        )}
        {!hasPoint && !engaged && (
          <p className="font-medium text-ink">Choose a location to begin.</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <div>
          <label htmlFor={`${id}-lat`} className="text-sm font-medium text-ink">
            Latitude
          </label>
          <input
            id={`${id}-lat`}
            type="number"
            step="any"
            placeholder="e.g. 47.6062"
            aria-invalid={latInvalid || undefined}
            aria-describedby={describedBy}
            className={cn(inputClasses, 'mt-1.5')}
            {...form.register('latitude', { valueAsNumber: true })}
          />
        </div>
        <div>
          <label htmlFor={`${id}-lng`} className="text-sm font-medium text-ink">
            Longitude
          </label>
          <input
            id={`${id}-lng`}
            type="number"
            step="any"
            placeholder="e.g. -122.3321"
            aria-invalid={lngInvalid || undefined}
            aria-describedby={describedBy}
            className={cn(inputClasses, 'mt-1.5')}
            {...form.register('longitude', { valueAsNumber: true })}
          />
        </div>
      </div>
      <FieldMessages ids={ids} error={locationError} />
    </fieldset>
  )
}

function coverageMessage(metadata: Metadata): string {
  const [w, s, e, n] = metadata.coverage.bounds
  return `This location is outside ${metadata.coverage.label}. Pick a point inside the outlined area (roughly latitude ${s.toFixed(2)} to ${n.toFixed(2)}, longitude ${w.toFixed(2)} to ${e.toFixed(2)}).`
}

function sameLocation(a: LngLat | null, b: LngLat | null): boolean {
  if (!a || !b) return a === b
  return Object.is(a.latitude, b.latitude) && Object.is(a.longitude, b.longitude)
}

/**
 * Two-way sync between the coordinate inputs and the map's draft marker.
 * The form's starting location wins on mount (a leftover draft from an
 * earlier visit is replaced); afterwards equality checks against a ref of
 * the latest draft prevent ping-pong updates.
 */
function useDraftLocationSync(workflow: EstimateWorkflow) {
  const { draftLocation, setDraftLocation } = useExplorer()
  const { form } = workflow
  const { latitude, longitude } = workflow.values
  const [draftAtMount] = useState(draftLocation)
  const draftRef = useRef(draftLocation)

  // Declared first so the effects below compare against the latest draft.
  useEffect(() => {
    draftRef.current = draftLocation
  }, [draftLocation])

  // Map click → form.
  useEffect(() => {
    if (!draftLocation || draftLocation === draftAtMount) return
    const v = form.getValues()
    if (sameLocation({ latitude: v.latitude, longitude: v.longitude }, draftLocation)) return
    const opts = { shouldValidate: true, shouldDirty: true } as const
    form.setValue('latitude', draftLocation.latitude, opts)
    form.setValue('longitude', draftLocation.longitude, opts)
  }, [draftLocation, draftAtMount, form])

  // Typed coordinates → map.
  useEffect(() => {
    const next = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null
    if (sameLocation(next, draftRef.current)) return
    draftRef.current = next
    setDraftLocation(next)
  }, [latitude, longitude, setDraftLocation])
}
