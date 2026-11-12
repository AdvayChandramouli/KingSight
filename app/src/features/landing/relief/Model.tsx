import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { connectionMotionMs, easeArrival, threadSchedule } from './easing'
import {
  EAST_CREST,
  LAKE_SAMMAMISH,
  LAKE_WASHINGTON,
  LANDMARKS,
  MAINLAND,
  MERCER,
  RAINIER,
  SOUND,
  VASHON,
  type Landmark,
  type LngLat,
} from './geometry'
import { LAND_BOTTOM, LAND_THICKNESS, LAND_TOP, WATER_Y, projectToModel } from './project'
import type { ReliefNeighbor } from './ReliefStage'

const WOOD = '#e0d2bc'
const WOOD_MARK = '#b7a48a'
const WATER = '#2a3c48'
const TABLE = '#24302c'
const STONE = '#b7b2a8'
const BRASS = '#a8844a'
const NAIL = '#3f3c38'
const THREAD = '#6e4c38'
const Y_AXIS = new THREE.Vector3(0, 1, 0)

type HoverTip = { id: string; zip: string; x: number; y: number } | null

type ModelProps = {
  propertyId: string
  zip: string
  latitude: number
  longitude: number
  neighbors: ReliefNeighbor[]
  showConnections: boolean
  onDraw: (active: boolean) => void
  onHover: (tip: HoverTip) => void
}

function ignoreRaycast() {
  // Landmark silhouettes are orientation only. They are not homes.
}

function toShapeXY([longitude, latitude]: LngLat): [number, number] {
  const point = projectToModel(latitude, longitude)
  return [point.x, -point.z]
}

function signedArea(points: readonly [number, number][]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!
    const next = points[(i + 1) % points.length]!
    area += current[0] * next[1] - next[0] * current[1]
  }
  return area
}

function ensureWinding(points: [number, number][], direction: 'ccw' | 'cw'): [number, number][] {
  const counterClockwise = signedArea(points) > 0
  if (counterClockwise === (direction === 'ccw')) return points
  return [...points].reverse()
}

function trace(path: THREE.Path, points: readonly [number, number][]) {
  const first = points[0]
  if (!first) return
  path.moveTo(first[0], first[1])
  for (let i = 1; i < points.length; i++) {
    const point = points[i]
    if (point) path.lineTo(point[0], point[1])
  }
}

function shapeFromRing(ring: LngLat[], holes: LngLat[][] = []): THREE.Shape {
  const shape = new THREE.Shape()
  trace(shape, ensureWinding(ring.map(toShapeXY), 'ccw'))
  for (const hole of holes) {
    const path = new THREE.Path()
    trace(path, ensureWinding(hole.map(toShapeXY), 'cw'))
    shape.holes.push(path)
  }
  return shape
}

function extrudeRing(ring: LngLat[], holes: LngLat[][] = []): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shapeFromRing(ring, holes), {
    depth: LAND_THICKNESS,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, LAND_BOTTOM, 0)
  geometry.computeVertexNormals()
  return geometry
}

function sheetGeometry(ring: LngLat[]): THREE.ShapeGeometry {
  const geometry = new THREE.ShapeGeometry(shapeFromRing(ring))
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, WATER_Y, 0)
  return geometry
}

function ridgeGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const crest = EAST_CREST.map(([longitude, latitude]) => ({ ...projectToModel(latitude, longitude), latitude }))
  for (let i = 0; i < crest.length; i++) {
    const previous = crest[Math.max(0, i - 1)]!
    const next = crest[Math.min(crest.length - 1, i + 1)]!
    const current = crest[i]!
    let tx = next.x - previous.x
    let tz = next.z - previous.z
    const length = Math.hypot(tx, tz) || 1
    tx /= length
    tz /= length
    let nx = -tz
    let nz = tx
    if (nx > 0) {
      nx = -nx
      nz = -nz
    }
    const saddle = Math.exp(-((current.latitude - 47.42) ** 2) / (2 * 0.14 ** 2))
    const height = 0.02 + 0.028 * (1 - saddle)
    const inset = 0.06
    positions.push(current.x, LAND_TOP, current.z)
    positions.push(current.x, LAND_TOP + height, current.z)
    positions.push(current.x + nx * inset, LAND_TOP, current.z + nz * inset)
  }
  const stride = 3
  for (let i = 0; i < crest.length - 1; i++) {
    const a = i * stride
    const b = (i + 1) * stride
    indices.push(a, b, b + 1, a, b + 1, a + 1)
    indices.push(a + 1, b + 1, b + 2, a + 1, b + 2, a + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function boardMetrics() {
  const rings: LngLat[][] = [MAINLAND, VASHON, SOUND, [[RAINIER.longitude, RAINIER.latitude]]]
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      const point = projectToModel(latitude, longitude)
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    }
  }
  const pad = 0.16
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    width: maxX - minX + pad * 2,
    depth: maxZ - minZ + pad * 2,
  }
}

function MarkMaterial() {
  return <meshStandardMaterial color={WOOD_MARK} roughness={0.88} flatShading />
}

function LandmarkMesh({ landmark }: { landmark: Landmark }) {
  const point = projectToModel(landmark.latitude, landmark.longitude)
  if (landmark.kind === 'needle') {
    return (
      <group position={[point.x, LAND_TOP, point.z]}>
        <mesh position={[0, 0.028, 0]} castShadow raycast={ignoreRaycast}>
          <cylinderGeometry args={[0.0032, 0.0042, 0.056, 8]} />
          <MarkMaterial />
        </mesh>
        <mesh position={[0, 0.052, 0]} castShadow raycast={ignoreRaycast}>
          <cylinderGeometry args={[0.012, 0.012, 0.005, 12]} />
          <MarkMaterial />
        </mesh>
        <mesh position={[0, 0.066, 0]} castShadow raycast={ignoreRaycast}>
          <cylinderGeometry args={[0.0014, 0.0022, 0.022, 6]} />
          <MarkMaterial />
        </mesh>
      </group>
    )
  }
  if (landmark.kind === 'cluster') {
    const blocks = [
      { x: -0.008, z: 0.004, w: landmark.width * 0.7, d: landmark.depth, h: landmark.height * 0.7 },
      { x: 0.004, z: 0, w: landmark.width * 0.55, d: landmark.depth * 0.8, h: landmark.height },
      { x: 0.012, z: -0.006, w: landmark.width * 0.4, d: landmark.depth * 0.6, h: landmark.height * 0.55 },
    ]
    return (
      <group position={[point.x, LAND_TOP, point.z]}>
        {blocks.map((block) => (
          <mesh
            key={`${block.x}:${block.z}`}
            position={[block.x, block.h / 2, block.z]}
            castShadow
            raycast={ignoreRaycast}
          >
            <boxGeometry args={[block.w, block.h, block.d]} />
            <MarkMaterial />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <mesh
      position={[point.x, LAND_TOP + landmark.height / 2, point.z]}
      castShadow
      raycast={ignoreRaycast}
    >
      <boxGeometry args={[landmark.width, landmark.height, landmark.depth]} />
      <MarkMaterial />
    </mesh>
  )
}

function Sun({ cx, cz }: { cx: number; cz: number }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)
  useLayoutEffect(() => {
    const sun = light.current
    const aim = target.current
    if (!sun || !aim) return
    sun.target = aim
    const camera = sun.shadow.camera
    camera.left = -1.8
    camera.right = 1.8
    camera.top = 1.8
    camera.bottom = -1.8
    camera.near = 0.2
    camera.far = 8
    camera.updateProjectionMatrix()
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.03
    sun.shadow.mapSize.set(1024, 1024)
  }, [])
  return (
    <>
      <directionalLight ref={light} position={[1.45, 2.25, 0.95]} intensity={2.35} color="#fff1e2" castShadow />
      <object3D ref={target} position={[cx, 0, cz]} />
    </>
  )
}

function SalePin({ propertyId, zip, latitude, longitude }: Pick<ModelProps, 'propertyId' | 'zip' | 'latitude' | 'longitude'>) {
  const point = projectToModel(latitude, longitude)
  return (
    <group name={`sale-${propertyId}-${zip}`} position={[point.x, LAND_TOP, point.z]}>
      <mesh position={[0, 0.0015, 0]} castShadow>
        <boxGeometry args={[0.032, 0.003, 0.032]} />
        <meshStandardMaterial color={BRASS} metalness={0.72} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.034, 0]} castShadow>
        <cylinderGeometry args={[0.0034, 0.0034, 0.068, 10]} />
        <meshStandardMaterial color={BRASS} metalness={0.72} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.074, 0]} castShadow>
        <boxGeometry args={[0.02, 0.016, 0.02]} />
        <meshStandardMaterial color={BRASS} metalness={0.72} roughness={0.34} />
      </mesh>
    </group>
  )
}

function NeighborLink({
  neighbor,
  index,
  count,
  origin,
  showConnections,
  neighborKey,
  onHover,
}: {
  neighbor: ReliefNeighbor
  index: number
  count: number
  origin: THREE.Vector3
  showConnections: boolean
  neighborKey: string
  onHover: (tip: HoverTip) => void
}) {
  const thread = useRef<THREE.Mesh>(null)
  const pin = useRef<THREE.Group>(null)
  const scratch = useRef({ dir: new THREE.Vector3(), mid: new THREE.Vector3() })
  const shown = useRef(0)
  const leg = useRef({ show: showConnections, key: neighborKey, t0: 0, from: 0 })
  const end = useMemo(() => {
    const point = projectToModel(neighbor.latitude, neighbor.longitude)
    return new THREE.Vector3(point.x, LAND_TOP + 0.02, point.z)
  }, [neighbor.latitude, neighbor.longitude])

  useFrame(() => {
    const mesh = thread.current
    const pinGroup = pin.current
    if (!mesh || !pinGroup) return
    if (leg.current.t0 === 0 || leg.current.show !== showConnections || leg.current.key !== neighborKey) {
      leg.current = {
        show: showConnections,
        key: neighborKey,
        t0: performance.now(),
        from: leg.current.t0 === 0 ? 0 : shown.current,
      }
    }
    const timing = leg.current
    const { delay, duration } = threadSchedule(index, count, timing.show)
    const elapsed = performance.now() - timing.t0 - delay
    const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration))
    const target = timing.show ? 1 : 0
    const amount = timing.from + (target - timing.from) * easeArrival(t)
    shown.current = amount
    const length = origin.distanceTo(end)
    const drawn = length * amount
    const drawable = amount > 0.03 && length > 1e-4
    mesh.visible = drawable
    pinGroup.visible = drawable
    if (!drawable) return
    const { dir, mid } = scratch.current
    dir.subVectors(end, origin)
    if (dir.lengthSq() < 1e-8) return
    dir.normalize()
    mid.copy(origin).addScaledVector(dir, drawn / 2)
    mesh.position.copy(mid)
    mesh.quaternion.setFromUnitVectors(Y_AXIS, dir)
    mesh.scale.set(1, Math.max(drawn, 1e-4), 1)
    pinGroup.position.set(end.x, LAND_TOP + amount * 0.012, end.z)
  })

  const hover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onHover({ id: neighbor.id, zip: neighbor.zip, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY })
  }
  const hold = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    event.nativeEvent.preventDefault()
  }

  return (
    <group>
      <mesh
        ref={thread}
        visible={false}
        castShadow
        onPointerOver={hover}
        onPointerMove={hover}
        onPointerOut={() => onHover(null)}
        onPointerDown={hold}
        onClick={hold}
      >
        <boxGeometry args={[0.012, 1, 0.0035]} />
        <meshStandardMaterial color={THREAD} roughness={0.72} />
      </mesh>
      <group ref={pin} visible={false}>
        <mesh
          position={[0, 0.008, 0]}
          castShadow
          onPointerOver={hover}
          onPointerMove={hover}
          onPointerOut={() => onHover(null)}
          onPointerDown={hold}
          onClick={hold}
        >
          <sphereGeometry args={[0.008, 14, 10]} />
          <meshStandardMaterial color={NAIL} metalness={0.22} roughness={0.58} flatShading />
        </mesh>
      </group>
    </group>
  )
}

export function CountyModel({
  propertyId,
  zip,
  latitude,
  longitude,
  neighbors,
  showConnections,
  onDraw,
  onHover,
}: ModelProps) {
  const land = useMemo(() => extrudeRing(MAINLAND, [LAKE_WASHINGTON, LAKE_SAMMAMISH]), [])
  const vashon = useMemo(() => extrudeRing(VASHON), [])
  const mercer = useMemo(() => extrudeRing(MERCER), [])
  const sound = useMemo(() => sheetGeometry(SOUND), [])
  const lakeWashington = useMemo(() => sheetGeometry(LAKE_WASHINGTON), [])
  const lakeSammamish = useMemo(() => sheetGeometry(LAKE_SAMMAMISH), [])
  const ridge = useMemo(() => ridgeGeometry(), [])
  const board = useMemo(() => boardMetrics(), [])
  const links = useMemo(
    () => neighbors.filter((neighbor) => Number.isFinite(neighbor.latitude) && Number.isFinite(neighbor.longitude)),
    [neighbors],
  )
  const neighborKey = links.map((neighbor) => `${neighbor.id}:${neighbor.latitude}:${neighbor.longitude}`).join('|')
  const wasShowing = useRef(false)
  const origin = useMemo(() => {
    const point = projectToModel(latitude, longitude)
    return new THREE.Vector3(point.x, LAND_TOP + 0.02, point.z)
  }, [latitude, longitude])

  useEffect(() => {
    const exit = wasShowing.current && !showConnections
    const enter = showConnections && neighborKey !== ''
    wasShowing.current = showConnections
    if (!enter && !exit) return
    onDraw(true)
    const timer = window.setTimeout(() => onDraw(false), connectionMotionMs(showConnections) + 60)
    return () => {
      window.clearTimeout(timer)
      onDraw(false)
    }
  }, [showConnections, neighborKey, onDraw])

  const rainier = projectToModel(RAINIER.latitude, RAINIER.longitude)

  return (
    <>
      <ambientLight intensity={0.16} color="#e4ebe6" />
      <Sun cx={board.cx} cz={board.cz} />
      <directionalLight position={[-0.2, 1.15, -1.45]} intensity={0.48} color="#d5e2ee" />
      <mesh position={[board.cx, -0.028, board.cz]} receiveShadow>
        <boxGeometry args={[board.width, 0.056, board.depth]} />
        <meshStandardMaterial color={TABLE} roughness={0.96} />
      </mesh>
      <mesh geometry={sound} receiveShadow>
        <meshStandardMaterial color={WATER} roughness={0.62} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={lakeWashington} receiveShadow>
        <meshStandardMaterial color={WATER} roughness={0.62} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={lakeSammamish} receiveShadow>
        <meshStandardMaterial color={WATER} roughness={0.62} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={land} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.92} />
      </mesh>
      <mesh geometry={vashon} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.92} />
      </mesh>
      <mesh geometry={mercer} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.92} />
      </mesh>
      <mesh geometry={ridge} castShadow receiveShadow>
        <meshStandardMaterial color="#d3c4ae" roughness={0.9} flatShading />
      </mesh>
      <group position={[rainier.x, 0, rainier.z]}>
        <mesh position={[0, 0.03, 0]} castShadow raycast={ignoreRaycast}>
          <coneGeometry args={[0.15, 0.06, 7]} />
          <meshStandardMaterial color={STONE} roughness={0.92} flatShading />
        </mesh>
        <mesh position={[0.012, 0.095, -0.008]} castShadow raycast={ignoreRaycast}>
          <coneGeometry args={[0.085, 0.15, 6]} />
          <meshStandardMaterial color="#aea89e" roughness={0.9} flatShading />
        </mesh>
      </group>
      {LANDMARKS.map((landmark) => (
        <LandmarkMesh key={landmark.id} landmark={landmark} />
      ))}
      <SalePin propertyId={propertyId} zip={zip} latitude={latitude} longitude={longitude} />
      {links.map((neighbor, index) => (
        <NeighborLink
          key={`${neighbor.id}:${index}`}
          neighbor={neighbor}
          index={index}
          count={links.length}
          origin={origin}
          showConnections={showConnections}
          neighborKey={neighborKey}
          onHover={onHover}
        />
      ))}
    </>
  )
}
