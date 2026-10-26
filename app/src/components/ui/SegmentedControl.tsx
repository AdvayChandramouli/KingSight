import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { ReactNode } from 'react'
import { cn } from './cn'

type Option<T extends string> = { value: T; label: ReactNode; ariaLabel?: string }

type Props<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  label: string
  className?: string
  size?: 'sm' | 'md'
}

/** Single-select segmented control; selection shown by fill and weight. */
export function SegmentedControl<T extends string>({ value, onChange, options, label, className, size = 'md' }: Props<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn('inline-flex rounded-full border border-border bg-sand-soft p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 font-medium text-ink-muted transition-colors duration-150 hover:text-ink data-[state=on]:bg-surface data-[state=on]:font-semibold data-[state=on]:text-ink data-[state=on]:shadow-soft',
            size === 'sm' ? 'min-h-9 text-sm' : 'min-h-11 text-[0.95rem]',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
