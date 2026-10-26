import { useEffect } from 'react'
import { useExplorer } from '@/features/explorer/explorerState'
import type { EstimateWorkflow } from './useEstimateWorkflow'

/**
 * Keeps the explorer informed about one target's workflow: remembers its
 * prediction snapshots for when the target is reopened, and reports unsaved
 * edits for the navigation confirmation (cleared when the target unmounts).
 */
export function useSessionSync(targetKey: string, workflow: EstimateWorkflow) {
  const { rememberSession, setHasUnsavedChanges } = useExplorer()
  const { submitted, original } = workflow.session

  useEffect(() => {
    rememberSession(targetKey, { submitted, original })
    // rememberSession writes to a ref-backed map; its identity changes with
    // unrelated explorer state, which must not re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, submitted, original])

  useEffect(() => {
    setHasUnsavedChanges(workflow.hasUnsavedChanges)
  }, [workflow.hasUnsavedChanges, setHasUnsavedChanges])

  useEffect(() => () => setHasUnsavedChanges(false), [setHasUnsavedChanges])
}
