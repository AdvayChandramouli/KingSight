import { FlaskConical } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useDataMode } from '@/services/context'

/** Marks landing examples. With real data it names what is shown instead. */
export function IllustrativeTag({
  realLabel,
  mockLabel = 'Illustrative · demo data',
  className,
}: {
  realLabel: string
  mockLabel?: string
  className?: string
}) {
  const mode = useDataMode()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium',
        mode === 'mock' ? 'bg-clay-soft text-clay-ink' : 'bg-sand-soft text-ink-muted',
        className,
      )}
    >
      {mode === 'mock' && <FlaskConical aria-hidden className="size-3.5" />}
      {mode === 'mock' ? mockLabel : realLabel}
    </span>
  )
}
