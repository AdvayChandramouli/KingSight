import { AlertTriangle, Info, OctagonAlert, RotateCcw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from './cn'

type Tone = 'info' | 'warning' | 'error' | 'neutral'

const tones: Record<Tone, { box: string; icon: LucideIcon; iconColor: string }> = {
  info: { box: 'bg-mist-soft border-mist', icon: Info, iconColor: 'text-deep-blue' },
  warning: { box: 'bg-warning-soft border-warning/25', icon: AlertTriangle, iconColor: 'text-warning' },
  error: { box: 'bg-danger-soft border-danger/25', icon: OctagonAlert, iconColor: 'text-danger' },
  neutral: { box: 'bg-sand-soft border-border', icon: Info, iconColor: 'text-ink-muted' },
}

type Props = {
  tone?: Tone
  title?: string
  children?: ReactNode
  action?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
  /** Use `alert` only for errors the user must notice immediately. */
  role?: 'status' | 'alert'
}

/** Inline status/error message. Icon + text, never color alone. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  onRetry,
  retryLabel = 'Try again',
  className,
  role = 'status',
}: Props) {
  const t = tones[tone]
  const Icon = t.icon
  return (
    <div role={role} className={cn('flex gap-3 rounded-md border px-4 py-3 text-sm', t.box, className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', t.iconColor)} strokeWidth={2} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className="text-ink-muted [&_strong]:text-ink">{children}</div>}
        {(onRetry || action) && (
          <div className="flex flex-wrap gap-2 pt-1.5">
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RotateCcw aria-hidden className="size-3.5" />
                {retryLabel}
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
