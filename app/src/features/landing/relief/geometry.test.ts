import { describe, expect, it } from 'vitest'
import { pointInPolygon } from '@/lib/geo'
import { connectionMotionMs, easeArrival, THREAD_DRAW_MS, THREAD_STAGGER_MS } from './easing'
import {
  EAST_CREST,
  LAKE_SAMMAMISH,
  LAKE_WASHINGTON,
  LANDMARKS,
  MAINLAND,
  MERCER,
  RAINIER,
  SOUND,
  VASHON,
  type LngLat,
} from './geometry'
import { CAMERA_FRAME, inInitialFrame, initialDistance, initialPolarAngle, projectToModel } from './project'

function crosses(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const cross = (p: LngLat, q: LngLat, r: LngLat) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const c1 = cross(a, b, c)
  const c2 = cross(a, b, d)
  const c3 = cross(c, d, a)
  const c4 = cross(c, d, b)
  if (c1 === 0 || c2 === 0 || c3 === 0 || c4 === 0) return false
  return c1 > 0 !== c2 > 0 && c3 > 0 !== c4 > 0
}

function selfIntersects(ring: LngLat[]): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    for (let j = i + 1; j < ring.length; j++) {
      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === ring.length - 1)
      if (adjacent) continue
      const c = ring[j]!
      const d = ring[(j + 1) % ring.length]!
      if (crosses(a, b, c, d)) return true
    }
  }
  return false
}

describe('relief geometry', () => {
  it('projects longitude east and latitude north, with north as −Z', () => {
    const seattle = projectToModel(47.6062, -122.3321)
    const bellevue = projectToModel(47.6101, -122.2015)
    const enumclaw = projectToModel(47.2043, -121.9876)
    expect(seattle.x).toBeLessThan(bellevue.x)
    expect(seattle.z).toBeLessThan(enumclaw.z)
    expect(seattle.y).toBe(0)
  })

  it('keeps a simple mainland, with lakes inside and Rainier outside', () => {
    expect(selfIntersects(MAINLAND)).toBe(false)
    expect(selfIntersects(VASHON)).toBe(false)
    expect(LAKE_WASHINGTON.every(([lng, lat]) => pointInPolygon(lng, lat, MAINLAND))).toBe(true)
    expect(LAKE_SAMMAMISH.every(([lng, lat]) => pointInPolygon(lng, lat, MAINLAND))).toBe(true)
    expect(MERCER.every(([lng, lat]) => pointInPolygon(lng, lat, LAKE_WASHINGTON))).toBe(true)
    expect(pointInPolygon(RAINIER.longitude, RAINIER.latitude, MAINLAND)).toBe(false)
    expect(pointInPolygon(-122.36, 47.605, MAINLAND)).toBe(false)
    expect(pointInPolygon(-122.36, 47.605, SOUND)).toBe(true)
    expect(pointInPolygon(-122.332, 47.606, MAINLAND)).toBe(true)
    expect(EAST_CREST.length).toBeGreaterThan(8)
  })

  it('places landmarks on land and frames the county without a filled landmark', () => {
    expect(LANDMARKS).toHaveLength(12)
    for (const landmark of LANDMARKS) {
      const onVashon = pointInPolygon(landmark.longitude, landmark.latitude, VASHON)
      const onMainland =
        pointInPolygon(landmark.longitude, landmark.latitude, MAINLAND) &&
        !pointInPolygon(landmark.longitude, landmark.latitude, LAKE_WASHINGTON) &&
        !pointInPolygon(landmark.longitude, landmark.latitude, LAKE_SAMMAMISH)
      expect(`${landmark.id}:${String(onVashon || onMainland)}`).toBe(`${landmark.id}:true`)
      expect(landmark.height).toBeLessThan(0.12)
    }
    const polar = initialPolarAngle()
    expect(polar).toBeGreaterThan(CAMERA_FRAME.minPolarAngle)
    expect(polar).toBeLessThan(CAMERA_FRAME.maxPolarAngle)
    expect(polar).toBeLessThan(Math.PI / 2)
    const distance = initialDistance()
    expect(distance).toBeGreaterThan(CAMERA_FRAME.minDistance)
    expect(distance).toBeLessThan(CAMERA_FRAME.maxDistance)
    for (const [lng, lat] of [
      [-122.36, 47.6],
      [-122.2, 47.75],
      [-121.2, 47.55],
      [RAINIER.longitude, RAINIER.latitude],
    ] as const) {
      expect(inInitialFrame(projectToModel(lat, lng, 0.04))).toBe(true)
    }
  })

  it('caps the connection draw at 700ms with a 500ms arrival', () => {
    expect(THREAD_DRAW_MS).toBe(500)
    expect(THREAD_DRAW_MS + THREAD_STAGGER_MS).toBeLessThanOrEqual(700)
    expect(connectionMotionMs(true)).toBeLessThanOrEqual(700)
    expect(connectionMotionMs(false)).toBeLessThan(connectionMotionMs(true))
    expect(easeArrival(0)).toBe(0)
    expect(easeArrival(1)).toBe(1)
    expect(easeArrival(0.25)).toBeGreaterThan(0.25)
  })
})
