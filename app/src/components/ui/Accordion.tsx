import * as RadixAccordion from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

type Props = {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  value?: string
}

/** A single collapsible section (progressive disclosure). */
export function Disclosure({ title, subtitle, children, defaultOpen, className, value = 'item' }: Props) {
  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? value : undefined}
      className={cn('rounded-lg border border-border bg-surface', className)}
    >
      <RadixAccordion.Item value={value}>
        <RadixAccordion.Header>
          <RadixAccordion.Trigger className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-sand-soft/60">
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{title}</span>
              {subtitle && <span className="block text-sm text-ink-muted">{subtitle}</span>}
            </span>
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </RadixAccordion.Trigger>
        </RadixAccordion.Header>
        <RadixAccordion.Content className="overflow-hidden px-4 pb-4">{children}</RadixAccordion.Content>
      </RadixAccordion.Item>
    </RadixAccordion.Root>
  )
}
