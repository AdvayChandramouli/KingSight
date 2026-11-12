import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { heroPhotograph } from '@/features/landing/media/ledger'
import { cn } from '@/components/ui/cn'
import { PhotoCaption } from './PhotoCaption'

const ReliefStage = lazy(() =>
  import('@/features/landing/relief/ReliefStage').then((module) => ({
    default: module.ReliefStage,
  })),
)

export type ReliefNeighbor = {
  id: string
  zip: string
  latitude: number
  longitude: number
}

type Point = {
  id: string
  zip: string
  latitude: number
  longitude: number
}

type Props = {
  /** Device can run the scene. Still requires a loaded preview home. */
  enabled: boolean
  showPhoto: boolean
  showConnections: boolean
  property: Point | null
  neighbors: ReliefNeighbor[]
  onSceneFail: () => void
}

const SWAP = 'transition-opacity duration-[400ms] ease-out-expo motion-reduce:transition-none'

export function PlaceStage({ enabled, showPhoto, showConnections, property, neighbors, onSceneFail }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const [painted, setPainted] = useState(false)
  const showModel = enabled && property != null && !showPhoto && painted

  useEffect(() => {
    const node = frame.current
    if (!enabled || !node) return
    const look = () => setPainted(node.childElementCount > 0)
    look()
    const observer = new MutationObserver(look)
    observer.observe(node, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [enabled])

  return (
    <figure id="landing-stage" className="flex h-full flex-col bg-fir lg:min-h-[calc(100dvh-5rem)]">
      <div className="relative aspect-[4/5] max-h-[68dvh] min-h-[16rem] flex-1 sm:aspect-[16/10] lg:aspect-auto lg:max-h-none lg:min-h-[22rem]">
        <img
          src={heroPhotograph.src}
          alt={heroPhotograph.alt}
          fetchPriority="high"
          decoding="async"
          className="ks-plate absolute inset-0 h-full w-full object-cover"
          aria-hidden={showModel || undefined}
        />
        {enabled && property && (
          <ReliefBoundary onFail={onSceneFail}>
            <div
              ref={frame}
              className={cn('absolute inset-0', SWAP, showPhoto ? 'pointer-events-none opacity-0' : 'opacity-100')}
              aria-hidden={showPhoto ? true : undefined}
              inert={showPhoto ? true : undefined}
            >
              <Suspense fallback={null}>
                <ReliefStage
                  propertyId={property.id}
                  zip={property.zip}
                  latitude={property.latitude}
                  longitude={property.longitude}
                  neighbors={neighbors}
                  showConnections={showConnections}
                  className="h-full w-full"
                />
              </Suspense>
            </div>
          </ReliefBoundary>
        )}
        {!showModel && <BrassPin />}
      </div>
      {showModel ? (
        <p className="sr-only">Orientation model.</p>
      ) : (
        <figcaption>
          <PhotoCaption photo={heroPhotograph} />
        </figcaption>
      )}
    </figure>
  )
}

function BrassPin() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 56"
      className="pointer-events-none absolute bottom-[18%] left-[46%] h-14 w-6 text-brass"
    >
      <circle cx="12" cy="8" r="7.5" className="fill-canvas" />
      <circle cx="12" cy="8" r="5.5" fill="currentColor" />
      <circle cx="12" cy="8" r="2" className="fill-canvas" />
      <path d="M12 14v36" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

class ReliefBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(): void {
    this.props.onFail()
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}
