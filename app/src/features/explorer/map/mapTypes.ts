import type { Coverage, Neighbor, PropertyRecord } from '@/services/types'
import type { ExplorerMode, LngLat } from '../explorerState'

export type MapNeighborOverlay = { origin: LngLat; neighbors: Neighbor[] }

/** Everything a map engine draws; both engines receive identical props. */
export type MapViewProps = {
  coverage: Coverage
  records: PropertyRecord[]
  /** Selected existing property (browse mode only); may be outside `records`. */
  selected: PropertyRecord | null
  draft: LngLat | null
  overlay: MapNeighborOverlay | null
  inspectedId: string | null
  mode: ExplorerMode
  resetToken: number
  /** Pixels on the left covered by the results tray; framing avoids them. */
  insetLeft: number
  /** Pixels at the bottom covered by floating cards (small screens). */
  insetBottom: number
  reducedMotion: boolean
  onSelect: (id: string) => void
  onPlaceDraft: (location: LngLat) => void
  onInspectNeighbor: (neighbor: Neighbor) => void
  onReset: () => void
}

export type MapEngineProps = MapViewProps & {
  /** The engine could not render (style, tiles setup, or WebGL failure). */
  onFail: (reason: string) => void
}
