import { ART } from './art/geometry'

type Pt = [x: number, y: number]

const SELECTED: Pt = [210, 196]
const CONNECTED: Pt[] = [
  [214, 148],
  [176, 154],
  [166, 214],
  [204, 258],
  [230, 230],
  [160, 252],
]
const OTHERS: Pt[] = [
  [196, 72],
  [226, 320],
  [160, 360],
  [300, 92],
  [318, 172],
  [352, 238],
  [392, 182],
  [372, 342],
  [470, 112],
  [492, 202],
  [482, 302],
  [402, 62],
  [524, 254],
  [292, 382],
  [410, 260],
  [520, 360],
]

/** Schematic, not geographic: soft land/water shapes evoking the county. */
export function PreviewMap() {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 560 420"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 block h-full w-full"
    >
      <rect x="-200" y="-200" width="960" height="820" fill={ART.land} />
      <path
        d="M-200 -200H128C118 52 146 96 124 146C104 194 136 238 116 288C102 330 122 378 108 620H-200Z"
        fill={ART.water}
      />
      <path d="M40 250C54 236 70 244 66 272C62 300 48 320 38 304C30 290 30 262 40 250Z" fill={ART.land} />
      <path
        d="M252 36C268 66 262 118 270 160C278 210 266 262 274 312C278 340 262 356 252 336C242 296 254 244 244 194C236 144 240 92 234 58C232 40 244 28 252 36Z"
        fill={ART.water}
      />
      <path d="M255 200C263 206 263 236 259 250C255 258 249 246 249 230C249 214 251 198 255 200Z" fill={ART.land} />
      <path
        d="M430 150C442 168 440 206 446 236C450 256 438 264 432 250C424 230 430 196 424 172C420 156 424 142 430 150Z"
        fill={ART.water}
      />
      <g fill={ART.evergreenSoft}>
        <ellipse cx="190" cy="100" rx="24" ry="14" />
        <ellipse cx="360" cy="300" rx="34" ry="20" />
        <ellipse cx="500" cy="80" rx="30" ry="18" />
        <ellipse cx="320" cy="40" rx="20" ry="12" />
      </g>
      <g fill="none" stroke={ART.surface} strokeLinecap="round">
        <g strokeWidth="1.4" opacity="0.8">
          <path d="M140 300C200 296 240 306 300 300" />
          <path d="M290 60C330 70 380 56 460 66" />
          <path d="M380 380C420 340 470 330 560 320" />
          <path d="M470 0C466 60 480 120 470 180" />
          <path d="M140 40C170 46 200 38 236 44" />
        </g>
        <g strokeWidth="3.2">
          <path d="M184 -20C176 80 192 160 180 240C170 300 186 360 178 440" />
          <path d="M130 214C200 212 230 218 300 214C360 210 400 220 600 216" />
          <path d="M338 -20C334 90 346 170 336 260C330 330 342 380 338 440" />
          <path d="M184 126C220 128 236 120 300 124C340 126 380 118 420 124" />
        </g>
      </g>

      <g fill={ART.evergreen} stroke={ART.surface} strokeWidth="1.5">
        {OTHERS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5" opacity="0.55" />
        ))}
      </g>
      <g fill="none" stroke={ART.clay} strokeWidth="1.6" strokeDasharray="4 3.5" strokeLinecap="round">
        {CONNECTED.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${SELECTED[0]} ${SELECTED[1]}L${x} ${y}`} />
        ))}
      </g>
      <g fill={ART.surface} stroke={ART.clay} strokeWidth="2">
        {CONNECTED.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" />
        ))}
      </g>
      <circle cx={SELECTED[0]} cy={SELECTED[1]} r="21" fill={ART.evergreen} opacity="0.12" />
      <circle cx={SELECTED[0]} cy={SELECTED[1]} r="12" fill={ART.surface} stroke={ART.evergreen} strokeWidth="3" />
      <circle cx={SELECTED[0]} cy={SELECTED[1]} r="4.5" fill={ART.evergreen} />
    </svg>
  )
}
