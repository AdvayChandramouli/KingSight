import { lazy, Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { config } from './config'

const DevScenarioPanel = config.scenariosEnabled
  ? lazy(async () => ({ default: (await import('./DevScenarioPanel')).DevScenarioPanel }))
  : null

export function RootLayout() {
  if (config.configError) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <h1 className="font-display text-4xl text-ink">KingSight is not configured</h1>
        <p className="mt-4 text-ink-muted">{config.configError}</p>
        <p className="mt-2 text-sm text-ink-muted">
          See <code>.env.example</code>. The app does not switch data modes automatically.
        </p>
      </main>
    )
  }
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-evergreen px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Outlet />
      <ScrollRestoration />
      {DevScenarioPanel && (
        <Suspense fallback={null}>
          <DevScenarioPanel />
        </Suspense>
      )}
    </>
  )
}
