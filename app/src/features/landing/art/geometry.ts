/** Token values from `styles/index.css`, for SVG attributes. */
export const ART = {
  canvas: '#F7F4EE',
  surface: '#FFFEFA',
  ink: '#203A32',
  evergreen: '#31594A',
  evergreenSoft: '#E3EBE4',
  mist: '#DCE7EB',
  mistSoft: '#EDF3F5',
  deepBlue: '#38596D',
  clay: '#9A654A',
  claySoft: '#F3E6DC',
  sand: '#E9E1D4',
  sandSoft: '#F1ECE3',
  water: '#C9DCE3',
  land: '#E6EBDD',
} as const

const r = (n: number) => Math.round(n * 10) / 10

/**
 * A layered fir: five concave tiers that widen toward the base, plus a short
 * trunk. All subpaths share winding so overlaps union under one fill.
 */
export function firPath(x: number, base: number, h: number): string {
  const w = h * 0.38
  const tiers = 5
  let d = ''
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1)
    const top = base - h + i * h * 0.15
    const bottom = top + h * 0.3
    const hw = (w / 2) * (0.34 + 0.66 * t)
    const span = bottom - top
    d +=
      `M${r(x)} ${r(top)}` +
      `Q${r(x + hw * 0.28)} ${r(bottom - span * 0.38)} ${r(x + hw)} ${r(bottom)}` +
      `Q${r(x)} ${r(bottom - span * 0.16)} ${r(x - hw)} ${r(bottom)}` +
      `Q${r(x - hw * 0.28)} ${r(bottom - span * 0.38)} ${r(x)} ${r(top)}Z`
  }
  const tw = h * 0.045
  d += `M${r(x - tw / 2)} ${r(base - h * 0.13)}h${r(tw)}v${r(h * 0.13)}h${r(-tw)}Z`
  return d
}

/** A gentle open wave line, used for water contours. */
export function wavePath(x: number, y: number, length: number, period = 30, amp = 1.8): string {
  const halves = Math.max(2, Math.round((length / period) * 2))
  let d = `M${r(x)} ${r(y)}q${r(period / 4)} ${r(-amp)} ${r(period / 2)} 0`
  for (let i = 1; i < halves; i++) d += `t${r(period / 2)} 0`
  return d
}

type Tower = [dx: number, width: number, height: number]

/**
 * Downtown silhouette, measured from the left edge. Heights are invented and
 * stylized; only the overall stepped profile is a cue.
 */
const TOWERS: Tower[] = [
  [-8, 176, 12],
  [0, 9, 26],
  [10, 13, 50],
  [24, 8, 38],
  [33, 15, 72],
  [49, 11, 60],
  [61, 17, 96],
  [64, 11, 106],
  [68.5, 2, 116],
  [79, 10, 68],
  [90, 14, 56],
  [105, 9, 84],
  [108.5, 2, 92],
  [115, 13, 46],
  [129, 8, 34],
  [138, 14, 26],
  [153, 9, 18],
]

export function skylinePath(x: number, ground: number, scale = 1): string {
  return TOWERS.map(
    ([dx, w, h]) => `M${r(x + dx * scale)} ${r(ground)}v${r(-h * scale)}h${r(w * scale)}v${r(h * scale)}Z`,
  ).join('')
}

export const SKYLINE_WIDTH = 168
