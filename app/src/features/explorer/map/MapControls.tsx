import { Minus, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/components/ui/cn'

type Props = {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  canZoomIn?: boolean
  canZoomOut?: boolean
  className?: string
}

const iconButton =
  'inline-flex size-11 items-center justify-center text-ink transition-colors duration-150 hover:bg-evergreen-soft disabled:cursor-not-allowed disabled:text-ink-muted/50 disabled:hover:bg-transparent'

export function MapControls({ onZoomIn, onZoomOut, onReset, canZoomIn = true, canZoomOut = true, className }: Props) {
  return (
    <div className={cn('pointer-events-auto flex items-start gap-2', className)}>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink shadow-soft transition-colors duration-150 hover:border-evergreen hover:bg-evergreen-soft"
      >
        <RotateCcw aria-hidden className="size-4 text-evergreen" />
        Reset map
      </button>
      <fieldset className="flex flex-col overflow-hidden rounded-full border border-border bg-surface shadow-soft">
        <legend className="sr-only">Zoom</legend>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn} disabled={!canZoomIn} className={iconButton}>
          <Plus aria-hidden className="size-4.5" />
        </button>
        <span aria-hidden className="mx-2.5 h-px bg-border" />
        <button type="button" aria-label="Zoom out" onClick={onZoomOut} disabled={!canZoomOut} className={iconButton}>
          <Minus aria-hidden className="size-4.5" />
        </button>
      </fieldset>
    </div>
  )
}
