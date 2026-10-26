import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { HISTORICAL_LABEL } from '@/components/brand'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { useDataMode } from '@/services/context'
import { useMetadata } from '@/services/queries'
import { ShorelineArt } from './art/ShorelineArt'

const DATASET_URL = 'https://www.kaggle.com/datasets/harlfoxem/housesalesprediction'

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="relative isolate overflow-hidden rounded-[18px] bg-evergreen px-6 pt-14 pb-40 text-white shadow-lift sm:px-12 sm:pt-16 sm:pb-44 lg:px-16 lg:pt-20 lg:pb-52">
        <div className="absolute inset-x-0 bottom-0 -z-10 h-36 sm:h-44 lg:h-52">
          <ShorelineArt tone="dark" />
        </div>
        <h2 id="cta-title" className="max-w-[18ch] text-[2.125rem] font-medium tracking-[-0.025em] sm:text-[3rem]">
          Find the context behind the estimate
        </h2>
        <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-white/85">
          Choose a home on the map, ask both models for an estimate, and see which details and
          neighbors shaped each one.
        </p>
        <Link
          to="/explore"
          className={buttonClasses(
            'secondary',
            'lg',
            'mt-9 border-transparent text-evergreen no-underline hover:border-transparent hover:bg-sand-soft focus-visible:outline-white',
          )}
        >
          Explore properties
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  )
}

export function SiteFooter() {
  const mode = useDataMode()
  const { data: metadata } = useMetadata()
  const sourceUrl = metadata?.dataset.source_url ?? DATASET_URL
  const sourceLabel = metadata?.dataset.source_label ?? 'House Sales in King County, USA (Kaggle)'

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[90rem] gap-8 px-5 py-10 text-sm text-ink-muted sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:px-12">
        <div>
          <p className="font-display text-lg font-semibold text-ink">KingSight</p>
          <p className="mt-1">Property value, in context.</p>
        </div>
        <div className="space-y-2">
          <p>
            Data:{' '}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-ink underline hover:text-evergreen"
            >
              {sourceLabel}
              <ArrowUpRight aria-hidden className="size-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            . Sales recorded May 2014–May 2015.
          </p>
          <p>
            {HISTORICAL_LABEL}.{' '}
            {mode === 'mock' &&
              'This is a demo: properties, estimates, and explanations shown here are illustrative, not model results.'}
          </p>
          <p>Estimates are not professional appraisals.</p>
        </div>
      </div>
    </footer>
  )
}
