import { FlaskConical, History } from 'lucide-react'
import { modelFamilyStyle } from '@/components/modelFamilyStyle'
import { Link } from 'react-router'
import { useDataMode } from '@/services/context'
import type { ModelInfo } from '@/services/types'
import { cn } from './ui/cn'

export const FOLIO_LABEL = 'King County · May 2014–May 2015'
export const HISTORICAL_LABEL = 'Historical estimates · 2014–2015 sales'

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-2.5 text-ink no-underline', className)}
      aria-label="KingSight home"
    >
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" fill="var(--color-ink)" />
        <path d="M3.5 24 11 14.2l4.2 5.2 3.4-4.4L28.5 24Z" fill="var(--color-basswood)" />
        <path d="M3.5 24h25" stroke="var(--color-water)" strokeWidth="2" />
        <rect x="20.25" y="6.5" width="5" height="5" fill="var(--color-brass)" />
      </svg>
      <span className="font-display text-[1.35rem] leading-none font-semibold tracking-[-0.02em]">KingSight</span>
    </Link>
  )
}

/** Persistent, understated badge shown whenever the app runs on mock data. */
export function DemoBadge({ className }: { className?: string }) {
  const mode = useDataMode()
  if (mode !== 'mock') return null
  return (
    <span
      className={cn(
        'text-label inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 text-ink',
        className,
      )}
      title="Estimates, explanations, and properties are illustrative demo data."
    >
      <FlaskConical aria-hidden className="size-3.5" />
      Demo data
    </span>
  )
}

export function HistoricalLabel({ className }: { className?: string }) {
  return (
    <span className={cn('text-label inline-flex items-center gap-1.5 text-ink-muted', className)}>
      <History aria-hidden className="size-3.5" />
      {HISTORICAL_LABEL}
    </span>
  )
}

/** Model identity: icon + name + ink. Color never carries the name alone. */
export function ModelTag({ model, className, showVersion = false }: { model: ModelInfo; className?: string; showVersion?: boolean }) {
  const s = modelFamilyStyle(model.family)
  const Icon = s.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', s.text, className)}>
      <Icon aria-hidden className="size-4" />
      {model.perspective_label}
      {showVersion && (
        <span className="font-normal text-ink-muted">
          · {model.display_name} {model.version}
        </span>
      )}
    </span>
  )
}
