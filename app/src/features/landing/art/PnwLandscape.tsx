import { cn } from '@/components/ui/cn'
import { useId } from 'react'
import { ART, skylinePath, wavePath } from './geometry'
import { FirStand, SpaceNeedle, type FirSpec } from './parts'

const GROUND = 360
const NEEDLE_X = 134
const SKYLINE_X = 170

const RAINIER =
  'M110 302C196 284 262 236 318 186C344 162 366 140 384 128C392 122 402 120 410 121C420 122 428 126 436 132C458 150 486 178 520 208C560 244 604 270 660 286V330H110Z'
const SNOWCAP =
  'M332 175C352 157 370 139 386 127C394 121 404 120 412 121C422 123 432 128 440 135C460 152 476 168 492 184C482 181 474 189 463 183C453 177 446 191 434 185C424 179 417 195 404 187C392 181 384 197 372 189C362 183 352 193 344 185C339 181 336 178 332 175Z'
const MOUNTAIN_CONTOURS = [
  'M318 210C346 186 376 170 404 168C434 168 462 184 492 210',
  'M286 236C324 206 364 190 406 188C448 190 490 208 528 236',
  'M250 262C302 228 354 212 408 210C462 212 518 232 570 262',
  'M214 288C280 252 346 234 410 232C474 234 548 256 616 284',
]
const RIDGE_FAR =
  'M0 292C50 276 96 284 140 272C180 262 214 276 254 282C300 288 330 276 372 280C430 284 520 286 640 290V360H0Z'
const RIDGE_NEAR =
  'M0 322C70 306 140 316 200 310C260 304 300 318 360 314C430 309 480 296 540 300C590 303 620 310 640 306V360H0Z'
const SHORE =
  'M0 446C80 436 150 452 240 446C330 440 400 458 480 452C550 446 600 456 640 450V520H0Z'
const SHORE_LOW = 'M0 484C120 474 260 494 380 486C480 480 570 492 640 486V520H0Z'

const WATER_ROWS: [y: number, segments: [x: number, len: number][]][] = [
  [374, [[24, 120], [236, 150], [470, 130]]],
  [388, [[70, 180], [330, 80], [508, 100]]],
  [404, [[10, 90], [160, 160], [508, 104]]],
  [418, [[90, 140], [300, 210]]],
  [431, [[40, 110], [230, 120], [460, 150]]],
]

/** Evenly spaced small firs riding the near ridge line on the right. */
function ridgeTreeLine(): FirSpec[] {
  const ridgeY = (x: number) => (x < 540 ? 314 - ((x - 360) / 180) * 14 : 300 + ((x - 540) / 100) * 6)
  const trees: FirSpec[] = []
  for (let i = 0, x = 372; x < 640; i++, x += 10.5) {
    trees.push([x, ridgeY(x) + 6, 11 + ((i * 7) % 6)])
  }
  return trees
}

const FRONT_FIRS: FirSpec[] = [
  [560, 470, 150],
  [600, 476, 116],
  [530, 464, 94],
  [628, 472, 86],
  [506, 460, 62],
  [26, 472, 92],
  [54, 478, 68],
  [6, 470, 58],
]
const BACK_FIRS: FirSpec[] = [
  [582, 458, 106],
  [548, 452, 72],
  [614, 454, 82],
  [42, 460, 58],
  [76, 466, 44],
]

/**
 * Decorative Puget Sound view: Rainier behind the skyline, water, firs.
 * Not a map; nothing here is positioned from data.
 */
export function PnwLandscape({ className, animate = true }: { className?: string; animate?: boolean }) {
  const clipId = `ks-water-${useId().replace(/[^\w-]/g, '')}`
  let order = 0
  const draw = () =>
    animate ? { className: 'ks-draw', style: { animationDelay: `${120 + order++ * 70}ms` } } : {}

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 640 520"
      preserveAspectRatio="xMidYMid slice"
      className={cn('block h-full w-full', className)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y={GROUND} width="640" height="80" />
        </clipPath>
      </defs>

      <rect width="640" height="520" fill={ART.mistSoft} />
      <circle cx="520" cy="102" r="38" fill={ART.sandSoft} />
      <circle cx="520" cy="102" r="38" fill="none" stroke={ART.sand} strokeWidth="1" />

      <path d={RAINIER} fill={ART.mist} />
      <path d={SNOWCAP} fill={ART.surface} />
      <g fill="none" stroke={ART.deepBlue} strokeOpacity="0.2" strokeWidth="1" strokeLinecap="round">
        {MOUNTAIN_CONTOURS.map((d) => (
          <path key={d} d={d} pathLength={1} {...draw()} />
        ))}
      </g>
      <ellipse cx="410" cy="104" rx="58" ry="6.5" fill={ART.surface} opacity="0.92" />
      <ellipse cx="414" cy="95" rx="34" ry="4" fill={ART.surface} opacity="0.8" />

      <path d={RIDGE_FAR} fill={ART.land} />
      <path d={RIDGE_NEAR} fill={ART.evergreen} opacity="0.13" />
      <FirStand trees={ridgeTreeLine()} color={ART.evergreen} opacity={0.26} />

      <g fill={ART.deepBlue} opacity="0.34">
        <path d={skylinePath(SKYLINE_X, GROUND)} />
      </g>
      <SpaceNeedle x={NEEDLE_X} ground={GROUND} scale={0.94} color={ART.deepBlue} opacity={0.4} />
      <rect x="0" y={GROUND - 3} width="640" height="4" fill={ART.deepBlue} opacity="0.18" />

      <rect x="0" y={GROUND} width="640" height="100" fill={ART.water} />
      <g clipPath={`url(#${clipId})`} opacity="0.1">
        <g transform={`matrix(1 0 0 -0.55 0 ${GROUND * 1.55})`}>
          <path d={skylinePath(SKYLINE_X, GROUND)} fill={ART.deepBlue} />
          <SpaceNeedle x={NEEDLE_X} ground={GROUND} scale={0.94} color={ART.deepBlue} />
        </g>
      </g>
      <g fill="none" stroke={ART.deepBlue} strokeOpacity="0.24" strokeWidth="1.2" strokeLinecap="round">
        {WATER_ROWS.flatMap(([y, segments]) =>
          segments.map(([x, len]) => (
            <path key={`${x}-${y}`} d={wavePath(x, y, len, 30, 1.6)} pathLength={1} {...draw()} />
          )),
        )}
      </g>

      <g opacity="0.5">
        <path d="M434 398H486L480 404H440Z" fill={ART.deepBlue} />
        <rect x="444" y="391.5" width="30" height="6.5" rx="1" fill={ART.surface} stroke={ART.deepBlue} strokeWidth="1" />
        <rect x="456" y="387" width="4" height="4.5" fill={ART.deepBlue} />
        <path d="M428 401q-16 0-30 3M430 404q-12 0-22 3" fill="none" stroke={ART.surface} strokeWidth="1.2" strokeLinecap="round" />
      </g>

      <path d={SHORE} fill={ART.sand} />
      <path d={SHORE} fill="none" stroke={ART.deepBlue} strokeOpacity="0.14" strokeWidth="1" />
      <path d={SHORE_LOW} fill={ART.sandSoft} />

      <FirStand trees={BACK_FIRS} color={ART.evergreen} opacity={0.42} />
      <FirStand trees={FRONT_FIRS} color={ART.evergreen} opacity={0.88} />
    </svg>
  )
}