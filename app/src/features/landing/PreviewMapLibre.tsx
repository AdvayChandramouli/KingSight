import { Marker, Map as MapLibre, type GeoJSONSource } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { config } from '@/app/config'
import { MAP_STYLE_LOAD_TIMEOUT_MS } from '@/features/explorer/map/mapEngine'
import '@/features/explorer/map/maplibreSetup'
import type { Neighbor } from '@/services/types'

const HOME_ZOOM = 13
const CLAY = '#9a654a'

type Props = {
  latitude: number
  longitude: number
  label: string
  neighbors: Neighbor[]
  onFail: (reason: string) => void
}

type EdgeCollection = {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: { type: 'LineString'; coordinates: [number, number][] }
    properties: { edge_type: string }
  }[]
}

/** Small MapLibre preview. Pan and zoom only — it does not select properties. */
export function PreviewMapLibre({ latitude, longitude, label, neighbors, onFail }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const onFailRef = useRef(onFail)
  const interacted = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onFailRef.current = onFail
  }, [onFail])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let map: MapLibre
    try {
      map = new MapLibre({
        container,
        style: config.mapStyleUrl,
        center: [longitude, latitude],
        zoom: HOME_ZOOM,
        attributionControl: { compact: true, customAttribution: config.mapAttribution },
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
        minZoom: 6,
      })
    } catch {
      onFailRef.current('webgl')
      return
    }
    mapRef.current = map
    interacted.current = false
    map.touchZoomRotate.disableRotation()
    const onUserMove = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) interacted.current = true
    }
    map.on('dragstart', onUserMove)
    map.on('zoomstart', onUserMove)

    let loaded = false
    let failed = false
    let disposed = false
    const fail = (reason: string) => {
      if (failed || disposed) return
      failed = true
      onFailRef.current(reason)
    }
    const timer = window.setTimeout(() => {
      if (!loaded) fail('timeout')
    }, MAP_STYLE_LOAD_TIMEOUT_MS)
    map.on('error', () => {
      if (!loaded && !map.isStyleLoaded()) fail('style')
    })
    const onContextLost = () => fail('context-lost')
    const canvas = map.getCanvas()
    canvas.addEventListener('webglcontextlost', onContextLost)

    map.on('load', () => {
      loaded = true
      window.clearTimeout(timer)
      try {
        map.addSource('ks-edges', { type: 'geojson', data: emptyEdges() })
        map.addLayer({
          id: 'ks-edges-solid',
          type: 'line',
          source: 'ks-edges',
          filter: ['!=', ['get', 'edge_type'], 'similarity'],
          paint: { 'line-color': CLAY, 'line-opacity': 0.85, 'line-width': 1.6 },
        })
        map.addLayer({
          id: 'ks-edges-dashed',
          type: 'line',
          source: 'ks-edges',
          filter: ['==', ['get', 'edge_type'], 'similarity'],
          paint: { 'line-color': CLAY, 'line-opacity': 0.85, 'line-width': 1.6, 'line-dasharray': [3, 2] },
        })
      } catch {
        fail('style')
        return
      }
      setReady(true)
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
      setReady(false)
    }
    // Recreate only when the preview home moves. Neighbor updates reuse this map.
  }, [latitude, longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const data: EdgeCollection = {
      type: 'FeatureCollection',
      features: neighbors.map((neighbor) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [longitude, latitude],
            [neighbor.property.longitude, neighbor.property.latitude],
          ],
        },
        properties: { edge_type: neighbor.edge_type },
      })),
    }
    ;(map.getSource('ks-edges') as GeoJSONSource | undefined)?.setData(data)
  }, [ready, neighbors, latitude, longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const marker = new Marker({ element: homeMarker(label), anchor: 'center' }).setLngLat([longitude, latitude]).addTo(map)
    const neighborMarkers = neighbors.map(
      (neighbor) =>
        new Marker({ element: neighborMarker(), anchor: 'center' })
          .setLngLat([neighbor.property.longitude, neighbor.property.latitude])
          .addTo(map),
    )
    return () => {
      marker.remove()
      for (const item of neighborMarkers) item.remove()
    }
  }, [ready, neighbors, label, latitude, longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || interacted.current) return
    if (neighbors.length === 0) {
      map.jumpTo({ center: [longitude, latitude], zoom: HOME_ZOOM })
      return
    }
    const lngs = [longitude, ...neighbors.map((neighbor) => neighbor.property.longitude)]
    const lats = [latitude, ...neighbors.map((neighbor) => neighbor.property.latitude)]
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 14, duration: 0 },
    )
  }, [ready, neighbors, latitude, longitude])

  return (
    <section className="absolute inset-0 bg-land" aria-label="Map preview of this property">
      <div ref={containerRef} className="size-full" />
      {!ready && <output className="absolute inset-x-0 top-1/2 block text-center text-sm text-ink-muted">Loading map…</output>}
    </section>
  )
}

function emptyEdges(): EdgeCollection {
  return { type: 'FeatureCollection', features: [] }
}

function homeMarker(id: string): HTMLDivElement {
  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.className = 'pointer-events-none relative size-[24px]'
  const ring = document.createElement('span')
  ring.className = 'absolute inset-0 rounded-full border-[3.5px] border-evergreen bg-surface shadow-[0_0_0_9px_rgb(49_89_74/0.16)]'
  const dot = document.createElement('span')
  dot.className = 'absolute top-1/2 left-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-evergreen'
  const label = document.createElement('span')
  label.className =
    'absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-full bg-evergreen px-2.5 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap text-white shadow-soft'
  label.textContent = id
  root.append(ring, dot, label)
  return root
}

function neighborMarker(): HTMLDivElement {
  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.className = 'pointer-events-none size-[14px] rounded-[4px] border-2 border-surface bg-clay shadow-soft'
  return root
}
