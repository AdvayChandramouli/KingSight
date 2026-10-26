import { EstimateResults } from '@/features/prediction/EstimateResults'
import { ExplanationSection } from '@/features/prediction/ExplanationSection'
import { NeighborSection } from '@/features/prediction/NeighborSection'
import type { Metadata } from '@/services/types'
import type { EstimateWorkflow } from './useEstimateWorkflow'

type Props = { workflow: EstimateWorkflow; metadata: Metadata; targetKey: string }

/** Results, explanation, and graph context for the last submitted snapshot. */
export function WorkspaceResults({ workflow, metadata, targetKey }: Props) {
  if (!workflow.current) return null
  return (
    <div className="divide-y divide-border [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
      <EstimateResults workflow={workflow} metadata={metadata} />
      <ExplanationSection workflow={workflow} metadata={metadata} />
      <NeighborSection workflow={workflow} metadata={metadata} targetKey={targetKey} />
    </div>
  )
}
