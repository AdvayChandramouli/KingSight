/**
 * Equirectangular projection for the offline schematic map. Longitude is
 * scaled by cos(mid-latitude) so shapes keep roughly true proportions at
 * King County's latitude.
 *
 * The camera is stored in "world" units (scaled degrees from the north-west
 * corner of the coverage bounds), not pixels, so resizing the map or changing
 * the padded area keeps the same place in the middle of the visible area.
 */

export type Bounds = [west: number, south: number, east: number, north: number]
export type Padding = { top: number; right: number; bottom: number; left: number }
export type Viewport = {
  width: number
  height: number
  /** Area the full coverage is fitted into at zoom 1. */
  padding: Padding
  /** Extra pixels at the bottom covered by floating cards; shifts the focus point up without rescaling. */
  focusBottom?: number
}
/** `x`/`y`: world point shown at the center of the padded viewport. */
export type View = { zoom: number; x: number; y: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 40

export type Projection = {
  project: (longitude: number, latitude: number) => [x: number, y: number]
  unproject: (x: number, y: number) => { latitude: number; longitude: number }
  /** Pixels per world unit at the current zoom. */
  scale: number
}

function frame(bounds: Bounds, viewport: Viewport) {
  const [west, south, east, north] = bounds
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180)
  const worldW = Math.max(1e-9, (east - west) * k)
  const worldH = Math.max(1e-9, north - south)
  const { padding: p } = viewport
  const availW = Math.max(1, viewport.width - p.left - p.right)
  const availH = Math.max(1, viewport.height - p.top - p.bottom)
  // Keep at least a small focus area even when cards cover most of the map.
  const focusH = Math.max(Math.min(availH, 96), availH - (viewport.focusBottom ?? 0))
  return {
    west,
    north,
    k,
    worldW,
    worldH,
    availW,
    focusH,
    /** Scale at zoom 1: the whole coverage fits the padded viewport. */
    base: Math.min(availW / worldW, availH / worldH),
    cx: p.left + availW / 2,
    cy: p.top + focusH / 2,
  }
}

function toWorld(bounds: Bounds, longitude: number, latitude: number): [number, number] {
  const k = Math.cos((((bounds[1] + bounds[3]) / 2) * Math.PI) / 180)
  return [(longitude - bounds[0]) * k, bounds[3] - latitude]
}

/** The full coverage extent. */
export function defaultView(bounds: Bounds): View {
  const [x, y] = toWorld(bounds, (bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2)
  return { zoom: 1, x, y }
}

export function createProjection(bounds: Bounds, viewport: Viewport, view: View = defaultView(bounds)): Projection {
  const f = frame(bounds, viewport)
  const scale = f.base * view.zoom
  return {
    scale,
    project: (longitude, latitude) => [
      f.cx + ((longitude - f.west) * f.k - view.x) * scale,
      f.cy + (f.north - latitude - view.y) * scale,
    ],
    unproject: (x, y) => ({
      longitude: f.west + ((x - f.cx) / scale + view.x) / f.k,
      latitude: f.north - ((y - f.cy) / scale + view.y),
    }),
  }
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Keeps the camera over the coverage area so users can't lose the map. */
export function clampView(bounds: Bounds, view: View): View {
  const [maxX, maxY] = toWorld(bounds, bounds[2], bounds[1])
  return {
    zoom: clampZoom(view.zoom),
    x: Math.min(maxX, Math.max(0, view.x)),
    y: Math.min(maxY, Math.max(0, view.y)),
  }
}

/** Moves the camera by a pixel drag. */
export function panBy(bounds: Bounds, viewport: Viewport, view: View, dx: number, dy: number): View {
  const scale = frame(bounds, viewport).base * view.zoom
  return clampView(bounds, { zoom: view.zoom, x: view.x - dx / scale, y: view.y - dy / scale })
}

/** Zooms by `factor` keeping the geographic point under (x, y) fixed. */
export function zoomAround(bounds: Bounds, viewport: Viewport, view: View, factor: number, x: number, y: number): View {
  const zoom = clampZoom(view.zoom * factor)
  if (zoom === view.zoom) return view
  const f = frame(bounds, viewport)
  const before = f.base * view.zoom
  const after = f.base * zoom
  const ax = view.x + (x - f.cx) / before
  const ay = view.y + (y - f.cy) / before
  return clampView(bounds, { zoom, x: ax - (x - f.cx) / after, y: ay - (y - f.cy) / after })
}

/** Centers (longitude, latitude) in the padded viewport at `zoom`. */
export function centerOn(bounds: Bounds, longitude: number, latitude: number, zoom: number): View {
  const [x, y] = toWorld(bounds, longitude, latitude)
  return clampView(bounds, { zoom, x, y })
}

/** A view that fits every point inside the padded viewport, with breathing room. */
export function fitPoints(
  bounds: Bounds,
  viewport: Viewport,
  points: { latitude: number; longitude: number }[],
  maxZoom = 14,
): View {
  const f = frame(bounds, viewport)
  const world = points.map((p) => toWorld(bounds, p.longitude, p.latitude))
  const xs = world.map(([x]) => x)
  const ys = world.map(([, y]) => y)
  const spanX = Math.max(1e-6, Math.max(...xs) - Math.min(...xs))
  const spanY = Math.max(1e-6, Math.max(...ys) - Math.min(...ys))
  const zoom = Math.min(maxZoom, (f.availW / (spanX * f.base)) * 0.8, (f.focusH / (spanY * f.base)) * 0.8)
  return clampView(bounds, {
    zoom,
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  })
}

export type ScreenPoint<T> = { item: T; x: number; y: number }
export type Cluster<T> = { key: string; x: number; y: number; members: ScreenPoint<T>[] }

/** Grid clustering in screen space; clusters split naturally as zoom grows. */
export function clusterScreenPoints<T>(points: ScreenPoint<T>[], cellSize: number): Cluster<T>[] {
  const cells = new Map<string, ScreenPoint<T>[]>()
  for (const p of points) {
    const key = `${Math.floor(p.x / cellSize)}:${Math.floor(p.y / cellSize)}`
    const cell = cells.get(key)
    if (cell) cell.push(p)
    else cells.set(key, [p])
  }
  const clusters = [...cells.entries()].map(([key, members]) => centroid(key, members))
  // Grid cells can leave neighboring clusters overlapping; merge until they are a cell apart.
  for (let merged = true; merged; ) {
    merged = false
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i]!
        const b = clusters[j]!
        if (Math.hypot(a.x - b.x, a.y - b.y) < cellSize) {
          clusters[i] = centroid(a.key, [...a.members, ...b.members])
          clusters.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }
  return clusters
}

function centroid<T>(key: string, members: ScreenPoint<T>[]): Cluster<T> {
  return {
    key,
    members,
    x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
    y: members.reduce((sum, m) => sum + m.y, 0) / members.length,
  }
}

/** SVG path for a [lng, lat] ring. */
export function ringToPath(ring: [number, number][], projection: Projection): string {
  if (ring.length === 0) return ''
  return (
    ring
      .map(([lng, lat], i) => {
        const [x, y] = projection.project(lng, lat)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join('') + 'Z'
  )
}
