import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import {
  EMPTY_FILTERS,
  ExplorerContext,
  type ExplorerMode,
  type ExplorerState,
  type Filters,
  type LngLat,
  type MobileView,
  type NeighborOverlay,
  type RememberedSession,
} from './explorerState'
import type { Neighbor } from '@/services/types'

type Props = { children: ReactNode; onOpenHowItWorks: () => void }

export function ExplorerProvider({ children, onOpenHowItWorks }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('property')
  const mode: ExplorerMode = searchParams.get('mode') === 'create' ? 'create' : 'browse'

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showNeighbors, setShowNeighbors] = useState(() => searchParams.get('neighbors') === '1')
  const [neighborOverlay, setNeighborOverlay] = useState<NeighborOverlay | null>(null)
  const [inspectedNeighbor, setInspectedNeighbor] = useState<Neighbor | null>(null)
  const [draftLocation, setDraftLocation] = useState<LngLat | null>(null)
  const [mapResetToken, setMapResetToken] = useState(0)
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>(selectedId ? 'details' : 'map')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const sessions = useRef(new Map<string, RememberedSession>())

  // Selection lives in the URL so deep links and back/forward behave normally.
  const selectProperty = useCallback(
    (id: string | null) => {
      setInspectedNeighbor(null)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('mode')
        if (id) next.set('property', id)
        else next.delete('property')
        return next
      })
    },
    [setSearchParams],
  )

  const setMode = useCallback(
    (nextMode: ExplorerMode) => {
      setInspectedNeighbor(null)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (nextMode === 'create') next.set('mode', 'create')
        else next.delete('mode')
        return next
      })
    },
    [setSearchParams],
  )

  const value = useMemo<ExplorerState>(
    () => ({
      selectedId,
      mode,
      selectProperty,
      setMode,
      filters,
      setFilters,
      clearFilters: () => setFilters(EMPTY_FILTERS),
      showNeighbors,
      setShowNeighbors,
      neighborOverlay,
      setNeighborOverlay,
      inspectedNeighbor,
      inspectNeighbor: setInspectedNeighbor,
      draftLocation,
      setDraftLocation,
      mapResetToken,
      requestMapReset: () => setMapResetToken((t) => t + 1),
      mapUnavailable,
      setMapUnavailable,
      mobileView,
      setMobileView,
      hasUnsavedChanges,
      setHasUnsavedChanges,
      rememberSession: (key, session) => sessions.current.set(key, session),
      recallSession: (key) => sessions.current.get(key) ?? null,
      openHowItWorks: onOpenHowItWorks,
    }),
    [
      selectedId,
      mode,
      selectProperty,
      setMode,
      filters,
      showNeighbors,
      neighborOverlay,
      inspectedNeighbor,
      draftLocation,
      mapResetToken,
      mapUnavailable,
      mobileView,
      hasUnsavedChanges,
      onOpenHowItWorks,
    ],
  )

  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>
}
