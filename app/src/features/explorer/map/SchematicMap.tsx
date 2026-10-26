import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/components/ui/cn'
import type { Neighbor, PropertyRecord } from '@/services/types'
import { markerLabel, neighborLabel } from '../recordText'
import { MapControls } from './MapControls'
import type { MapEngineProps } from './mapTypes'
import { MarkerTooltip } from './MarkerTooltip'
import { SCHEMATIC_ISLANDS, SCHEMATIC_WATER } from './schematicGeography'
import {
  centerOn,
  defaultView,
  fitPoints,
  panBy,
  clusterScreenPoints,
  createProjection,
  MAX_ZOOM,
  MIN_ZOOM,
  ringToPath,
  zoomAround,
  type Bounds,
  type View,
  type Viewport,
} from './schematicProjection'
import { useElementSize } from './useElementSize'

const CLUSTER_CELL_PX = 42
const SELECT_ZOOM = 3
const DRAG_THRESHOLD_PX = 4

type Active =
  | { kind: 'record'; record: PropertyRecord }
  | { kind: 'neighbor'; neighbor: Neighbor }
  | null

type Drag = { pointerId: number; x: number; y: number; start: View; moved: boolean }

function activateOnKey(e: KeyboardEvent, action: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    action()
  }
}

/** Offline SVG fallback: same selection, neighbor, and placement behavior, no basemap. */
export function SchematicMap({
  coverage,
  records,
  selected,
  draft,
  overlay,
  inspectedId,
  mode,
  resetToken,
  insetLeft,
  insetBottom,
  reducedMotion,
  onSelect,
  onPlaceDraft,
  onInspectNeighbor,
  onReset,
}: MapEngineProps) {
  const containerRef = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const size = useElementSize(containerRef)
  const bounds = coverage.bounds as Bounds
  const [view, setViewState] = useState<View>(() => defaultView(bounds))
  const viewRef = useRef(view)
  const frameRef = useRef<number | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [active, setActive] = useState<Active>(null)
  const [dragging, setDragging] = useState(false)

  const viewport = useMemo<Viewport>(
    () => ({
      width: size.width,
      height: size.height,
      padding: { top: 72, right: 28, bottom: 44, left: insetLeft + 28 },
      focusBottom: insetBottom,
    }),
    [size.width, size.height, insetLeft, insetBottom],
  )
  const projection = useMemo(() => createProjection(bounds, viewport, view), [bounds, viewport, view])
  const creating = mode === 'create'
  const hasSize = size.width > 0 && size.height > 0

  const setView = useCallback((next: View) => {
    viewRef.current = next
    setViewState(next)
  }, [])

  const animateTo = useCallback(
    (target: View) => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      const from = viewRef.current
      if (reducedMotion) {
        setView(target)
        return
      }
      const start = performance.now()
      const duration = 220
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const e = 1 - (1 - t) ** 3
        setView({
          zoom: from.zoom * (target.zoom / from.zoom) ** e,
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
        })
        frameRef.current = t < 1 ? requestAnimationFrame(step) : null
      }
      frameRef.current = requestAnimationFrame(step)
    },
    [reducedMotion, setView],
  )

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  // Reset map: back to the full coverage extent.
  const lastReset = useRef(resetToken)
  useEffect(() => {
    if (lastReset.current === resetToken) return
    lastReset.current = resetToken
    animateTo(defaultView(bounds))
  }, [resetToken, animateTo, bounds])

  // Center on a newly selected property once the map has a size to frame it in.
  const latest = useRef({ bounds, viewport, selected })
  useLayoutEffect(() => {
    latest.current = { bounds, viewport, selected }
  })
  const selectedId = selected?.id ?? null
  useEffect(() => {
    if (!selectedId || !hasSize) return
    const { bounds: b, selected: record } = latest.current
    if (!record) return
    animateTo(centerOn(b, record.longitude, record.latitude, Math.max(viewRef.current.zoom, SELECT_ZOOM)))
  }, [selectedId, hasSize, animateTo])

  // Frame the target and its connected homes when a new set of connections appears.
  const latestOverlay = useRef(overlay)
  useLayoutEffect(() => {
    latestOverlay.current = overlay
  })
  const fitState = useRef<{ key: string | null; interacted: boolean }>({ key: null, interacted: false })
  const markInteracted = () => {
    fitState.current.interacted = true
  }
  const overlayKey = overlay
    ? `${overlay.origin.latitude},${overlay.origin.longitude}:${overlay.neighbors.map((n) => n.property.id).join(',')}`
    : null
  useEffect(() => {
    const current = latestOverlay.current
    if (!overlayKey || !hasSize || !current || current.neighbors.length === 0) return
    // Re-frame when floating cards change size, unless the user has moved the map since.
    if (fitState.current.key === overlayKey && fitState.current.interacted) return
    fitState.current = { key: overlayKey, interacted: false }
    const { bounds: b, viewport: vp } = latest.current
    animateTo(fitPoints(b, { ...vp, focusBottom: insetBottom }, [current.origin, ...current.neighbors.map((n) => n.property)]))
  }, [overlayKey, hasSize, insetBottom, animateTo])

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      fitState.current.interacted = true
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const { bounds: b, viewport: vp } = latest.current
      setView(zoomAround(b, vp, viewRef.current, Math.exp(-e.deltaY * 0.0022), e.clientX - rect.left, e.clientY - rect.top))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [setView])

  const zoomBy = (factor: number) => {
    markInteracted()
    const p = viewport.padding
    const cx = p.left + (viewport.width - p.left - p.right) / 2
    const cy = p.top + (viewport.height - p.top - p.bottom) / 2
    animateTo(zoomAround(bounds, viewport, viewRef.current, factor, cx, cy))
  }

  const zoomIntoCluster = (x: number, y: number) => {
    markInteracted()
    const target = projection.unproject(x, y)
    animateTo(centerOn(bounds, target.longitude, target.latitude, view.zoom * 2.5))
  }

  const localPoint = (e: PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    if (!creating && (e.target as Element).closest('[data-marker]')) return
    const v = viewRef.current
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, start: v, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    if (!drag.moved) {
      drag.moved = true
      markInteracted()
      setDragging(true)
      setActive(null)
    }
    setView(panBy(bounds, viewport, drag.start, dx, dy))
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (!drag.moved && creating) {
      const { x, y } = localPoint(e)
      onPlaceDraft(projection.unproject(x, y))
    }
  }

  // Markers: neighbors and the selection are drawn separately, never clustered away.
  const neighborIds = useMemo(() => new Set(overlay?.neighbors.map((n) => n.property.id) ?? []), [overlay])
  const clusters = useMemo(() => {
    if (!hasSize) return []
    const points = records
      .filter((r) => r.id !== selectedId && !neighborIds.has(r.id))
      .map((item) => {
        const [x, y] = projection.project(item.longitude, item.latitude)
        return { item, x, y }
      })
      .filter((p) => p.x > -40 && p.y > -40 && p.x < size.width + 40 && p.y < size.height + 40)
    return clusterScreenPoints(points, CLUSTER_CELL_PX)
  }, [records, selectedId, neighborIds, projection, hasSize, size.width, size.height])

  const origin = overlay ? projection.project(overlay.origin.longitude, overlay.origin.latitude) : null
  const selectedPoint = selected ? projection.project(selected.longitude, selected.latitude) : null
  const draftPoint = draft ? projection.project(draft.longitude, draft.latitude) : null

  const activePoint = (() => {
    if (!active) return null
    const record = active.kind === 'record' ? active.record : active.neighbor.property
    const [x, y] = projection.project(record.longitude, record.latitude)
    return { record, x, y }
  })()

  const coveragePath = ringToPath(coverage.polygon, projection)

  return (
    <section
      ref={containerRef}
      aria-label={
        creating
          ? 'Schematic map. Click inside the map to place your new property.'
          : 'Schematic property map. The property list shows the same records.'
      }
      className="absolute inset-0 overflow-hidden bg-sand-soft"
    >
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className={cn(
          'block touch-none select-none',
          creating ? 'cursor-crosshair' : dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null
          setDragging(false)
        }}
      >
        {hasSize && (
          <>
            <path d={coveragePath} fill="var(--color-land)" />
            <g aria-hidden>
              {SCHEMATIC_WATER.map((w) => (
                <path key={w.name} d={ringToPath(w.ring, projection)} fill="var(--color-water)" />
              ))}
              {SCHEMATIC_ISLANDS.map((w) => (
                <path key={w.name} d={ringToPath(w.ring, projection)} fill="var(--color-land)" />
              ))}
              <WaterLabels projection={projection} zoom={view.zoom} />
            </g>
            <path
              d={coveragePath}
              fill="none"
              stroke="var(--color-evergreen)"
              strokeOpacity={creating ? 0.9 : 0.35}
              strokeWidth={creating ? 2.5 : 1.25}
              strokeDasharray={creating ? '7 5' : undefined}
              strokeLinejoin="round"
              aria-hidden
            />

            {origin && overlay && (
              <g aria-hidden>
                {overlay.neighbors.map((n) => {
                  const [x, y] = projection.project(n.property.longitude, n.property.latitude)
                  return (
                    <line
                      key={n.property.id}
                      x1={origin[0]}
                      y1={origin[1]}
                      x2={x}
                      y2={y}
                      stroke="var(--color-clay)"
                      strokeOpacity={0.8}
                      strokeWidth={n.property.id === inspectedId ? 2.5 : 1.5}
                      strokeDasharray={n.edge_type === 'similarity' ? '5 4' : undefined}
                    />
                  )
                })}
              </g>
            )}

            <g>
              {clusters.map((c) => {
                const only = c.members.length === 1 ? c.members[0]!.item : null
                if (only) {
                  return (
                    <MapMarker
                      key={only.id}
                      x={c.x}
                      y={c.y}
                      label={markerLabel(only)}
                      interactive={!creating}
                      onActivate={() => onSelect(only.id)}
                      onActiveChange={(on) => setActive(on ? { kind: 'record', record: only } : null)}
                    >
                      <circle r={16} fill="transparent" />
                      {activePoint?.record.id === only.id && (
                        <circle r={11} fill="none" stroke="var(--color-evergreen)" strokeWidth={2} />
                      )}
                      <circle r={6.5} fill="var(--color-evergreen)" fillOpacity={creating ? 0.45 : 0.9} stroke="#fffefa" strokeWidth={1.75} />
                    </MapMarker>
                  )
                }
                const r = Math.min(24, 13 + Math.sqrt(c.members.length) * 2.4)
                return (
                  <MapMarker
                    key={`c${c.key}`}
                    x={c.x}
                    y={c.y}
                    label={`${c.members.length} properties here. Zoom in to separate them.`}
                    interactive={!creating}
                    onActivate={() => zoomIntoCluster(c.x, c.y)}
                    onActiveChange={() => setActive(null)}
                  >
                    <circle r={r + 4} fill="var(--color-evergreen)" fillOpacity={0.14} />
                    <circle r={r} fill="#fffefa" stroke="var(--color-evergreen)" strokeWidth={2} opacity={creating ? 0.6 : 1} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-ink text-[12px] font-semibold tabular"
                      aria-hidden
                    >
                      {c.members.length}
                    </text>
                  </MapMarker>
                )
              })}
            </g>

            {overlay && (
              <g>
                {overlay.neighbors.map((n) => {
                  const [x, y] = projection.project(n.property.longitude, n.property.latitude)
                  const inspected = n.property.id === inspectedId
                  const s = inspected ? 9 : 6.5
                  return (
                    <MapMarker
                      key={n.property.id}
                      x={x}
                      y={y}
                      label={neighborLabel(n)}
                      interactive={!creating}
                      onActivate={() => onInspectNeighbor(n)}
                      onActiveChange={(on) => setActive(on ? { kind: 'neighbor', neighbor: n } : null)}
                    >
                      <circle r={16} fill="transparent" />
                      {(inspected || activePoint?.record.id === n.property.id) && (
                        <rect x={-s - 5} y={-s - 5} width={(s + 5) * 2} height={(s + 5) * 2} rx={5} fill="none" stroke="var(--color-clay)" strokeWidth={2} />
                      )}
                      <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={3} fill="var(--color-clay)" stroke="#fffefa" strokeWidth={1.75} />
                    </MapMarker>
                  )
                })}
              </g>
            )}

            {selected && selectedPoint && (
              <MapMarker
                x={selectedPoint[0]}
                y={selectedPoint[1]}
                label={markerLabel(selected, { selected: true })}
                interactive={!creating}
                onActivate={() => onSelect(selected.id)}
                onActiveChange={(on) => setActive(on ? { kind: 'record', record: selected } : null)}
              >
                <circle r={20} fill="var(--color-evergreen)" fillOpacity={0.16} />
                <circle r={11} fill="#fffefa" stroke="var(--color-evergreen)" strokeWidth={3.5} />
                <circle r={4.5} fill="var(--color-evergreen)" />
              </MapMarker>
            )}

            {draftPoint && (
              <g transform={`translate(${draftPoint[0].toFixed(1)} ${draftPoint[1].toFixed(1)})`} aria-hidden>
                <DraftPin />
              </g>
            )}
          </>
        )}
      </svg>

      {selected && selectedPoint && hasSize && (
        <MarkerLabel x={selectedPoint[0]} y={selectedPoint[1] + 18} tone="selected">
          {selected.id}
        </MarkerLabel>
      )}
      {draftPoint && hasSize && (
        <MarkerLabel x={draftPoint[0]} y={draftPoint[1] + 8} tone="draft">
          New property
        </MarkerLabel>
      )}
      {activePoint && !dragging && (
        <MarkerTooltip
          record={activePoint.record}
          x={activePoint.x}
          y={activePoint.y}
          containerWidth={size.width}
          lift={18}
          note={
            active?.kind === 'neighbor'
              ? active.neighbor.property.role === 'held_out_example'
                ? 'Connected home · select to see its context'
                : 'Connected home · reference only'
              : undefined
          }
        />
      )}

      <MapControls
        className="absolute top-3 right-3 z-10"
        onZoomIn={() => zoomBy(2)}
        onZoomOut={() => zoomBy(0.5)}
        onReset={onReset}
        canZoomIn={view.zoom < MAX_ZOOM}
        canZoomOut={view.zoom > MIN_ZOOM + 0.001}
      />
      <p className="pointer-events-none absolute right-3 bottom-3 z-10 max-w-[calc(100%-1.5rem)] rounded-full border border-border bg-surface/95 px-3 py-1 text-[0.75rem] font-medium text-ink-muted shadow-soft">
        Schematic map · offline preview, not a geographic basemap
      </p>
    </section>
  )
}

type MapMarkerProps = {
  x: number
  y: number
  label: string
  interactive: boolean
  onActivate: () => void
  onActiveChange: (active: boolean) => void
  children: ReactNode
}

/** A focusable SVG marker; inert while placing a new property so clicks reach the map. */
function MapMarker({ x, y, label, interactive, onActivate, onActiveChange, children }: MapMarkerProps) {
  const transform = `translate(${x.toFixed(1)} ${y.toFixed(1)})`
  if (!interactive) {
    return (
      <g transform={transform} aria-hidden>
        {children}
      </g>
    )
  }
  const a11y = { role: 'button', tabIndex: 0, 'aria-label': label, 'data-marker': true }
  return (
    <g
      transform={transform}
      {...a11y}
      className="cursor-pointer outline-none"
      onClick={onActivate}
      onKeyDown={(e) => activateOnKey(e, onActivate)}
      onPointerEnter={() => onActiveChange(true)}
      onPointerLeave={() => onActiveChange(false)}
      onFocus={() => onActiveChange(true)}
      onBlur={() => onActiveChange(false)}
    >
      {children}
    </g>
  )
}

function MarkerLabel({ x, y, tone, children }: { x: number; y: number; tone: 'selected' | 'draft'; children: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-10 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap shadow-soft',
        tone === 'selected' ? 'bg-evergreen text-white' : 'border border-ink bg-surface text-ink',
      )}
      style={{ left: x, top: y }}
    >
      {children}
    </span>
  )
}

/** Teardrop pin, distinct in shape from the round property markers. */
function DraftPin() {
  return (
    <g>
      <ellipse cx={0} cy={1} rx={6} ry={2.5} fill="var(--color-ink)" fillOpacity={0.2} />
      <path d="M0 0 C-3 -7 -11 -12 -11 -21 a11 11 0 0 1 22 0 c0 9 -8 14 -11 21Z" fill="var(--color-ink)" stroke="#fffefa" strokeWidth={1.75} />
      <rect x={-4} y={-25} width={8} height={8} rx={1.5} fill="#fffefa" />
    </g>
  )
}

function WaterLabels({ projection, zoom }: { projection: ReturnType<typeof createProjection>; zoom: number }) {
  const labels: { text: string; at: [number, number]; minZoom: number }[] = [
    { text: 'Puget Sound', at: [-122.5, 47.62], minZoom: 1 },
    { text: 'Lake Washington', at: [-122.236, 47.66], minZoom: 2 },
    { text: 'Lake Sammamish', at: [-122.08, 47.6], minZoom: 3 },
  ]
  return (
    <>
      {labels
        .filter((l) => zoom >= l.minZoom)
        .map((l) => {
          const [x, y] = projection.project(l.at[0], l.at[1])
          return (
            <text
              key={l.text}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-deep-blue text-[11px] italic"
              fillOpacity={0.75}
              transform={l.text === 'Lake Washington' ? `rotate(-72 ${x} ${y})` : undefined}
            >
              {l.text}
            </text>
          )
        })}
    </>
  )
}
