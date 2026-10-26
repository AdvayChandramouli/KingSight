import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-[background-color,color,box-shadow,border-color,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-evergreen text-white shadow-soft hover:bg-evergreen-strong focus-visible:outline-evergreen',
  secondary:
    'border border-control/60 bg-surface text-ink hover:border-evergreen hover:bg-evergreen-soft',
  ghost: 'text-evergreen hover:bg-evergreen-soft',
  quiet: 'text-ink-muted hover:text-ink hover:bg-sand-soft',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-11 px-5 text-[0.95rem]',
  lg: 'min-h-12 px-6 text-base',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}
