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
  'inline-flex size-11 items-center justify-center text-ink transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-muted/50 disabled:hover:bg-transparent'

export function MapControls({ onZoomIn, onZoomOut, onReset, canZoomIn = true, canZoomOut = true, className }: Props) {
  return (
    <div className={cn('pointer-events-auto flex items-start gap-2', className)}>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-ink hover:bg-canvas"
      >
        <RotateCcw aria-hidden className="size-4 text-ink" />
        Reset map
      </button>
      <fieldset className="flex flex-col overflow-hidden rounded-sm border border-border bg-surface">
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
