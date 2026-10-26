import { useMemo } from 'react'
import { useProperty, usePropertyList } from '@/services/queries'
import type { PropertyRecord } from '@/services/types'
import { targetKeyFor, useExplorer } from './explorerState'
import { activeFilterCount, toPropertyQuery } from './toPropertyQuery'

/** Markers come from one bounded page; clustering keeps what renders small. */
export const MAP_MARKER_LIMIT = 50

function flatten(pages: { items: PropertyRecord[] }[] | undefined): PropertyRecord[] {
  const seen = new Set<string>()
  const out: PropertyRecord[] = []
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
  }
  return out
}

/** The paginated list of filtered discoverable properties. */
export function useDiscoveryResults() {
  const { filters } = useExplorer()
  const query = useMemo(() => toPropertyQuery(filters), [filters])
  const filtered = activeFilterCount(filters) > 0
  const list = usePropertyList(query)
  // Unfiltered total for "3 of 48"; shares the cache entry of the default list.
  const baseline = usePropertyList(filtered ? {} : query)
  const items = useMemo(() => flatten(list.data?.pages), [list.data])
  const total = list.data?.pages[0]?.total ?? null
  const overallTotal = baseline.data?.pages[0]?.total ?? null
  return { ...list, query, items, total, overallTotal: filtered ? overallTotal : total, filtered }
}

export type DiscoveryResults = ReturnType<typeof useDiscoveryResults>

/** Map markers: the first bounded page of the same filtered query. */
export function useMapRecords() {
  const { filters } = useExplorer()
  const query = useMemo(() => ({ ...toPropertyQuery(filters), limit: MAP_MARKER_LIMIT }), [filters])
  const markers = usePropertyList(query)
  const firstPage = markers.data?.pages[0]
  return {
    records: firstPage?.items ?? [],
    truncated: Boolean(firstPage?.next_cursor),
    isLoading: markers.isPending,
    isError: markers.isError,
  }
}

/** The selected existing property, fetched by id so it shows even when filtered out. */
export function useSelectedRecord(fallback: PropertyRecord[] = []): PropertyRecord | null {
  const { selectedId, mode } = useExplorer()
  const activeId = mode === 'browse' ? selectedId : null
  const detail = useProperty(activeId)
  if (!activeId) return null
  if (detail.data && detail.data.id === activeId) return detail.data
  return fallback.find((r) => r.id === activeId) ?? null
}

/** Neighbor edges for the current target, or null when hidden or belonging to another target. */
export function useVisibleNeighborOverlay() {
  const { showNeighbors, neighborOverlay, mode, selectedId } = useExplorer()
  const targetKey = targetKeyFor(mode, selectedId)
  const matches = Boolean(neighborOverlay && targetKey && neighborOverlay.targetKey === targetKey)
  return {
    /** Overlay data exists for this target (the legend and toggle can show). */
    available: matches ? neighborOverlay : null,
    /** Overlay should be drawn on the map. */
    visible: matches && showNeighbors ? neighborOverlay : null,
  }
}