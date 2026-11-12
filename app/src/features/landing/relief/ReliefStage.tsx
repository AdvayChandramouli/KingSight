import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './relief.css'
import { useReliefSceneAllowed } from './sceneGate'

export type ReliefNeighbor = {
  id: string
  zip: string
  latitude: number
  longitude: number
}

export type ReliefStageProps = {
  propertyId: string
  zip: string
  latitude: number
  longitude: number
  neighbors: ReliefNeighbor[]
  showConnections: boolean
  className?: string
}

const ReliefCanvas = lazy(() => import('./ReliefCanvas').then((module) => ({ default: module.ReliefCanvas })))

const CAPTION = 'Depiction for orientation. Homes in this dataset are coordinates, not buildings.'

export function ReliefStage(props: ReliefStageProps) {
  const allowed = useReliefSceneAllowed()
  if (!allowed) return null
  return <MountedRelief {...props} />
}

function MountedRelief({ className, ...scene }: ReliefStageProps) {
  const viewRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const element = viewRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={className ? `relief-stage ${className}` : 'relief-stage'}>
      <div className="relief-stage__view" ref={viewRef} aria-hidden="true">
        <Suspense fallback={<div className="relief-stage__pending" />}>
          <ReliefCanvas {...scene} visible={visible} />
        </Suspense>
      </div>
      <p className="relief-stage__caption">{CAPTION}</p>
    </div>
  )
}
