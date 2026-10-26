import { firPath } from './geometry'

type ColorProps = { color: string; opacity?: number }

/** Space Needle cue, drawn 130 units tall from its base at (x, ground). */
export function SpaceNeedle({ x, ground, scale = 1, color, opacity = 1 }: ColorProps & { x: number; ground: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${ground}) scale(${scale})`} fill={color} stroke={color} opacity={opacity}>
      <rect x={-0.8} y={-130} width={1.6} height={25} stroke="none" />
      <path d="M-6 -106H6L8 -101H-8Z" stroke="none" />
      <path d="M-24 -101H24L19 -94.5H-19Z" stroke="none" />
      <path d="M-15 -94.5H15L9 -88.5H-9Z" stroke="none" />
      <rect x={-1.5} y={-89} width={3} height={89} stroke="none" />
      <g fill="none" strokeLinecap="round">
        <path d="M-8 -89C-3 -62 -2 -52 -3 -44C-4 -30 -8 -14 -11.5 0" strokeWidth={2.3} />
        <path d="M8 -89C3 -62 2 -52 3 -44C4 -30 8 -14 11.5 0" strokeWidth={2.3} />
        <path d="M-5 -44H5" strokeWidth={1.6} />
        <path d="M-14 0H14" strokeWidth={2} />
      </g>
    </g>
  )
}

export type FirSpec = [x: number, base: number, height: number]

/** A stand of firs in one fill, so overlaps never double the opacity. */
export function FirStand({ trees, color, opacity = 1 }: ColorProps & { trees: FirSpec[] }) {
  return <path d={trees.map(([x, base, h]) => firPath(x, base, h)).join('')} fill={color} opacity={opacity} />
}
