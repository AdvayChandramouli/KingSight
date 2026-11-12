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

/** Single-select segmented control. The selected item is heavier and carries a brass square. */
export function SegmentedControl<T extends string>({ value, onChange, options, label, className, size = 'md' }: Props<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn('inline-flex rounded-md border border-border bg-sand-soft p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-3.5 font-medium text-ink-muted transition-colors duration-feedback ease-out-expo hover:text-ink data-[state=on]:bg-surface data-[state=on]:font-semibold data-[state=on]:text-ink',
            size === 'sm' ? 'min-h-11 text-label' : 'min-h-11 text-base',
          )}
        >
          {value === o.value && <span aria-hidden className="size-1.5 shrink-0 bg-brass" />}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
