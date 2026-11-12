import { useState } from 'react'
import { PlaceStage } from './PlaceStage'
import { SaleColumn } from './SaleColumn'
import { useReliefGate } from './useReliefGate'
import { useCachedPreviewNeighbors, usePreviewEstimate } from './usePreviewEstimate'

export function Hero() {
  const gate = useReliefGate()
  const { property } = usePreviewEstimate()
  // Cached preview neighbors only. The query is disabled, so this toggle cannot fetch.
  const neighbors = useCachedPreviewNeighbors()
  const [showConnections, setShowConnections] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  const home = property.data
  const scene = gate && home != null && !sceneFailed

  return (
    <section
      aria-labelledby="hero-title"
      className="lg:grid lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1fr)_clamp(36rem,38vw,42rem)]"
    >
      <PlaceStage
        enabled={scene}
        showPhoto={showPhoto}
        showConnections={showConnections}
        property={
          home
            ? {
                id: home.id,
                zip: home.zipcode ?? '',
                latitude: home.latitude,
                longitude: home.longitude,
              }
            : null
        }
        neighbors={neighbors.map((neighbor) => ({
          id: neighbor.property.id,
          zip: neighbor.property.zipcode ?? '',
          latitude: neighbor.property.latitude,
          longitude: neighbor.property.longitude,
        }))}
        onSceneFail={() => setSceneFailed(true)}
      />
      <SaleColumn
        scene={scene}
        showConnections={showConnections}
        showPhoto={showPhoto}
        onToggleConnections={() => setShowConnections((value) => !value)}
        onTogglePhoto={() => setShowPhoto((value) => !value)}
        neighbors={neighbors}
      />
    </section>
  )
}
