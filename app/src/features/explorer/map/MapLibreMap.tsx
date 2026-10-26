import {
  Map as MapLibre,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type LayerSpecification,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FeatureCollection as GeoFeatureCollection, Geometry } from 'geojson'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { config } from '@/app/config'
import type { PropertyRecord } from '@/services/types'
import { MapControls } from './MapControls'
import type { MapEngineProps } from './mapTypes'
import { MarkerTooltip } from './MarkerTooltip'
import { useElementSize } from './useElementSize'

// The worker is resolved relative to the library file, which breaks once the bundler moves it.
setWorkerUrl(workerUrl)

const SELECT_ZOOM = 12.5
const LOAD_TIMEOUT_MS = 15_000
const COLORS = {
  evergreen: '#31594a',
  surface: '#fffefa',
  ink: '#203a32',
  clay: '#9a654a',
  water: '#c9dce3',
  waterLine: '#a9c4ce',
  land: '#e9ede1',
  green: '#d7e3cf',
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

/** Light vector basemap toward the product palette: subdued roads, green land, blue water. */
function restyleBasemap(map: MapLibre) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id.toLowerCase()
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', COLORS.land)
      else if (layer.type === 'fill' && /water|ocean|lake|river|reservoir/.test(id))
        map.setPaintProperty(layer.id, 'fill-color', COLORS.water)
      else if (layer.type === 'fill' && /park|wood|forest|grass|landcover|green|nature|scrub|wetland/.test(id))
        map.setPaintProperty(layer.id, 'fill-color', COLORS.green)
      else if (layer.type === 'line' && /water|river|stream|canal/.test(id))
        map.setPaintProperty(layer.id, 'line-color', COLORS.waterLine)
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
function neighborIcon(): ImageData | null {
  const ratio = 2
  const size = 18 * ratio
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = COLORS.clay
  ctx.strokeStyle = COLORS.surface
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.roundRect(3.5, 3.5, size - 7, size - 7, 6)
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function addOverlay(map: MapLibre, coverage: MapEngineProps['coverage']) {
  map.addSource('ks-coverage', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coverage.polygon] }, properties: {} },
  })
  map.addSource('ks-edges', { type: 'geojson', data: EMPTY })
  map.addSource('ks-properties', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 14 })
  map.addSource('ks-neighbors', { type: 'geojson', data: EMPTY })

  const icon = neighborIcon()
  if (icon) map.addImage('ks-neighbor', icon, { pixelRatio: 2 })
  const font = findTextFont(map)

  const layers: LayerSpecification[] = [
    { id: 'ks-coverage-fill', type: 'fill', source: 'ks-coverage', paint: { 'fill-color': COLORS.evergreen, 'fill-opacity': 0.03 } },
    {
      id: 'ks-coverage-line',
      type: 'line',
      source: 'ks-coverage',
      paint: { 'line-color': COLORS.evergreen, 'line-opacity': 0.45, 'line-width': 1.25 },
    },
    {
      id: 'ks-edges-solid',
      type: 'line',
      source: 'ks-edges',
      filter: ['!=', ['get', 'edge_type'], 'similarity'],
      paint: { 'line-color': COLORS.clay, 'line-opacity': 0.85, 'line-width': ['case', ['get', 'inspected'], 2.75, 1.6] },
    },
    {
      id: 'ks-edges-dashed',
      type: 'line',
      source: 'ks-edges',
      filter: ['==', ['get', 'edge_type'], 'similarity'],
      paint: {
        'line-color': COLORS.clay,
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
        'circle-color': COLORS.evergreen,
        'circle-opacity': 0.14,
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 24, 25, 28],
      },
    },
    {
      id: 'ks-clusters',
      type: 'circle',
      source: 'ks-properties',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': COLORS.surface,
        'circle-stroke-color': COLORS.evergreen,
        'circle-stroke-width': 2,
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 18, 25, 21],
      },
    },
    {
      id: 'ks-point-active',
      type: 'circle',
      source: 'ks-properties',
      filter: ['==', ['get', 'id'], ''],
      paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': COLORS.evergreen, 'circle-stroke-width': 2 },
    },
    {
      id: 'ks-points',
      type: 'circle',
      source: 'ks-properties',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 6.5,
        'circle-color': COLORS.evergreen,
        'circle-opacity': 0.9,
        'circle-stroke-color': COLORS.surface,
        'circle-stroke-width': 1.75,
      },
    },
    {
      id: 'ks-neighbor-active',
      type: 'circle',
      source: 'ks-neighbors',
      filter: ['any', ['get', 'inspected'], ['get', 'hovered']],
      paint: { 'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': COLORS.clay, 'circle-stroke-width': 2 },
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
      paint: { 'circle-radius': 7, 'circle-color': COLORS.clay, 'circle-stroke-color': COLORS.surface, 'circle-stroke-width': 2 },
    })
  }
  if (font) {
    layers.splice(layers.findIndex((l) => l.id === 'ks-point-active'), 0, {
      id: 'ks-cluster-count',
      type: 'symbol',
      source: 'ks-properties',
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': font, 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': COLORS.ink },
    })
  }
  for (const layer of layers) map.addLayer(layer)
}

function padding({ insetLeft, insetBottom }: Pick<MapEngineProps, 'insetLeft' | 'insetBottom'>, height = Infinity) {
  return { top: 72, bottom: Math.max(40, Math.min(40 + insetBottom, height - 72 - 96)), right: 40, left: insetLeft + 40 }
}

function selectedElement(): { root: HTMLDivElement; label: HTMLSpanElement } {
  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.className = 'pointer-events-none relative size-[24px]'
  const ring = document.createElement('span')
  ring.className =
    'absolute inset-0 rounded-full border-[3.5px] border-evergreen bg-surface shadow-[0_0_0_9px_rgb(49_89_74/0.16)]'
  const dot = document.createElement('span')
  dot.className = 'absolute top-1/2 left-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-evergreen'
  const label = document.createElement('span')
  label.className =
    'absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-full bg-evergreen px-2.5 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap text-white shadow-soft'
  root.append(ring, dot, label)
  return { root, label }
}

function draftElement(): HTMLDivElement {
  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.className = 'pointer-events-none relative flex w-[26px] justify-center'
  root.innerHTML =
    '<svg width="26" height="34" viewBox="-13 -32 26 34"><ellipse cx="0" cy="1" rx="6" ry="2.5" fill="#203a32" fill-opacity="0.2"/><path d="M0 0 C-3 -7 -11 -12 -11 -21 a11 11 0 0 1 22 0 c0 9 -8 14 -11 21Z" fill="#203a32" stroke="#fffefa" stroke-width="1.75"/><rect x="-4" y="-25" width="8" height="8" rx="1.5" fill="#fffefa"/></svg>'
  const label = document.createElement('span')
  label.className =
    'absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded-full border border-ink bg-surface px-2.5 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap text-ink shadow-soft'
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
    if (!container || !config.mapStyleUrl) return
    const initial = latest.current
    let map: MapLibre
    try {
      map = new MapLibre({
        container,
        style: config.mapStyleUrl,
        bounds: initial.coverage.bounds,
        fitBoundsOptions: { padding: padding(initial) },
        attributionControl: { compact: true, customAttribution: config.mapAttribution ?? undefined },
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
    const timer = window.setTimeout(() => !loaded && fail('timeout'), LOAD_TIMEOUT_MS)
    map.on('error', () => {
      if (!loaded && !map.isStyleLoaded()) fail('style')
    })
    // map.remove() itself releases the context, so only a loss while mounted is a failure.
    const onContextLost = () => fail('webgl')
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
      selectedMarker.current = { marker: new Marker({ element: root, anchor: 'center' }), label }
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
    <div className="absolute inset-0 overflow-hidden bg-sand-soft">
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
