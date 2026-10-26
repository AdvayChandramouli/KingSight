import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithApp } from '@/test/render'
import { DiscoveryPane } from './DiscoveryPane'
import { ExplorerProvider } from './ExplorerProvider'

function renderPane(options: Parameters<typeof renderWithApp>[1] = {}) {
  return renderWithApp(
    <ExplorerProvider onOpenHowItWorks={() => {}}>
      <DiscoveryPane />
    </ExplorerProvider>,
    { path: '/explore', ...options },
  )
}

async function openList(user: ReturnType<typeof userEvent.setup>) {
  // jsdom reports a narrow viewport, so the mobile Map | List switch is shown.
  await user.click(screen.getByText('List').closest('button')!)
  return screen.findByRole('list', { name: 'Properties' })
}

describe('DiscoveryPane', () => {
  it('lists properties with recorded sales and selects one into the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderPane()
    const list = await openList(user)

    const row = within(list).getByRole('button', { name: /Property KC-1001/ })
    expect(row).toHaveTextContent('ZIP 98103')
    expect(row).toHaveTextContent('1,210 sq ft')
    expect(row).toHaveTextContent('Sold $580,500 · Feb 2015')
    expect(row).not.toHaveAttribute('aria-current')

    await user.click(row)
    expect(new URLSearchParams(router.state.location.search).get('property')).toBe('KC-1001')
    const selected = await screen.findByRole('button', { name: /Property KC-1001/, current: true })
    expect(selected).toHaveTextContent('Selected')
  })

  it('reports filtered counts against the overall total', async () => {
    const user = userEvent.setup()
    renderPane()
    await openList(user)
    const overall = await screen.findByText(/^\d+ properties$/)
    const total = Number(overall.textContent!.split(' ')[0])

    await user.type(screen.getByLabelText('Search property ID or ZIP'), '98103')
    await waitFor(() => {
      const filtered = screen.getByText(new RegExp(`^\\d+ of ${total} properties$`))
      expect(Number(filtered.textContent!.split(' ')[0])).toBeLessThan(total)
    })
  })

  it('explains when nothing matches and Clear filters restores results', async () => {
    const user = userEvent.setup()
    renderPane()
    await openList(user)

    const search = screen.getByLabelText('Search property ID or ZIP')
    await user.type(search, 'no-such-home')
    expect(await screen.findByText('No properties match these filters')).toBeInTheDocument()

    const empty = screen.getByText('No properties match these filters').parentElement!
    await user.click(within(empty).getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByRole('list', { name: 'Properties' })).toBeInTheDocument()
    await waitFor(() => expect(search).toHaveValue(''))
  })

  it('shows the empty state for the empty-results scenario', async () => {
    const user = userEvent.setup()
    renderPane({ scenarios: ['empty'] })
    await user.click(screen.getByText('List').closest('button')!)
    expect(await screen.findByText('No properties match these filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('shows a calm unavailable map and keeps the list for the map-unavailable scenario', async () => {
    const user = userEvent.setup()
    renderPane({ scenarios: ['map-unavailable'] })
    expect(await screen.findByRole('heading', { name: 'Map unavailable' })).toBeInTheDocument()
    expect(await openList(user)).toBeInTheDocument()
  })
})
