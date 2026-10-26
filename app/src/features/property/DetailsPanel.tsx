import { Notice } from '@/components/ui/Notice'
import { useExplorer } from '@/features/explorer/explorerState'
import { describeError, isApiError } from '@/services/client'
import { useMetadata, useProperty } from '@/services/queries'
import type { Metadata } from '@/services/types'
import { ExplorerIntro } from './ExplorerIntro'
import { HypotheticalPanel } from './HypotheticalPanel'
import { PanelLoading, PanelMessage, PanelShell } from './PanelStates'
import { PropertyWorkspace } from './PropertyWorkspace'

/** Right-hand explorer panel: intro, an existing property, or a hypothetical one. */
export function DetailsPanel() {
  const { mode, selectedId } = useExplorer()
  const metadata = useMetadata()

  if (mode !== 'create' && !selectedId) return <ExplorerIntro />

  if (metadata.isPending) {
    return <PanelLoading label={mode === 'create' ? 'Preparing a new property…' : `Loading property ${selectedId}…`} />
  }
  if (metadata.error) {
    return (
      <PanelShell>
        <Notice tone="error" title="Couldn’t load model information" onRetry={() => void metadata.refetch()}>
          {describeError(metadata.error).message}
        </Notice>
      </PanelShell>
    )
  }

  if (mode === 'create') return <HypotheticalPanel key="hypothetical" metadata={metadata.data} />
  return <ExistingProperty key={selectedId} id={selectedId as string} metadata={metadata.data} />
}

function ExistingProperty({ id, metadata }: { id: string; metadata: Metadata }) {
  const { selectProperty, setMobileView } = useExplorer()
  const query = useProperty(id)
  const browse = () => {
    selectProperty(null)
    setMobileView('map')
  }

  if (query.isPending) return <PanelLoading label={`Loading property ${id}…`} />

  if (query.error) {
    if (isApiError(query.error) && query.error.code === 'not_found') {
      return (
        <PanelMessage title="Property not found" onBrowse={browse}>
          <p>
            There’s no example property with the ID <strong className="text-ink">{id}</strong>. It may have been
            mistyped, or it isn’t part of this dataset.
          </p>
        </PanelMessage>
      )
    }
    const d = describeError(query.error)
    return (
      <PanelShell>
        <Notice tone="error" title={d.title} onRetry={() => void query.refetch()}>
          {d.message}
        </Notice>
      </PanelShell>
    )
  }

  const property = query.data
  if (property.role === 'reference_only') {
    return (
      <PanelMessage title={`Property ${property.id} is reference-only`} onBrowse={browse}>
        <p>
          This record gives the graph model neighborhood context, but it isn’t one of the example properties that
          can be estimated here.
        </p>
        <p>Pick an example property on the map or in the list to request estimates.</p>
      </PanelMessage>
    )
  }

  return <PropertyWorkspace key={property.id} property={property} metadata={metadata} />
}
