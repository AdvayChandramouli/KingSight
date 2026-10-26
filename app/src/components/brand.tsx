import { FlaskConical, History } from 'lucide-react'
import { modelFamilyStyle } from '@/components/modelFamilyStyle'
import { Link } from 'react-router'
import { useDataMode } from '@/services/context'
import type { ModelInfo } from '@/services/types'
import { cn } from './ui/cn'

export const HISTORICAL_LABEL = 'Historical estimates · 2014–2015 sales'

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-2.5 rounded-md text-ink no-underline', className)}
      aria-label="KingSight home"
    >
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" fill="#31594A" />
        <path d="M6 22.5 12.2 13l3.6 5.2 3-4.3L26 22.5Z" fill="#DCE7EB" />
        <path d="M6 22.5h20" stroke="#F7F4EE" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="21.5" cy="9.5" r="2.2" fill="#E9E1D4" />
      </svg>
      <span className="font-display text-[1.4rem] leading-none font-semibold tracking-[-0.02em]">
        KingSight
      </span>
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
        'inline-flex items-center gap-1.5 rounded-full border border-clay/40 bg-clay-soft px-2.5 py-1 text-[0.8125rem] font-medium text-clay-ink',
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
    <span className={cn('inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-muted', className)}>
      <History aria-hidden className="size-3.5" />
      {HISTORICAL_LABEL}
    </span>
  )
}

/** Model identity: icon + name + color, never color alone. */
export function ModelTag({ model, className, showVersion = false }: { model: ModelInfo; className?: string; showVersion?: boolean }) {
  const s = modelFamilyStyle(model.family)
  const Icon = s.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', s.text, className)}>
      <Icon aria-hidden className="size-4" />
      {model.perspective_label}
      {showVersion && <span className="font-normal text-ink-muted">· {model.display_name} {model.version}</span>}
    </span>
  )
}
