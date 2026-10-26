import { ART, wavePath } from './geometry'

type Lot = { x: number; y: number; w: number; h: number; house: [number, number, number, number]; kind: Kind }
type Kind = 'target' | 'connected' | 'plain'

const COLS: [x: number, w: number][] = [
  [36, 104],
  [150, 94],
  [282, 100],
  [392, 92],
]
const ROWS: [y: number, h: number][] = [
  [36, 100],
  [166, 110],
  [306, 98],
]
const CONNECTED = new Set(['0,0', '1,0', '0,1', '2,1', '0,2', '1,2'])

function buildLots(): Lot[] {
  const lots: Lot[] = []
  ROWS.forEach(([y, h], r) =>
    COLS.forEach(([x, w], c) => {
      if (r === 2 && c === 3) return
      const i = r * 4 + c
      const target = r === 1 && c === 1
      const hw = target ? 50 : 38 + ((i * 13) % 14)
      const hh = target ? 40 : 28 + ((i * 7) % 10)
      const hx = x + (w - hw) / 2 + (target ? 0 : ((i * 5) % 9) - 4)
      const hy = y + (h - hh) / 2 + (target ? -4 : ((i * 3) % 7) - 3)
      const kind: Kind = target ? 'target' : CONNECTED.has(`${c},${r}`) ? 'connected' : 'plain'
      lots.push({ x, y, w, h, house: [hx, hy, hw, hh], kind })
    }),
  )
  return lots
}

const LOTS = buildLots()
const TARGET = LOTS.find((l) => l.kind === 'target')!
const [tx, ty, tw, th] = TARGET.house
const CENTER = { x: tx + tw / 2, y: ty + th / 2 }
const center = (l: Lot) => ({ x: l.house[0] + l.house[2] / 2, y: l.house[1] + l.house[3] / 2 })

const CANOPIES: [x: number, y: number, r: number][] = [
  [48, 50, 8],
  [128, 124, 7],
  [160, 46, 6],
  [236, 128, 8],
  [294, 52, 7],
  [372, 128, 9],
  [404, 48, 6],
  [474, 126, 7],
  [48, 262, 7],
  [236, 176, 6],
  [294, 266, 8],
  [474, 180, 7],
  [130, 318, 7],
  [160, 394, 8],
  [372, 318, 6],
]

/** Plan-view sketch of one block: the home, its coordinates, its graph links. */
export function ContextDiagram() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 520 440" className="block h-auto w-full">
      <rect width="520" height="440" fill={ART.sandSoft} />
      <path d="M396 440C412 404 452 382 520 370V440Z" fill={ART.water} />
      <g fill="none" stroke={ART.deepBlue} strokeOpacity="0.25" strokeWidth="1.1" strokeLinecap="round">
        <path d={wavePath(440, 404, 60, 20, 1.2)} />
        <path d={wavePath(420, 420, 90, 20, 1.2)} />
      </g>

      {LOTS.map((l) => (
        <rect key={`${l.x}-${l.y}`} x={l.x} y={l.y} width={l.w} height={l.h} rx="7" fill={ART.land} />
      ))}
      <g fill={ART.evergreen} opacity="0.16">
        {CANOPIES.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>

      <g stroke={ART.deepBlue} strokeOpacity="0.45" strokeWidth="1">
        {Array.from({ length: 19 }, (_, i) => (
          <path key={`t${i}`} d={`M${18 + i * 26} 0v${i % 4 === 0 ? 9 : 5}`} />
        ))}
        {Array.from({ length: 16 }, (_, i) => (
          <path key={`l${i}`} d={`M0 ${18 + i * 26}h${i % 4 === 0 ? 9 : 5}`} />
        ))}
      </g>
      <g stroke={ART.deepBlue} strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="3 4">
        <path d={`M${CENTER.x} 12V${ty - 6}`} />
        <path d={`M12 ${CENTER.y}H${tx - 6}`} />
      </g>

      <g fill="none" stroke={ART.clay} strokeWidth="1.8" strokeDasharray="5 4" strokeLinecap="round">
        {LOTS.filter((l) => l.kind === 'connected').map((l) => {
          const c = center(l)
          return <path key={`${l.x}-${l.y}`} d={`M${CENTER.x} ${CENTER.y}L${c.x} ${c.y}`} />
        })}
      </g>

      {LOTS.map((l) => {
        const [x, y, w, h] = l.house
        if (l.kind === 'target') return null
        return (
          <rect
            key={`h${l.x}-${l.y}`}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="3"
            fill={l.kind === 'connected' ? ART.claySoft : ART.surface}
            stroke={l.kind === 'connected' ? ART.clay : '#D8D8CE'}
            strokeWidth={l.kind === 'connected' ? 2 : 1.2}
          />
        )
      })}

      <rect x={tx} y={ty} width={tw} height={th} rx="3" fill={ART.evergreen} />
      <path d={`M${tx + 6} ${ty + th / 2}H${tx + tw - 6}`} stroke={ART.surface} strokeOpacity="0.5" strokeWidth="1" />
      <g stroke={ART.evergreen} strokeWidth="1.3" fill="none">
        <path d={`M${tx} ${ty + th + 9}H${tx + tw}M${tx} ${ty + th + 5}v8M${tx + tw} ${ty + th + 5}v8`} />
        <path d={`M${tx + tw + 9} ${ty}V${ty + th}M${tx + tw + 5} ${ty}h8M${tx + tw + 5} ${ty + th}h8`} />
      </g>
      <circle cx={CENTER.x} cy={CENTER.y} r="4.5" fill={ART.surface} stroke={ART.deepBlue} strokeWidth="1.6" />
    </svg>
  )
}
