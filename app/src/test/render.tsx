import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/AppProviders'
import { createQueryClient } from '@/app/queryClient'
import { MockKingSightClient } from '@/mocks/MockKingSightClient'
import { ScenarioStore, type ScenarioId } from '@/mocks/scenarios'

type RenderOptions = {
  path?: string
  initialEntries?: string[]
  scenarios?: ScenarioId[]
}

/** Renders UI with a zero-latency mock client and an in-memory router. */
export function renderWithApp(ui: ReactNode, options: RenderOptions = {}) {
  const { path = '/', initialEntries, scenarios = [] } = options
  const entries = initialEntries ?? [path]
  const store = new ScenarioStore(scenarios)
  const client = new MockKingSightClient({ scenarios: store, latencyMs: 0 })
  const queryClient = createQueryClient()
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: entries })
  const utils = render(
    <AppProviders value={{ client, scenarios: store }} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...utils, client, store, router, queryClient }
}
