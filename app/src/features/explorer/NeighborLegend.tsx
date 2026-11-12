import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/components/ui/cn'
import type { NeighborContext } from '@/services/types'
import { useExplorer } from './explorerState'

type Props = {
  context: NeighborContext
  className?: string
  /** Small screens: keys in one row and the graph rule behind a toggle. */
  compact?: boolean
}

function TargetKey({ creating }: { creating: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={cn('size-5 shrink-0', creating ? 'text-ink' : 'text-brass')}>
      <path d="M10 18 C9.2 15.2 5 12.5 5 8.5 a5 5 0 0 1 10 0 c0 4 -4.2 6.7 -5 9.5Z" fill="currentColor" />
      <rect x="8" y="5.5" width="4" height="4" fill="var(--color-surface)" />
    </svg>
  )
}

function NeighborKey() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0 text-clay">
      <rect x="4" y="4" width="12" height="12" fill="currentColor" stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  )
}

function EdgeKey({ dashed = false }: { dashed?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0 text-clay">
      <line x1="1" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
  )
}

/** Legend and visibility toggle for the selected target's graph connections. */
export function NeighborLegend({ context, className, compact = false }: Props) {
  const { showNeighbors, setShowNeighbors, mode } = useExplorer()
  const toggleId = useId()
  const ruleId = useId()
  const [ruleOpen, setRuleOpen] = useState(false)
  const count = context.neighbors.length
  const hasSimilarity = context.neighbors.some((n) => n.edge_type === 'similarity')
  const creating = mode === 'create'

  const items = [
    {
      key: 'target',
      icon: <TargetKey creating={creating} />,
      label: creating ? 'Your new property' : 'Selected property',
      short: creating ? 'New property' : 'Selected',
    },
    { key: 'home', icon: <NeighborKey />, label: `Connected home (${count})`, short: `Connected (${count})` },
    { key: 'edge', icon: <EdgeKey />, label: 'Graph connection', short: 'Connection' },
    ...(hasSimilarity
      ? [{ key: 'similar', icon: <EdgeKey dashed />, label: 'Connection by similar home features', short: 'Similar features' }]
      : []),
  ]

  return (
    <section
      aria-label="Graph connections legend"
      className={cn(
        'w-full rounded-sm border border-border bg-surface',
        compact ? 'px-3.5 py-2' : 'max-w-[19rem] p-3.5',
        className,
      )}
    >
      <label htmlFor={toggleId} className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Show graph connections</span>
        <span className="relative inline-flex shrink-0">
          <input
            id={toggleId}
            type="checkbox"
            role="switch"
            aria-checked={showNeighbors}
            checked={showNeighbors}
            onChange={(e) => setShowNeighbors(e.target.checked)}
            className="peer absolute inset-0 cursor-pointer opacity-0"
          />
          <span
            aria-hidden
            className="h-6 w-10 rounded-sm border border-ink bg-canvas transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] peer-checked:border-brass peer-checked:bg-ink peer-checked:ring-1 peer-checked:ring-brass peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brass"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 left-1 size-4 bg-surface transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] peer-checked:translate-x-4"
          />
        </span>
      </label>

      {showNeighbors && (
        <>
          <ul
            className={cn(
              'text-[0.8125rem] text-ink',
              compact ? 'flex flex-wrap gap-x-3.5 gap-y-1 pb-1' : 'mt-2 space-y-1.5',
            )}
          >
            {items.map((item) => (
              <li key={item.key} className={cn('flex items-center', compact ? 'gap-1' : 'gap-2.5')}>
                {item.icon}
                {compact ? item.short : item.label}
              </li>
            ))}
          </ul>
          {compact ? (
            <>
              <button
                type="button"
                aria-expanded={ruleOpen}
                aria-controls={ruleId}
                onClick={() => setRuleOpen((o) => !o)}
                className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-sm px-1 text-[0.8125rem] font-medium text-ink underline decoration-brass underline-offset-4"
              >
                How homes are connected
                <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-150', ruleOpen && 'rotate-180')} />
              </button>
              {ruleOpen && (
                <p id={ruleId} className="pb-1.5 text-[0.8125rem] leading-snug text-ink-muted">
                  {context.rule_label}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 border-t border-border pt-2 text-[0.8125rem] leading-snug text-ink-muted">
              {context.rule_label}
            </p>
          )}
        </>
      )}
    </section>
  )
}
