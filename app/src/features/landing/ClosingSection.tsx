import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { HISTORICAL_LABEL } from '@/components/brand'
import { useDataMode } from '@/services/context'
import { useMetadata } from '@/services/queries'
import { fabricPhotograph } from '@/features/landing/media/ledger'
import { PhotoCaption } from './PhotoCaption'

const DATASET_URL = 'https://www.kaggle.com/datasets/harlfoxem/housesalesprediction'

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="border-t border-border">
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(22rem,36rem)]">
        <figure className="bg-fir">
          <img
            src={fabricPhotograph.src}
            alt={fabricPhotograph.alt}
            loading="lazy"
            decoding="async"
            className="ks-plate aspect-[16/10] h-full w-full object-cover lg:aspect-auto lg:min-h-[32rem]"
          />
          <figcaption>
            <PhotoCaption photo={fabricPhotograph} />
          </figcaption>
        </figure>
        <div className="flex flex-col justify-center bg-canvas px-6 py-14 sm:px-10 lg:px-12">
          <h2 id="cta-title" className="max-w-[16ch] text-[2.125rem] font-medium tracking-[-0.03em] text-ink sm:text-5xl">
            Find the context behind the estimate
          </h2>
          <p className="mt-5 max-w-[32rem] text-lg leading-relaxed text-ink-muted">
            Choose a home on the map, ask both models for an estimate, and see which details and neighbors shaped each
            one.
          </p>
          <Link
            to="/explore"
            className="mt-8 inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-sm bg-ink px-5 text-base font-medium text-canvas no-underline transition-colors duration-150 ease-out-expo hover:bg-fir"
          >
            Explore properties
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
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
          <p className="text-lg font-semibold text-ink">KingSight</p>
          <p className="mt-1">Property value, in context.</p>
        </div>
        <div className="space-y-2">
          <p>
            Data:{' '}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-ink underline"
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
