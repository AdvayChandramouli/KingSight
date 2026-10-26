import { ArrowLeft, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

export function PanelShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-2xl space-y-6 px-5 py-6 sm:px-7 sm:py-7">{children}</div>
}

/** Labeled loading state so the panel never looks blank or broken. */
export function PanelLoading({ label }: { label: string }) {
  return (
    <PanelShell>
      <output className="block text-sm font-medium text-ink-muted">{label}</output>
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    </PanelShell>
  )
}

export function PanelMessage({
  title,
  children,
  onBrowse,
}: {
  title: string
  children: ReactNode
  onBrowse: () => void
}) {
  return (
    <PanelShell>
      <div className="space-y-4 py-6">
        <SearchX aria-hidden className="size-8 text-ink-muted" strokeWidth={1.5} />
        <h2 className="font-display text-[1.75rem] leading-tight font-semibold text-ink">{title}</h2>
        <div className="space-y-2 text-[0.95rem] text-ink-muted">{children}</div>
        <Button variant="secondary" onClick={onBrowse}>
          <ArrowLeft aria-hidden className="size-4" />
          Browse properties
        </Button>
      </div>
    </PanelShell>
  )
}
