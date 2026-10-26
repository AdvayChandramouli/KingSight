import { createContext, useContext } from 'react'
import type { Neighbor, NeighborContext, PredictRequest } from '@/services/types'

export type WaterfrontFilter = 'any' | 'yes' | 'no'

export type Filters = {
  /** Property ID or ZIP search text. */
  q: string
  minSqft: number | null
  maxSqft: number | null
  waterfront: WaterfrontFilter
}

export const EMPTY_FILTERS: Filters = { q: '', minSqft: null, maxSqft: null, waterfront: 'any' }

export type LngLat = { latitude: number; longitude: number }

export type ExplorerMode = 'browse' | 'create'

export type MobileView = 'map' | 'details'

/** Neighbor edges published by the details panel for the map overlay. */
export type NeighborOverlay = {
  /** Session key of the target the neighbors belong to. */
  targetKey: string
  origin: LngLat
  context: NeighborContext
}

/** Remembered prediction snapshots so reopening a target restores results. */
export type RememberedSession = {
  submitted: PredictRequest | null
  original: PredictRequest | null
}

export type ExplorerState = {
  /** Selected existing property id from `?property=`; null when none. */
  selectedId: string | null
  /** `browse` or `create` (hypothetical property), from `?mode=create`. */
  mode: ExplorerMode
  selectProperty: (id: string | null) => void
  setMode: (mode: ExplorerMode) => void

  filters: Filters
  setFilters: (next: Filters) => void
  clearFilters: () => void

  /** Neighbor overlay visibility; initialized from `?neighbors=1`. */
  showNeighbors: boolean
  setShowNeighbors: (show: boolean) => void
  neighborOverlay: NeighborOverlay | null
  setNeighborOverlay: (overlay: NeighborOverlay | null) => void
  /** Neighbor whose context card is open. Inspecting never changes the target. */
  inspectedNeighbor: Neighbor | null
  inspectNeighbor: (neighbor: Neighbor | null) => void

  /** Hypothetical-property location (map click or coordinate inputs). */
  draftLocation: LngLat | null
  setDraftLocation: (location: LngLat | null) => void

  /** Increments when the user asks to reset the map extent. */
  mapResetToken: number
  requestMapReset: () => void
  /** Set when the map engine failed; the list and coordinate inputs remain. */
  mapUnavailable: boolean
  setMapUnavailable: (unavailable: boolean) => void

  mobileView: MobileView
  setMobileView: (view: MobileView) => void

  /** Reported by the active form; navigation asks for confirmation when true. */
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (dirty: boolean) => void

  rememberSession: (targetKey: string, session: RememberedSession) => void
  recallSession: (targetKey: string) => RememberedSession | null

  openHowItWorks: () => void
}

export const ExplorerContext = createContext<ExplorerState | null>(null)

export function useExplorer(): ExplorerState {
  const value = useContext(ExplorerContext)
  if (!value) throw new Error('useExplorer must be used inside <ExplorerProvider>')
  return value
}

export function targetKeyFor(mode: ExplorerMode, selectedId: string | null): string | null {
  if (mode === 'create') return 'hypothetical'
  return selectedId ? `property:${selectedId}` : null
}
