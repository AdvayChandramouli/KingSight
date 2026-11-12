import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { CountyModel } from './Model'
import { CAMERA_FRAME } from './project'
import type { ReliefStageProps } from './ReliefStage'

type Tip = { id: string; zip: string; x: number; y: number }

type ReliefCanvasProps = ReliefStageProps & {
  visible: boolean
}

function tipStyle(tip: Tip): CSSProperties {
  const left = Math.min(tip.x + 12, window.innerWidth - 168)
  const top = tip.y > window.innerHeight - 72 ? tip.y - 44 : tip.y + 14
  return { left, top }
}

function Wake({ visible }: { visible: boolean }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (visible) invalidate()
  }, [visible, invalidate])
  return null
}

function OrbitSession({ onLive }: { onLive: (live: boolean) => void }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const element = gl.domElement
    let timer = 0
    let dragging = false
    const kick = () => {
      onLive(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => onLive(false), 900)
    }
    const onDown = () => {
      dragging = true
      kick()
    }
    const onMove = () => {
      if (dragging) kick()
    }
    const onUp = () => {
      dragging = false
      kick()
    }
    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    element.addEventListener('wheel', kick, { passive: true })
    return () => {
      window.clearTimeout(timer)
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('wheel', kick)
      onLive(false)
    }
  }, [gl, onLive])

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      autoRotate={false}
      zoomSpeed={0.65}
      rotateSpeed={0.55}
      minPolarAngle={CAMERA_FRAME.minPolarAngle}
      maxPolarAngle={CAMERA_FRAME.maxPolarAngle}
      minDistance={CAMERA_FRAME.minDistance}
      maxDistance={CAMERA_FRAME.maxDistance}
      target={[CAMERA_FRAME.target[0], CAMERA_FRAME.target[1], CAMERA_FRAME.target[2]]}
    />
  )
}

/**
 * Heavy scene chunk. No fog, bloom, night palette, or water shader.
 * Water is a flat darker material. Reduced motion never mounts this module.
 */
export function ReliefCanvas({
  propertyId,
  zip,
  latitude,
  longitude,
  neighbors,
  showConnections,
  visible,
}: ReliefCanvasProps) {
  const [orbiting, setOrbiting] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)
  const shownTip = showConnections ? tip : null
  const frameloop = !visible ? 'never' : orbiting || drawing ? 'always' : 'demand'

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={frameloop}
        shadows="soft"
        camera={{
          position: [CAMERA_FRAME.position[0], CAMERA_FRAME.position[1], CAMERA_FRAME.position[2]],
          fov: CAMERA_FRAME.fov,
          near: 0.02,
          far: 20,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#1a2320', 1)
          gl.toneMapping = THREE.NoToneMapping
          camera.lookAt(CAMERA_FRAME.target[0], CAMERA_FRAME.target[1], CAMERA_FRAME.target[2])
        }}
      >
        <Wake visible={visible} />
        <OrbitSession onLive={setOrbiting} />
        <CountyModel
          propertyId={propertyId}
          zip={zip}
          latitude={latitude}
          longitude={longitude}
          neighbors={neighbors}
          showConnections={showConnections}
          onDraw={setDrawing}
          onHover={setTip}
        />
      </Canvas>
      {shownTip ? (
        <p className="relief-tip" role="tooltip" style={tipStyle(shownTip)}>
          <span className="relief-tip__id">{shownTip.id}</span>
          <span> · ZIP {shownTip.zip}</span>
        </p>
      ) : null}
    </>
  )
}
