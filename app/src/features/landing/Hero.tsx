import { ArrowRight, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { DemoBadge, HistoricalLabel } from '@/components/brand'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { useDataMode } from '@/services/context'
import { PnwLandscape } from './art/PnwLandscape'

export function Hero() {
  const mode = useDataMode()
  return (
    <section aria-labelledby="hero-title" className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
      <div className="grid items-center gap-10 pt-6 pb-16 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14 lg:pt-8 lg:pb-24 xl:gap-20">
        <div className="max-w-[36rem]">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted">
            <MapPin aria-hidden className="size-4 text-evergreen" />
            King County, Washington
          </p>
          <h1
            id="hero-title"
            className="font-display-soft mt-5 text-[2.5rem] leading-[1.03] font-medium tracking-[-0.03em] text-ink sm:text-[3.5rem] lg:text-[3.75rem] xl:text-[4.25rem]"
          >
            Every home has a neighborhood story.
          </h1>
          <p className="mt-6 max-w-[32rem] text-lg leading-relaxed text-ink-muted">
            Explore what King County homes were estimated to be worth in the 2014–2015 market, read
            from each home’s own details and the homes around it.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/explore" className={buttonClasses('primary', 'lg', 'no-underline')}>
              Explore properties
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <a href="#how-it-works" className={buttonClasses('secondary', 'lg', 'no-underline')}>
              How it works
            </a>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <HistoricalLabel className="text-sm" />
            <DemoBadge className="self-start sm:self-auto" />
            <p className="text-sm text-ink-muted sm:basis-full">
              Values describe that historical market, not what homes are worth today.
              {mode === 'mock' && ' In this demo, properties and estimates are illustrative.'}
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="relative aspect-[640/520] overflow-hidden sm:max-lg:aspect-[16/11] rounded-[18px] border border-border/70 shadow-soft motion-safe:animate-[ks-reveal_700ms_cubic-bezier(0.16,1,0.3,1)]">
            <PnwLandscape />
          </div>
        </div>
      </div>
    </section>
  )
}
