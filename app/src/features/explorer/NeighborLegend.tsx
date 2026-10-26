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
    <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0">
      {creating ? (
        <path d="M10 18 C9 15 4 12 4 8 a6 6 0 0 1 12 0 c0 4 -5 7 -6 10Z" fill="#203a32" />
      ) : (
        <>
          <circle cx="10" cy="10" r="9" fill="#31594a" fillOpacity="0.16" />
          <circle cx="10" cy="10" r="5.5" fill="#fffefa" stroke="#31594a" strokeWidth="2.5" />
        </>
      )}
    </svg>
  )
}

function NeighborKey() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0">
      <rect x="4" y="4" width="12" height="12" rx="3" fill="#9a654a" stroke="#fffefa" strokeWidth="1.5" />
    </svg>
  )
}

function EdgeKey({ dashed = false }: { dashed?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0">
      <line x1="1" y1="10" x2="19" y2="10" stroke="#9a654a" strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
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
        'w-full rounded-xl border border-border bg-surface/97 shadow-soft',
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
            className="h-6 w-10 rounded-full border border-control/70 bg-sand transition-colors duration-150 peer-checked:border-evergreen peer-checked:bg-evergreen peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-evergreen"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 left-1 size-4 rounded-full bg-surface shadow-soft transition-transform duration-150 peer-checked:translate-x-4"
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
                className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-[0.8125rem] font-medium text-evergreen"
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
