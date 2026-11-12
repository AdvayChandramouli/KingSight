import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { DemoBadge, FOLIO_LABEL, Wordmark } from './brand'
import { buttonClasses } from './ui/buttonClasses'

type Props = {
  variant: 'landing' | 'explorer'
  /** Explorer opens the "How it works" drawer instead of anchoring. */
  onHowItWorks?: () => void
}

const textLink =
  'inline-flex min-h-11 items-center text-label text-ink underline decoration-border underline-offset-[0.22em] transition-colors duration-feedback ease-out-expo hover:decoration-ink'

export function SiteHeader({ variant, onHowItWorks }: Props) {
  return (
    <header data-header={variant} className="relative z-20 w-full border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:min-h-14 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Wordmark />
          <DemoBadge className="max-lg:hidden" />
        </div>
        <p className="text-label order-last basis-full text-ink-muted min-[540px]:order-none min-[540px]:basis-auto">
          {FOLIO_LABEL}
        </p>
        <nav aria-label="Primary" className="ml-auto flex items-center gap-3 sm:gap-5">
          {onHowItWorks ? (
            <button type="button" onClick={onHowItWorks} className={textLink}>
              How it works
            </button>
          ) : (
            <a href="/#how-it-works" className={textLink}>
              How it works
            </a>
          )}
          <Link
            to="/explore"
            aria-label="Explore properties"
            className={buttonClasses('primary', 'sm', 'px-3 no-underline sm:px-4')}
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
