import { MapPinOff } from 'lucide-react'
import { useEffect } from 'react'
import { useExplorer } from '../explorerState'

/** Calm in-place state when no map engine can render; the list and forms keep working. */
export function MapUnavailable({ detail, insetLeft = 0 }: { detail?: string; insetLeft?: number }) {
  const { setMapUnavailable } = useExplorer()

  useEffect(() => {
    setMapUnavailable(true)
    return () => setMapUnavailable(false)
  }, [setMapUnavailable])

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-sand-soft p-6" style={{ paddingLeft: insetLeft + 24 }}>
      <output className="block max-w-sm rounded-xl border border-border bg-surface px-6 py-6 text-center shadow-soft">
        <span className="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-full bg-sand text-ink-muted">
          <MapPinOff aria-hidden className="size-5" />
        </span>
        <h2 className="font-display text-xl text-ink">Map unavailable</h2>
        <p className="mt-2 text-sm text-ink-muted">
          The map can’t be shown right now. You can still browse and select properties from the list, and enter
          coordinates for a new property in the form.
        </p>
        {detail && <p className="mt-2 text-[0.8125rem] text-ink-muted">{detail}</p>}
      </output>
    </div>
  )
}
