import {
  Map as MapLibre,
  Marker,
  type GeoJSONSource,
  type LayerSpecification,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import type { FeatureCollection as GeoFeatureCollection, Geometry } from 'geojson'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { config } from '@/app/config'
import type { PropertyRecord } from '@/services/types'
import { MapControls } from './MapControls'
import { MAP_STYLE_LOAD_TIMEOUT_MS } from './mapEngine'
import type { MapEngineProps } from './mapTypes'
import './maplibreSetup'
import { MarkerTooltip } from './MarkerTooltip'
import { useElementSize } from './useElementSize'

const SELECT_ZOOM = 12.5

/** Current token hexes, used only when a CSS variable has not been painted yet. */
const FALLBACK = {
  ink: '#203a32',
  surface: '#fffefa',
  clay: '#9a654a',
  deepBlue: '#38596d',
  water: '#c9dce3',
  land: '#e6ebdd',
}

type Palette = {
  ink: string
  surface: string
  clay: string
  brass: string
  water: string
  waterLine: string
  land: string
}

function cssColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Reads the live tokens so a foundations retune reaches the basemap without a second palette. */
function palette(): Palette {
  const ink = cssColor('--color-ink', FALLBACK.ink)
  return {
    ink,
    surface: cssColor('--color-surface', FALLBACK.surface),
    clay: cssColor('--color-clay', FALLBACK.clay),
    brass: cssColor('--color-brass', ink),
    water: cssColor('--color-water', FALLBACK.water),
    waterLine: cssColor('--color-deep-blue', FALLBACK.deepBlue),
    land: cssColor('--color-land', FALLBACK.land),
  }
}

type Hover = { kind: 'record' | 'neighbor'; id: string } | null

type FeatureCollection = GeoFeatureCollection<Geometry, { id: string; [key: string]: unknown }>

function points(records: PropertyRecord[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: records.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: { id: r.id },
    })),
  }
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Cooler land and darker water through the existing basemap paint hook. */
function restyleBasemap(map: MapLibre) {
  const color = palette()
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id.toLowerCase()
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', color.land)
      else if (layer.type === 'fill' && /water|ocean|lake|river|reservoir/.test(id))
        map.setPaintProperty(layer.id, 'fill-color', color.water)
      else if (layer.type === 'fill' && /park|wood|forest|grass|landcover|green|nature|scrub|wetland/.test(id))
        map.setPaintProperty(layer.id, 'fill-color', color.land)
      else if (layer.type === 'line' && /water|river|stream|canal/.test(id))
        map.setPaintProperty(layer.id, 'line-color', color.waterLine)
      else if (layer.type === 'line' && /road|highway|street|path|bridge|tunnel|rail|motorway/.test(id))
        map.setPaintProperty(layer.id, 'line-opacity', 0.5)
    } catch {
      // Some styles use expressions we should not override; skip those layers.
    }
  }
}

function findTextFont(map: MapLibre): string[] | null {
  if (!map.getStyle().glyphs) return null
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue
    const font: unknown = layer.layout?.['text-font']
    if (Array.isArray(font) && font.every((f) => typeof f === 'string')) return font as string[]
    if (Array.isArray(font) && font[0] === 'literal' && Array.isArray(font[1])) return font[1] as string[]
  }
  return null
}

/** Rounded-square icon so connected homes differ from round markers by shape, not color alone. */
function neighborIcon(color: Palette): ImageData | null {
  const ratio = 2
  const size = 18 * ratio
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = color.clay
  ctx.strokeStyle = color.surface
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.roundRect(3.5, 3.5, size - 7, size - 7, 6)
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function addOverlay(map: MapLibre, coverage: MapEngineProps['coverage']) {
  const color = palette()
  map.addSource('ks-coverage', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coverage.polygon] }, properties: {} },
  })
  map.addSource('ks-edges', { type: 'geojson', data: EMPTY })
  map.addSource('ks-properties', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 14 })
  map.addSource('ks-neighbors', { type: 'geojson', data: EMPTY })

  const icon = neighborIcon(color)
  if (icon) map.addImage('ks-neighbor', icon, { pixelRatio: 2 })
  const font = findTextFont(map)

  const layers: LayerSpecification[] = [
    { id: 'ks-coverage-fill', type: 'fill', source: 'ks-coverage', paint: { 'fill-color': color.ink, 'fill-opacity': 0.03 } },
    {
      id: 'ks-coverage-line',
      type: 'line',
      source: 'ks-coverage',
      paint: { 'line-color': color.ink, 'line-opacity': 0.45, 'line-width': 1.25 },
    },
    {
      id: 'ks-edges-solid',
      type: 'line',
      source: 'ks-edges',
      filter: ['!=', ['get', 'edge_type'], 'similarity'],
      paint: { 'line-color': color.clay, 'line-opacity': 0.85, 'line-width': ['case', ['get', 'inspected'], 2.75, 1.6] },
    },
    {
      id: 'ks-edges-dashed',
      type: 'line',
      source: 'ks-edges',
      filter: ['==', ['get', 'edge_type'], 'similarity'],
      paint: {
        'line-color': color.clay,
        'line-opacity': 0.85,
        'line-width': ['case', ['get', 'inspected'], 2.75, 1.6],
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'ks-cluster-halo',
      type: 'circle',
      source: 'ks-properties',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': color.ink,
        'circle-opacity': 0.12,
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 24, 25, 28],
      },
    },
    {
      id: 'ks-clusters',
      type: 'circle',
      source: 'ks-properties',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': color.surface,
        'circle-stroke-color': color.ink,
        'circle-stroke-width': 2,
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 18, 25, 21],
      },
    },
    {
      id: 'ks-point-active',
      type: 'circle',
      source: 'ks-properties',
      filter: ['==', ['get', 'id'], ''],
      paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': color.brass, 'circle-stroke-width': 2 },
    },
    {
      id: 'ks-points',
      type: 'circle',
      source: 'ks-properties',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 6.5,
        'circle-color': color.ink,
        'circle-opacity': 0.9,
        'circle-stroke-color': color.surface,
        'circle-stroke-width': 1.75,
      },
    },
    {
      id: 'ks-neighbor-active',
      type: 'circle',
      source: 'ks-neighbors',
      filter: ['any', ['get', 'inspected'], ['get', 'hovered']],
      paint: { 'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': color.clay, 'circle-stroke-width': 2 },
    },
  ]
  if (icon) {
    layers.push({
      id: 'ks-neighbors',
      type: 'symbol',
      source: 'ks-neighbors',
      layout: { 'icon-image': 'ks-neighbor', 'icon-allow-overlap': true, 'icon-size': ['case', ['get', 'inspected'], 1.3, 1] },
    })
  } else {
    layers.push({
      id: 'ks-neighbors',
      type: 'circle',
      source: 'ks-neighbors',
      paint: { 'circle-radius': 7, 'circle-color': color.clay, 'circle-stroke-color': color.surface, 'circle-stroke-width': 2 },
    })
  }
  if (font) {
    layers.splice(layers.findIndex((l) => l.id === 'ks-point-active'), 0, {
      id: 'ks-cluster-count',
      type: 'symbol',
      source: 'ks-properties',
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': font, 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': color.ink },
    })
  }
  for (const layer of layers) map.addLayer(layer)
}

function padding({ insetLeft, insetBottom }: Pick<MapEngineProps, 'insetLeft' | 'insetBottom'>, height = Infinity) {
  return { top: 72, bottom: Math.max(40, Math.min(40 + insetBottom, height - 72 - 96)), right: 40, left: insetLeft + 40 }
}

const ARRIVE = 'duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]'

/** Brass pin, distinct from the round property marks, with the id on paper. */
function selectedElement(): { root: HTMLDivElement; label: HTMLSpanElement } {
  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.className = 'pointer-events-none relative text-brass'
  root.innerHTML =
    '<svg width="22" height="28" viewBox="-11 -26 22 28" class="overflow-visible"><path d="M0 1 C-2.4 -5 -9 -9 -9 -16 a9 9 0 0 1 18 0 c0 7 -6.6 11 -9 17Z" fill="currentColor" stroke="var(--color-surface, #fffefa)" stroke-width="1.5"/><rect x="-3.25" y="-19.25" width="6.5" height="6.5" fill="var(--color-surface, #fffefa)"/></svg>'
  const label = document.createElement('span')
  label.className = `absolute top-full left-1/2 mt-1 -translate-x-1/2 border border-brass bg-surface px-1.5 py-0.5 font-mono text-[0.6875rem] leading-none font-medium whitespace-nowrap text-ink ring-1 ring-brass transition-colors ${ARRIVE}`
  root.append(label)
  return { root, label }
}

function draftElement(): HTMLDivElement {
  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.className = 'pointer-events-none relative flex w-[26px] justify-center text-ink'
  root.innerHTML =
    '<svg width="26" height="34" viewBox="-13 -32 26 34"><ellipse cx="0" cy="1" rx="6" ry="2.5" fill="currentColor" fill-opacity="0.2"/><path d="M0 0 C-3 -7 -11 -12 -11 -21 a11 11 0 0 1 22 0 c0 9 -8 14 -11 21Z" fill="currentColor" stroke="var(--color-surface, #fffefa)" stroke-width="1.75"/><rect x="-4" y="-25" width="8" height="8" fill="var(--color-surface, #fffefa)"/></svg>'
  const label = document.createElement('span')
  label.className =
    'absolute top-full left-1/2 mt-1 -translate-x-1/2 border border-ink bg-surface px-1.5 py-0.5 text-[0.75rem] font-medium whitespace-nowrap text-ink'
  label.textContent = 'New property'
  root.append(label)
  return root
}

/** MapLibre engine. The map instance lives in a ref; data changes only call setData. */
export function MapLibreMap(props: MapEngineProps) {
  const { records, selected, draft, overlay, inspectedId, mode, resetToken, reducedMotion, insetBottom, onReset } = props
  const fitState = useRef<{ key: string | null; interacted: boolean }>({ key: null, interacted: false })
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const latest = useRef(props)
  const [readyMap, setReadyMap] = useState<MapLibre | null>(null)
  const ready = readyMap != null
  const size = useElementSize(containerRef)
  const [hover, setHover] = useState<Hover>(null)
  const [, setCameraTick] = useState(0)
  const hoverRef = useRef<Hover>(null)

  useLayoutEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const initial = latest.current
    let map: MapLibre
    try {
      map = new MapLibre({
        container,
        style: config.mapStyleUrl,
        bounds: initial.coverage.bounds,
        fitBoundsOptions: { padding: padding(initial) },
        attributionControl: { compact: true, customAttribution: config.mapAttribution },
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
        minZoom: 6,
      })
    } catch {
      initial.onFail('webgl')
      return
    }
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    // Only user gestures carry an originalEvent; programmatic camera moves do not.
    const onUserMove = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) fitState.current.interacted = true
    }
    map.on('dragstart', onUserMove)
    map.on('zoomstart', onUserMove)
    let loaded = false
    let failed = false
    let disposed = false
    const fail = (reason: string) => {
      if (failed || disposed) return
      failed = true
      latest.current.onFail(reason)
    }
    const timer = window.setTimeout(() => !loaded && fail('timeout'), MAP_STYLE_LOAD_TIMEOUT_MS)
    map.on('error', () => {
      if (!loaded && !map.isStyleLoaded()) fail('style')
    })
    // map.remove() itself releases the context, so only a loss while mounted is a failure.
    const onContextLost = () => fail('context-lost')
    const canvas = map.getCanvas()
    canvas.addEventListener('webglcontextlost', onContextLost)

    const setHoverState = (next: Hover) => {
      hoverRef.current = next
      setHover(next)
      map.getCanvas().style.cursor = next && latest.current.mode !== 'create' ? 'pointer' : ''
    }

    map.on('load', () => {
      loaded = true
      window.clearTimeout(timer)
      try {
        restyleBasemap(map)
        addOverlay(map, latest.current.coverage)
      } catch {
        fail('style')
        return
      }

      map.on('click', (e) => {
        if (latest.current.mode === 'create') {
          latest.current.onPlaceDraft({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })
        }
      })
      map.on('click', 'ks-clusters', (e: MapLayerMouseEvent) => {
        if (latest.current.mode === 'create') return
        const feature = e.features?.[0]
        const clusterId = feature?.properties?.cluster_id as number | undefined
        if (clusterId == null || feature?.geometry.type !== 'Point') return
        const center = feature.geometry.coordinates as [number, number]
        void (map.getSource('ks-properties') as GeoJSONSource).getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center, zoom: zoom + 0.25, duration: latest.current.reducedMotion ? 0 : 400 })
        })
      })
      map.on('click', 'ks-points', (e: MapLayerMouseEvent) => {
        if (latest.current.mode === 'create') return
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (id) latest.current.onSelect(id)
      })
      map.on('click', 'ks-neighbors', (e: MapLayerMouseEvent) => {
        if (latest.current.mode === 'create') return
        const id = e.features?.[0]?.properties?.id as string | undefined
        const neighbor = latest.current.overlay?.neighbors.find((n) => n.property.id === id)
        if (neighbor) latest.current.onInspectNeighbor(neighbor)
      })
      for (const [layer, kind] of [
        ['ks-points', 'record'],
        ['ks-neighbors', 'neighbor'],
      ] as const) {
        map.on('mousemove', layer, (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined
          if (id && (hoverRef.current?.id !== id || hoverRef.current.kind !== kind)) setHoverState({ kind, id })
        })
        map.on('mouseleave', layer, () => setHoverState(null))
      }
      map.on('mouseenter', 'ks-clusters', () => {
        if (latest.current.mode !== 'create') map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'ks-clusters', () => (map.getCanvas().style.cursor = ''))
      map.on('move', () => {
        if (hoverRef.current) setCameraTick((t) => t + 1)
      })
      setReadyMap(map)
    })

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container)
    return () => {
      disposed = true
      window.clearTimeout(timer)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      observer.disconnect()
      map.remove()
      mapRef.current = null
      setReadyMap(null)
    }
  }, [])

  // Property markers.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const selectedId = selected?.id
    const neighborIds = new Set(overlay?.neighbors.map((n) => n.property.id) ?? [])
    void (map.getSource('ks-properties') as GeoJSONSource | undefined)?.setData(
      points(records.filter((r) => r.id !== selectedId && !neighborIds.has(r.id))),
    )
  }, [ready, records, selected?.id, overlay])

  // Neighbor edges and markers (only the current target's returned edges).
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const hoveredNeighbor = hover?.kind === 'neighbor' ? hover.id : null
    const edges: FeatureCollection = {
      type: 'FeatureCollection',
      features: (overlay?.neighbors ?? []).map((n) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [overlay!.origin.longitude, overlay!.origin.latitude],
            [n.property.longitude, n.property.latitude],
          ],
        },
        properties: { id: n.property.id, edge_type: n.edge_type, inspected: n.property.id === inspectedId },
      })),
    }
    const nodes: FeatureCollection = {
      type: 'FeatureCollection',
      features: (overlay?.neighbors ?? []).map((n) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [n.property.longitude, n.property.latitude] },
        properties: { id: n.property.id, inspected: n.property.id === inspectedId, hovered: n.property.id === hoveredNeighbor },
      })),
    }
    void (map.getSource('ks-edges') as GeoJSONSource | undefined)?.setData(edges)
    void (map.getSource('ks-neighbors') as GeoJSONSource | undefined)?.setData(nodes)
  }, [ready, overlay, inspectedId, hover])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setFilter('ks-point-active', ['==', ['get', 'id'], hover?.kind === 'record' ? hover.id : ''])
  }, [ready, hover])

  // Create mode emphasizes the supported coverage outline.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const creating = mode === 'create'
    map.setPaintProperty('ks-coverage-line', 'line-width', creating ? 2.5 : 1.25)
    map.setPaintProperty('ks-coverage-line', 'line-opacity', creating ? 0.9 : 0.45)
    map.setPaintProperty('ks-coverage-line', 'line-dasharray', creating ? [3, 2] : undefined)
    map.setPaintProperty('ks-coverage-fill', 'fill-opacity', creating ? 0.07 : 0.03)
    map.getCanvas().style.cursor = creating ? 'crosshair' : ''
    map.setPaintProperty('ks-points', 'circle-opacity', creating ? 0.45 : 0.9)
    map.setPaintProperty('ks-clusters', 'circle-opacity', creating ? 0.6 : 1)
  }, [ready, mode])

  // Selected marker: one persistent Marker moved with setLngLat.
  const selectedMarker = useRef<{ marker: Marker; label: HTMLSpanElement } | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    if (!selected) {
      selectedMarker.current?.marker.remove()
      selectedMarker.current = null
      return
    }
    if (!selectedMarker.current) {
      const { root, label } = selectedElement()
      selectedMarker.current = { marker: new Marker({ element: root, anchor: 'bottom' }), label }
    }
    const { marker, label } = selectedMarker.current
    label.textContent = selected.id
    marker.setLngLat([selected.longitude, selected.latitude]).addTo(map)
  }, [ready, selected])

  // Ease to a newly selected property.
  const selectedId = selected?.id ?? null
  useEffect(() => {
    const map = mapRef.current
    const record = latest.current.selected
    if (!ready || !map || !selectedId || !record) return
    map.easeTo({
      center: [record.longitude, record.latitude],
      zoom: Math.max(map.getZoom(), SELECT_ZOOM),
      offset: [latest.current.insetLeft / 2, -latest.current.insetBottom / 2],
      duration: latest.current.reducedMotion ? 0 : 600,
    })
  }, [ready, selectedId])

  const draftMarker = useRef<Marker | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    if (!draft) {
      draftMarker.current?.remove()
      draftMarker.current = null
      return
    }
    draftMarker.current ??= new Marker({ element: draftElement(), anchor: 'bottom' })
    draftMarker.current.setLngLat([draft.longitude, draft.latitude]).addTo(map)
  }, [ready, draft])

  useEffect(
    () => () => {
      selectedMarker.current?.marker.remove()
      draftMarker.current?.remove()
    },
    [],
  )

  // Frame the target and its connected homes when a new set of connections appears.
  const overlayKey = overlay
    ? `${overlay.origin.latitude},${overlay.origin.longitude}:${overlay.neighbors.map((n) => n.property.id).join(',')}`
    : null
  useEffect(() => {
    const map = mapRef.current
    const current = latest.current.overlay
    if (!ready || !map || !overlayKey || !current || current.neighbors.length === 0) return
    // Re-frame when floating cards change size, unless the user has moved the map since.
    if (fitState.current.key === overlayKey && fitState.current.interacted) return
    fitState.current = { key: overlayKey, interacted: false }
    const lngs = [current.origin.longitude, ...current.neighbors.map((n) => n.property.longitude)]
    const lats = [current.origin.latitude, ...current.neighbors.map((n) => n.property.latitude)]
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: padding({ insetLeft: latest.current.insetLeft, insetBottom }, map.getContainer().clientHeight),
        maxZoom: 14.5, duration: latest.current.reducedMotion ? 0 : 600,
      },
    )
  }, [ready, overlayKey, insetBottom])

  // Reset map → full coverage extent.
  const lastReset = useRef(resetToken)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || lastReset.current === resetToken) return
    lastReset.current = resetToken
    map.fitBounds(latest.current.coverage.bounds, {
      padding: padding(latest.current, map.getContainer().clientHeight),
      duration: latest.current.reducedMotion ? 0 : 500,
    })
  }, [ready, resetToken])

  const map = readyMap
  const hoverRecord = (() => {
    if (!hover || !map) return null
    if (hover.kind === 'record') {
      const record = records.find((r) => r.id === hover.id)
      return record ? { record, note: undefined } : null
    }
    const neighbor = overlay?.neighbors.find((n) => n.property.id === hover.id)
    if (!neighbor) return null
    return {
      record: neighbor.property,
      note:
        neighbor.property.role === 'held_out_example'
          ? 'Connected home · select to see its context'
          : 'Connected home · reference only',
    }
  })()
  const hoverPoint = hoverRecord && map ? map.project([hoverRecord.record.longitude, hoverRecord.record.latitude]) : null

  return (
    <div className="absolute inset-0 overflow-hidden bg-land">
      <section
        className="absolute inset-0"
        aria-label={
          mode === 'create'
            ? 'Map. Click to place your new property.'
            : 'Property map. The property list shows the same records.'
        }
      >
        {/* MapLibre sets position: relative on its container, so it needs an explicitly sized element. */}
        <div ref={containerRef} className="size-full" />
      </section>
      {hoverRecord && hoverPoint && mode !== 'create' && (
        <MarkerTooltip record={hoverRecord.record} x={hoverPoint.x} y={hoverPoint.y} containerWidth={size.width} lift={16} note={hoverRecord.note} />
      )}
      {ready && (
        <MapControls
          className="absolute top-3 right-3 z-10"
          onZoomIn={() => map?.zoomIn({ duration: reducedMotion ? 0 : 250 })}
          onZoomOut={() => map?.zoomOut({ duration: reducedMotion ? 0 : 250 })}
          onReset={onReset}
        />
      )}
      {!ready && <output className="absolute inset-x-0 top-1/2 block text-center text-sm text-ink-muted">Loading map…</output>}
    </div>
  )
}
