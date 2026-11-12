import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockKingSightClient } from '@/mocks/MockKingSightClient'
import { LandingPage } from '@/pages/LandingPage'
import { renderWithApp } from '@/test/render'

const webgl = vi.hoisted(() => ({ on: false }))

vi.mock('@/features/explorer/map/webgl', () => ({
  hasWebGL: () => webgl.on,
}))

vi.mock('@/features/landing/relief/ReliefStage', () => ({
  ReliefStage: (props: { propertyId: string; zip: string; showConnections: boolean; neighbors: unknown[] }) => (
    <div
      data-testid="relief-stage"
      data-property={props.propertyId}
      data-zip={props.zip}
      data-connections={String(props.showConnections)}
      data-neighbors={String(props.neighbors.length)}
    />
  ),
}))

const originalMatchMedia = window.matchMedia

afterEach(() => {
  webgl.on = false
  window.matchMedia = originalMatchMedia
})

function setViewport({ wide, reduced }: { wide: boolean; reduced: boolean }) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('min-width') ? wide : query.includes('prefers-reduced-motion') ? reduced : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

describe('LandingPage', () => {
  it('has one h1, the explorer CTA, and the historical label above the fold', () => {
    renderWithApp(<LandingPage />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Two readings of one sale.')

    const hero = h1s[0]!.closest('section')!
    expect(within(hero).getByText('King County · May 2014–May 2015')).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: /explore properties/i })).toHaveAttribute('href', '/explore')
    expect(within(hero).getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how-it-works')
    expect(within(hero).getByText('Historical estimates · 2014–2015 sales')).toBeInTheDocument()
    expect(within(hero).getByText('The graph reading also uses homes connected to this one.')).toBeInTheDocument()
    expect(within(hero).queryByRole('button', { name: 'Show connections' })).not.toBeInTheDocument()
    expect(within(hero).queryByRole('button', { name: 'See the photograph' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('relief-stage')).not.toBeInTheDocument()
    expect(document.getElementById('how-it-works')).not.toBeNull()
  })

  it('shows the preview estimate for KC-1042 and links to it', async () => {
    renderWithApp(<LandingPage />)
    expect(screen.getByRole('link', { name: /open this property/i })).toHaveAttribute(
      'href',
      '/explore?property=KC-1042',
    )
    expect(await screen.findByRole('heading', { name: 'Property KC-1042', level: 2 }, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByText('ZIP 98115')).toBeInTheDocument()
    expect(screen.getByText('Estimated historical value')).toBeInTheDocument()
    expect(screen.getByText('Recorded sale')).toBeInTheDocument()
    expect(await screen.findAllByText(/^\$[\d,]+$/, {}, { timeout: 3000 })).not.toHaveLength(0)
    expect(screen.getByText('Illustrative preview · demo data')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Elliott Bay/i })).toBeInTheDocument()
    expect(document.querySelector('.maplibregl-map, .maplibregl-canvas')).toBeNull()
    expect(screen.queryByText('OpenStreetMap')).not.toBeInTheDocument()
  })

  it('does not fetch neighbors for the preview map', async () => {
    const spy = vi.spyOn(MockKingSightClient.prototype, 'getNeighbors')
    renderWithApp(<LandingPage />)
    expect(await screen.findByRole('heading', { name: 'Property KC-1042', level: 2 }, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByText(/Valued in the 2015 market/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('toggles connections from the cached preview without a neighbor request', async () => {
    webgl.on = true
    setViewport({ wide: true, reduced: false })
    const spy = vi.spyOn(MockKingSightClient.prototype, 'getNeighbors')
    renderWithApp(<LandingPage />)

    const button = await screen.findByRole('button', { name: 'Show connections' }, { timeout: 3000 })
    const stage = await waitFor(() => {
      const node = document.querySelector('[data-testid="relief-stage"]')
      expect(node).not.toBeNull()
      return node!
    })
    expect(stage).toHaveAttribute('data-property', 'KC-1042')
    expect(stage).toHaveAttribute('data-zip', '98115')
    expect(stage).toHaveAttribute('data-connections', 'false')
    expect(stage).toHaveAttribute('data-neighbors', '0')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('relief-stage')).toHaveAttribute('data-connections', 'true')

    const photograph = screen.getByRole('button', { name: 'See the photograph' })
    fireEvent.click(photograph)
    expect(photograph).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'See the model' })).toBeInTheDocument()
    expect(screen.getByText(/Elliott Bay and downtown Seattle/)).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('keeps the photograph and skips the scene when motion is reduced', async () => {
    webgl.on = true
    setViewport({ wide: true, reduced: true })
    renderWithApp(<LandingPage />)
    expect(await screen.findByRole('heading', { name: 'Property KC-1042', level: 2 }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show connections' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('relief-stage')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Elliott Bay/i })).toBeInTheDocument()
    expect(screen.getByText(/Elliott Bay and downtown Seattle/)).toBeInTheDocument()
  })

  it('labels contribution direction with text and signs', async () => {
    renderWithApp(<LandingPage />)
    const panel = (await screen.findAllByText(/^(raised|lowered)$/, {}, { timeout: 3000 }))[0]!
    const row = panel.closest('li')!
    expect(within(row).getByText(/^[+−]/)).toBeInTheDocument()
  })

  it('credits the dataset and states the appraisal disclaimer', () => {
    renderWithApp(<LandingPage />)
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: /kaggle/i })).toHaveAttribute(
      'href',
      'https://www.kaggle.com/datasets/harlfoxem/housesalesprediction',
    )
    expect(within(footer).getByText('Estimates are not professional appraisals.')).toBeInTheDocument()
  })
})
