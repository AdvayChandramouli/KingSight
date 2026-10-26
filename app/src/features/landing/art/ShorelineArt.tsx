import { cn } from '@/components/ui/cn'
import { ART, skylinePath, wavePath } from './geometry'
import { FirStand, SpaceNeedle, type FirSpec } from './parts'

const GROUND = 120
/** Bands run this far left of the viewBox so wide containers never show an edge. */
const BLEED = -1800

const tones = {
  light: {
    sky: ART.mistSoft,
    mountain: ART.mist,
    mountainOpacity: 1,
    ridge: ART.land,
    ridgeOpacity: 1,
    city: ART.deepBlue,
    cityOpacity: 0.34,
    water: ART.water,
    waterOpacity: 1,
    line: ART.deepBlue,
    lineOpacity: 0.24,
    shore: ART.sand,
    shoreOpacity: 1,
    tree: ART.evergreen,
    treeOpacity: 0.85,
  },
  dark: {
    sky: 'none',
    mountain: '#FFFFFF',
    mountainOpacity: 0.07,
    ridge: '#FFFFFF',
    ridgeOpacity: 0.06,
    city: '#FFFFFF',
    cityOpacity: 0.16,
    water: '#FFFFFF',
    waterOpacity: 0.05,
    line: '#FFFFFF',
    lineOpacity: 0.2,
    shore: '#26473B',
    shoreOpacity: 0.7,
    tree: '#1D382F',
    treeOpacity: 0.85,
  },
}

const FIRS: FirSpec[] = [
  [560, 178, 92],
  [592, 182, 70],
  [536, 174, 58],
  [622, 180, 60],
  [30, 180, 58],
  [52, 184, 42],
  [-380, 180, 64],
  [-352, 184, 46],
  [-900, 182, 52],
  [-1240, 180, 70],
  [-1212, 184, 50],
]

/** Rows of wave segments, repeated leftward across the bleed. */
function waterLines(): [x: number, y: number, len: number][] {
  const rows: [y: number, offset: number][] = [
    [132, 40],
    [145, 100],
    [158, 20],
  ]
  const lines: [number, number, number][] = []
  rows.forEach(([y, offset], r) => {
    for (let x = offset, i = 0; x < 600; x += 200 + ((i * 37 + r * 19) % 60), i++) {
      lines.push([x, y, 90 + ((i * 53 + r * 29) % 70)])
    }
    for (let x = offset - 220, i = 0; x > BLEED; x -= 200 + ((i * 41 + r * 23) % 60), i++) {
      lines.push([x, y, 90 + ((i * 47 + r * 31) % 70)])
    }
  })
  return lines
}

const WATER = waterLines()

/** A low strip of the landscape: skyline, water lines, and firs, anchored bottom right. */
export function ShorelineArt({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const t = tones[tone]
  const width = 640 - BLEED
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 640 200"
      preserveAspectRatio="xMaxYMax meet"
      className={cn('block h-full w-full', className)}
    >
      {t.sky !== 'none' && <rect x={BLEED} y="-400" width={width} height="600" fill={t.sky} />}
      <path
        d="M286 104C340 82 374 56 396 46C406 41 416 41 426 47C452 62 486 86 540 104Z"
        fill={t.mountain}
        opacity={t.mountainOpacity}
      />
      <path
        d={`M${BLEED} 94C-1400 86-1200 98-1000 90C-800 84-600 96-400 90C-200 86-100 96 0 98C80 86 150 94 220 88C300 82 360 94 440 90C520 86 580 92 640 88V120H${BLEED}Z`}
        fill={t.ridge}
        opacity={t.ridgeOpacity}
      />
      <g opacity={t.cityOpacity} fill={t.city}>
        <path d={skylinePath(122, GROUND, 0.58)} />
      </g>
      <SpaceNeedle x={100} ground={GROUND} scale={0.6} color={t.city} opacity={Math.min(1, t.cityOpacity + 0.06)} />
      <rect x={BLEED} y={GROUND} width={width} height="60" fill={t.water} opacity={t.waterOpacity} />
      <g fill="none" stroke={t.line} strokeOpacity={t.lineOpacity} strokeWidth="1.2" strokeLinecap="round">
        {WATER.map(([x, y, len]) => (
          <path key={`${x}-${y}`} d={wavePath(x, y, len, 28, 1.5)} />
        ))}
      </g>
      <path
        d={`M${BLEED} 172C-1500 166-1200 178-900 172C-600 166-300 178 0 172C120 164 260 178 400 172C500 168 580 176 640 172V200H${BLEED}Z`}
        fill={t.shore}
        opacity={t.shoreOpacity}
      />
      <FirStand trees={FIRS} color={t.tree} opacity={t.treeOpacity} />
    </svg>
  )
}
