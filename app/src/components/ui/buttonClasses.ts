import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger' | 'field'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none transition-[background-color,color,border-color,box-shadow] duration-feedback ease-out-expo disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-surface hover:bg-evergreen-strong',
  secondary: 'border border-border bg-surface text-ink hover:border-ink hover:bg-sand-soft',
  ghost: 'text-ink hover:bg-sand-soft',
  quiet: 'text-ink-muted underline-offset-[0.22em] hover:text-ink hover:underline',
  danger: 'bg-danger text-surface hover:bg-danger/90',
  /** Basswood action for a control that sits on fir. Includes the paper focus ring. */
  field: 'on-fir bg-basswood text-fir hover:bg-sand-soft focus-visible:outline-surface',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-label',
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-12 px-5 text-base',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}
