/** Arrival curve from the Relief motion spec: cubic-bezier(0.16, 1, 0.3, 1). */

const X1 = 0.16
const Y1 = 1
const X2 = 0.3
const Y2 = 1

function sampleBezier(t: number, p1: number, p2: number): number {
  const c = 3 * p1
  const b = 3 * (p2 - p1) - c
  const a = 1 - c - b
  return ((a * t + b) * t + c) * t
}

function sampleBezierDerivative(t: number, p1: number, p2: number): number {
  const c = 3 * p1
  const b = 3 * (p2 - p1) - c
  const a = 1 - c - b
  return (3 * a * t + 2 * b) * t + c
}

/** Unit progress (0–1) through the arrival ease. Endpoints stay put. */
export function easeArrival(amount: number): number {
  if (amount <= 0) return 0
  if (amount >= 1) return 1
  let t = amount
  for (let i = 0; i < 8; i++) {
    const x = sampleBezier(t, X1, X2)
    const dx = sampleBezierDerivative(t, X1, X2)
    if (Math.abs(dx) < 1e-6) break
    t = Math.min(1, Math.max(0, t - (x - amount) / dx))
  }
  return sampleBezier(t, Y1, Y2)
}

/** Each thread draws for this long. The last thread starts after the stagger window. */
export const THREAD_DRAW_MS = 500
export const THREAD_STAGGER_MS = 200
export const THREAD_EXIT_MS = 240
export const THREAD_EXIT_STAGGER_MS = 80

export function connectionMotionMs(showing: boolean): number {
  return showing ? THREAD_DRAW_MS + THREAD_STAGGER_MS : THREAD_EXIT_MS + THREAD_EXIT_STAGGER_MS
}

export function threadSchedule(index: number, count: number, showing: boolean): { delay: number; duration: number } {
  const span = Math.max(count - 1, 1)
  const slot = count <= 1 ? 0 : index / span
  return {
    delay: slot * (showing ? THREAD_STAGGER_MS : THREAD_EXIT_STAGGER_MS),
    duration: showing ? THREAD_DRAW_MS : THREAD_EXIT_MS,
  }
}
