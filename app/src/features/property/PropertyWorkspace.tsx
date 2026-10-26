import { PencilLine, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useExplorer } from '@/features/explorer/explorerState'
import type { Metadata, PropertyDetail } from '@/services/types'
import { AttributeFields } from './AttributeFields'
import { EstimateAction } from './EstimateAction'
import { AttributeSummary, LockedLocation, PropertyHeader, RecordedSale } from './PropertySummary'
import { useEstimateWorkflow, type EstimateTarget } from './useEstimateWorkflow'
import { useSessionSync } from './useSessionSync'
import { WorkspaceResults } from './WorkspaceResults'

type Props = { property: PropertyDetail; metadata: Metadata }

/**
 * One existing property's details, edits, and results. Mounted with
 * `key={property.id}` so responses for a previous selection can never leak in.
 */
export function PropertyWorkspace({ property, metadata }: Props) {
  const { recallSession, selectProperty, setMobileView } = useExplorer()
  const targetKey = `property:${property.id}`
  const [remembered] = useState(() => recallSession(targetKey))
  const target = useMemo<EstimateTarget>(() => ({ kind: 'existing', property }), [property])
  const workflow = useEstimateWorkflow({ target, metadata, remembered })
  useSessionSync(targetKey, workflow)

  const [editRequested, setEditRequested] = useState(() => remembered?.submitted?.source === 'edited')
  const { changedFields, current, isStale } = workflow
  const editing = editRequested || changedFields.size > 0
  const isEditedContext = editing || current?.request.source === 'edited'
  const serverErrors = current?.status === 'error' && !isStale ? current.error?.fieldErrors : null

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-5 py-6 sm:px-7 sm:py-7">
      <div className="space-y-5">
        <PropertyHeader
          property={property}
          onClose={() => {
            selectProperty(null)
            setMobileView('map')
          }}
        />
        <RecordedSale property={property} asOriginal={isEditedContext} />
      </div>

      <form
        noValidate
        aria-labelledby="attributes-heading"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void workflow.submit()
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="attributes-heading" className="font-display text-xl text-ink">
            {editing ? 'Edit details' : 'Property details'}
          </h3>
          {editing ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={workflow.resetChanges}>
                <RotateCcw aria-hidden className="size-3.5" />
                Reset changes
              </Button>
              {changedFields.size === 0 && (
                <Button size="sm" variant="quiet" onClick={() => setEditRequested(false)}>
                  Close editor
                </Button>
              )}
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setEditRequested(true)}>
              <PencilLine aria-hidden className="size-3.5" />
              Edit details
            </Button>
          )}
        </div>

        {editing ? (
          <>
            <p className="text-sm text-ink-muted">
              Change any detail, then update the estimate to see how each model responds. Nothing is recalculated
              until you ask.
            </p>
            <AttributeFields workflow={workflow} metadata={metadata} serverErrors={serverErrors} showChanges />
            <LockedLocation property={property} />
          </>
        ) : (
          <AttributeSummary values={workflow.values} metadata={metadata} />
        )}

        <EstimateAction workflow={workflow} />
      </form>

      <WorkspaceResults workflow={workflow} metadata={metadata} targetKey={targetKey} />
    </div>
  )
}
