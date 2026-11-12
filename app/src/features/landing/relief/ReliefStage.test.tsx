import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReliefStageProps } from './ReliefStage'

const sceneLoads = vi.hoisted(() => vi.fn<() => void>())

vi.mock('./ReliefCanvas', () => {
  sceneLoads()
  return {
    ReliefCanvas: () => <div data-testid="relief-scene" />,
  }
})

vi.mock('three', () => {
  throw new Error('three loaded on the fallback path')
})

vi.mock('@react-three/fiber', () => {
  throw new Error('fiber loaded on the fallback path')
})

vi.mock('@react-three/drei', () => {
  throw new Error('drei loaded on the fallback path')
})

function installMedia(matches: (query: string) => boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}

const props: ReliefStageProps = {
  propertyId: 'KC-1042',
  zip: '98116',
  latitude: 47.57,
  longitude: -122.38,
  neighbors: [],
  showConnections: false,
}

async function renderStage() {
  const { ReliefStage } = await import('./ReliefStage')
  return render(<ReliefStage {...props} />)
}

describe('ReliefStage fallback', () => {
  it('returns null for reduced motion without loading the scene or WebGL', async () => {
    sceneLoads.mockClear()
    installMedia((query) => query.includes('prefers-reduced-motion'))
    const create = document.createElement.bind(document)
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      if (String(tag).toLowerCase() === 'canvas') throw new Error('webgl probe on the reduced-motion path')
      return create(tag, options)
    })
    const { container } = await renderStage()
    expect(container).toBeEmptyDOMElement()
    expect(sceneLoads).not.toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBeNull()
    spy.mockRestore()
  })

  it('returns null when WebGL cannot be created without loading the scene', async () => {
    sceneLoads.mockClear()
    installMedia(() => false)
    const create = document.createElement.bind(document)
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const element = create(tag, options)
      if (element instanceof HTMLCanvasElement) {
        element.getContext = (() => null) as HTMLCanvasElement['getContext']
      }
      return element
    })
    const { container } = await renderStage()
    expect(container).toBeEmptyDOMElement()
    expect(sceneLoads).not.toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBeNull()
    spy.mockRestore()
  })

  it('returns null for a narrow matchMedia query without loading the scene', async () => {
    sceneLoads.mockClear()
    installMedia((query) => query.includes('max-width'))
    const { container } = await renderStage()
    expect(container).toBeEmptyDOMElement()
    expect(sceneLoads).not.toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBeNull()
  })
})
