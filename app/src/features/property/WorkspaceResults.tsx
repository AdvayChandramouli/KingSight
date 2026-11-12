import { ExplanationSection } from '@/features/prediction/ExplanationSection'
import { NeighborSection } from '@/features/prediction/NeighborSection'
import type { Metadata } from '@/services/types'
import type { EstimateWorkflow } from './useEstimateWorkflow'

type Props = { workflow: EstimateWorkflow; metadata: Metadata; targetKey: string }

/**
 * Contributions, then neighbors. The recorded sale and the two estimates
 * render above the editable details; this block stays after the form.
 */
export function WorkspaceResults({ workflow, metadata, targetKey }: Props) {
  if (!workflow.current) return null
  return (
    <div className="space-y-8 border-t border-border pt-8">
      <ExplanationSection workflow={workflow} metadata={metadata} />
      <NeighborSection workflow={workflow} metadata={metadata} targetKey={targetKey} />
    </div>
  )
}
