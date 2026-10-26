import { useQueryClient } from '@tanstack/react-query'
import { Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { SCENARIOS } from '@/mocks/scenarios'
import { useScenarios } from '@/services/context'

/**
 * Developer-only scenario switcher (mock mode, dev builds or
 * VITE_ENABLE_SCENARIOS=true). Not part of production navigation.
 */
export function DevScenarioPanel() {
  const { store, active } = useScenarios()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  if (!store) return null

  const toggle = (id: (typeof SCENARIOS)[number]['id']) => {
    store.toggle(id)
    const url = new URL(window.location.href)
    const list = store.list()
    if (list.length) url.searchParams.set('scenario', list.join(','))
    else url.searchParams.delete('scenario')
    window.history.replaceState(window.history.state, '', url)
    queryClient.clear()
  }

  return (
    <div className="fixed bottom-3 left-3 z-[60] font-sans text-sm">
      {open ? (
        <dialog
          open
          aria-label="Developer scenarios"
          className="m-0 w-72 rounded-lg border border-border bg-surface p-3 shadow-lift"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-ink">Dev scenarios</p>
            <button
              type="button"
              aria-label="Close developer scenarios"
              onClick={() => setOpen(false)}
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-sand-soft"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {SCENARIOS.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-sand-soft">
                  <input
                    type="checkbox"
                    className="mt-1 accent-evergreen"
                    checked={active.has(s.id)}
                    onChange={() => toggle(s.id)}
                    aria-label={`${s.label}. ${s.description}`}
                  />
                  <span>
                    <span className="block font-medium text-ink">{s.label}</span>
                    <span className="block text-xs text-ink-muted">{s.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">Changing scenarios clears cached requests.</p>
        </dialog>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 text-xs font-medium text-ink-muted shadow-soft hover:text-ink"
        >
          <Wrench aria-hidden className="size-3.5" />
          Dev{active.size ? ` · ${active.size} active` : ''}
        </button>
      )}
    </div>
  )
}
