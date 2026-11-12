/**
 * Local tangent frame for the relief model.
 * See docs/design/relief-geometry.md. This is a planning-model scale, not a survey CRS.
 *
 * +X east, +Y up, −Z north. One model unit is 100 km.
 * Pin elevation is the flat board, not a terrain sample.
 */

export const MODEL_ORIGIN = {
  latitude: 47.432,
  longitude: -121.8035,
} as const

/** Meters represented by one model unit. */
export const METERS_PER_UNIT = 100_000

const METERS_PER_DEGREE_LAT = 111_320

export type ModelPoint = { x: number; y: number; z: number }

export function projectToModel(latitude: number, longitude: number, y = 0): ModelPoint {
  const lat0 = (MODEL_ORIGIN.latitude * Math.PI) / 180
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(lat0)
  const east = (longitude - MODEL_ORIGIN.longitude) * metersPerDegreeLng
  const north = (latitude - MODEL_ORIGIN.latitude) * METERS_PER_DEGREE_LAT
  return {
    x: east / METERS_PER_UNIT,
    y,
    z: -north / METERS_PER_UNIT,
  }
}

export const WATER_Y = 0.006
export const LAND_BOTTOM = 0.012
export const LAND_THICKNESS = 0.022
export const LAND_TOP = LAND_BOTTOM + LAND_THICKNESS

/**
 * High oblique from the southwest: Elliott Bay toward the foreground,
 * the cascade crest and Rainier toward the east and south edges.
 * Polar angle is measured from +Y, matching OrbitControls.
 */
export const CAMERA_FRAME = {
  position: [-1.02, 0.9, 0.98] as const,
  target: [0.02, 0.04, 0.1] as const,
  fov: 33,
  minDistance: 0.72,
  maxDistance: 2.45,
  minPolarAngle: 0.4,
  maxPolarAngle: Math.PI / 2 - 0.36,
}

type Vec3 = { x: number; y: number; z: number }

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function norm(a: Vec3): Vec3 {
  const length = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / length, y: a.y / length, z: a.z / length }
}

export function initialPolarAngle(): number {
  const eye = { x: CAMERA_FRAME.position[0], y: CAMERA_FRAME.position[1], z: CAMERA_FRAME.position[2] }
  const target = { x: CAMERA_FRAME.target[0], y: CAMERA_FRAME.target[1], z: CAMERA_FRAME.target[2] }
  const offset = sub(eye, target)
  return Math.acos(offset.y / (Math.hypot(offset.x, offset.y, offset.z) || 1))
}

export function initialDistance(): number {
  const eye = { x: CAMERA_FRAME.position[0], y: CAMERA_FRAME.position[1], z: CAMERA_FRAME.position[2] }
  const target = { x: CAMERA_FRAME.target[0], y: CAMERA_FRAME.target[1], z: CAMERA_FRAME.target[2] }
  return Math.hypot(eye.x - target.x, eye.y - target.y, eye.z - target.z)
}

/** True when a model point lies inside the initial perspective frame. */
export function inInitialFrame(point: ModelPoint, aspect = 16 / 10): boolean {
  const eye = { x: CAMERA_FRAME.position[0], y: CAMERA_FRAME.position[1], z: CAMERA_FRAME.position[2] }
  const target = { x: CAMERA_FRAME.target[0], y: CAMERA_FRAME.target[1], z: CAMERA_FRAME.target[2] }
  const forward = norm(sub(target, eye))
  const right = norm(cross(forward, { x: 0, y: 1, z: 0 }))
  const up = norm(cross(right, forward))
  const offset = sub(point, eye)
  const depth = dot(offset, forward)
  if (depth <= 0.05) return false
  const halfVertical = Math.tan((CAMERA_FRAME.fov * Math.PI) / 360)
  const halfHorizontal = halfVertical * aspect
  const nx = dot(offset, right) / depth
  const ny = dot(offset, up) / depth
  return Math.abs(nx) <= halfHorizontal && Math.abs(ny) <= halfVertical
}
