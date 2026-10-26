import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { DemoBadge, Wordmark } from './brand'
import { buttonClasses } from './ui/buttonClasses'
import { cn } from './ui/cn'

type Props = {
  variant: 'landing' | 'explorer'
  /** Explorer opens the "How it works" drawer instead of anchoring. */
  onHowItWorks?: () => void
}

export function SiteHeader({ variant, onHowItWorks }: Props) {
  const compact = variant === 'explorer'
  return (
    <header
      className={cn(
        'relative z-20 w-full',
        compact ? 'border-b border-border bg-surface' : 'bg-canvas',
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center justify-between gap-3',
          compact ? 'h-16 px-4 sm:px-6' : 'h-20 max-w-[90rem] px-4 sm:px-8 lg:px-12',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Wordmark />
          <DemoBadge className="max-sm:hidden" />
        </div>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {onHowItWorks ? (
            <button type="button" onClick={onHowItWorks} className={buttonClasses('quiet', 'sm', 'min-h-11 px-2.5 sm:px-3.5')}>
              How it works
            </button>
          ) : (
            <a href="/#how-it-works" className={buttonClasses('quiet', 'sm', 'min-h-11 px-2.5 no-underline sm:px-3.5')}>
              How it works
            </a>
          )}
          <Link
            to="/explore"
            aria-label="Explore properties"
            className={buttonClasses('primary', 'sm', 'min-h-11 px-3.5 no-underline sm:px-4')}
          >
            <span className="sm:hidden">Explore</span>
            <span className="hidden sm:inline">Explore properties</span>
            <ArrowRight aria-hidden className="hidden size-4 sm:block" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
