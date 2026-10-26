import { describe, expect, it } from 'vitest'
import {
  centerOn,
  clusterScreenPoints,
  createProjection,
  defaultView,
  fitPoints,
  panBy,
  zoomAround,
  type Bounds,
  type Viewport,
} from './schematicProjection'

const BOUNDS: Bounds = [-122.54, 47.08, -121.06, 47.78]
const VIEWPORT: Viewport = { width: 900, height: 700, padding: { top: 72, right: 28, bottom: 44, left: 412 } }

function visibleCenter(vp: Viewport) {
  const p = vp.padding
  return [p.left + (vp.width - p.left - p.right) / 2, p.top + (vp.height - p.top - p.bottom) / 2] as const
}

describe('schematic projection', () => {
  it('round-trips longitude/latitude through screen pixels', () => {
    const views = [defaultView(BOUNDS), panBy(BOUNDS, VIEWPORT, { ...defaultView(BOUNDS), zoom: 4.5 }, -230, 140)]
    for (const view of views) {
      const p = createProjection(BOUNDS, VIEWPORT, view)
      for (const [lng, lat] of [
        [-122.3433, 47.6844],
        [-121.5, 47.3],
        [-122.54, 47.78],
      ] as const) {
        const [x, y] = p.project(lng, lat)
        const back = p.unproject(x, y)
        expect(back.longitude).toBeCloseTo(lng, 9)
        expect(back.latitude).toBeCloseTo(lat, 9)
      }
    }
  })

  it('fits coverage inside the padded viewport and corrects for latitude', () => {
    const p = createProjection(BOUNDS, VIEWPORT)
    const [west, north] = p.project(BOUNDS[0], BOUNDS[3])
    const [east, south] = p.project(BOUNDS[2], BOUNDS[1])
    expect(west).toBeGreaterThanOrEqual(VIEWPORT.padding.left - 0.5)
    expect(east).toBeLessThanOrEqual(VIEWPORT.width - VIEWPORT.padding.right + 0.5)
    expect(north).toBeGreaterThanOrEqual(VIEWPORT.padding.top - 0.5)
    expect(south).toBeLessThanOrEqual(VIEWPORT.height - VIEWPORT.padding.bottom + 0.5)
    // One degree of longitude is about cos(47.4°) ≈ 0.68 of a degree of latitude.
    const [x0, y0] = p.project(-122, 47.4)
    const [x1] = p.project(-121, 47.4)
    const [, y1] = p.project(-122, 46.4)
    expect((x1 - x0) / (y1 - y0)).toBeCloseTo(Math.cos((47.43 * Math.PI) / 180), 2)
  })

  it('keeps the point under the cursor fixed while zooming', () => {
    const start = { ...defaultView(BOUNDS), zoom: 2 }
    const before = createProjection(BOUNDS, VIEWPORT, start).unproject(640, 360)
    const next = zoomAround(BOUNDS, VIEWPORT, start, 2, 640, 360)
    const after = createProjection(BOUNDS, VIEWPORT, next).unproject(640, 360)
    expect(next.zoom).toBe(4)
    expect(after.longitude).toBeCloseTo(before.longitude, 6)
    expect(after.latitude).toBeCloseTo(before.latitude, 6)
  })

  it('keeps a centered property centered when the visible area changes', () => {
    const view = centerOn(BOUNDS, -122.3, 47.6, 3)
    const resized: Viewport = { width: 375, height: 420, padding: { top: 72, right: 28, bottom: 44, left: 28 } }
    for (const vp of [VIEWPORT, resized]) {
      const [x, y] = createProjection(BOUNDS, vp, view).project(-122.3, 47.6)
      const [cx, cy] = visibleCenter(vp)
      expect(x).toBeCloseTo(cx, 6)
      expect(y).toBeCloseTo(cy, 6)
    }
    // Floating cards move the focus point up without changing the scale.
    const covered = { ...resized, focusBottom: 120 }
    const plain = createProjection(BOUNDS, resized, view)
    const shifted = createProjection(BOUNDS, covered, view)
    expect(shifted.scale).toBe(plain.scale)
    expect(shifted.project(-122.3, 47.6)[1]).toBeCloseTo(plain.project(-122.3, 47.6)[1] - 60, 6)
  })

  it('fits a target and its connected homes inside the padded viewport', () => {
    const points = [
      { longitude: -122.3433, latitude: 47.6844 },
      { longitude: -122.3735, latitude: 47.6825 },
      { longitude: -122.2846, latitude: 47.6831 },
      { longitude: -122.33, latitude: 47.66 },
    ]
    const view = fitPoints(BOUNDS, VIEWPORT, points)
    expect(view.zoom).toBeGreaterThan(3)
    const p = createProjection(BOUNDS, VIEWPORT, view)
    for (const pt of points) {
      const [x, y] = p.project(pt.longitude, pt.latitude)
      expect(x).toBeGreaterThanOrEqual(VIEWPORT.padding.left)
      expect(x).toBeLessThanOrEqual(VIEWPORT.width - VIEWPORT.padding.right)
      expect(y).toBeGreaterThanOrEqual(VIEWPORT.padding.top)
      expect(y).toBeLessThanOrEqual(VIEWPORT.height - VIEWPORT.padding.bottom)
    }
  })

  it('splits grid clusters as zoom increases', () => {
    const coords = [
      [-122.34, 47.68],
      [-122.33, 47.67],
      [-122.3, 47.6],
      [-122.29, 47.61],
    ] as const
    const clustersAt = (zoom: number) => {
      const p = createProjection(BOUNDS, VIEWPORT, centerOn(BOUNDS, -122.32, 47.64, zoom))
      return clusterScreenPoints(
        coords.map(([lng, lat], i) => {
          const [x, y] = p.project(lng, lat)
          return { item: i, x, y }
        }),
        42,
      ).length
    }
    expect(clustersAt(1)).toBeLessThan(clustersAt(30))
    expect(clustersAt(30)).toBe(4)
  })

  it('never leaves two clusters closer than one cell', () => {
    // Points straddling a grid line would otherwise form two overlapping clusters.
    const points = [
      { item: 'a', x: 41, y: 10 },
      { item: 'b', x: 43, y: 12 },
      { item: 'c', x: 200, y: 200 },
    ]
    const clusters = clusterScreenPoints(points, 42)
    expect(clusters).toHaveLength(2)
    expect(clusters.find((c) => c.members.length === 2)?.x).toBeCloseTo(42, 6)
  })
})
