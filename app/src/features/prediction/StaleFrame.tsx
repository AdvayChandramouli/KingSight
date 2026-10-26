import { History } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export function PreviousEstimateBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-[0.8125rem] font-semibold text-warning',
        className,
      )}
    >
      <History aria-hidden className="size-3.5" />
      Previous estimate
    </span>
  )
}

type Props = {
  stale: boolean
  /** Explains what the stale content belongs to. */
  message: ReactNode
  children: ReactNode
  className?: string
}

/**
 * De-emphasizes results that belong to an earlier input snapshot. The frame
 * desaturates rather than fades so muted text keeps AA contrast.
 */
export function StaleFrame({ stale, message, children, className }: Props) {
  if (!stale) return <div className={className}>{children}</div>
  return (
    <div className={cn('space-y-3', className)} data-stale="true">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PreviousEstimateBadge />
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
      <div className="rounded-xl border border-dashed border-control/60 bg-sand-soft/70 p-2 grayscale sm:p-3">
        {children}
      </div>
    </div>
  )
}
