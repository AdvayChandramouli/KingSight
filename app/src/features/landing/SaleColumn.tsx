import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { HistoricalLabel, ModelTag } from '@/components/brand'
import { Notice } from '@/components/ui/Notice'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatSaleDate, formatUsd } from '@/lib/format'
import { describeError } from '@/services/client'
import { useDataMode } from '@/services/context'
import type { Neighbor } from '@/services/types'
import { IllustrativeTag } from './IllustrativeTag'
import { modelByFamily, resultFor, usePreviewEstimate } from './usePreviewEstimate'

const inkButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-ink px-5 text-base font-medium text-canvas no-underline transition-colors duration-150 ease-out-expo hover:bg-fir'
const lineButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-ink/15 bg-canvas px-5 text-base font-medium text-ink no-underline transition-colors duration-150 ease-out-expo hover:bg-basswood'
const sceneButton =
  'inline-flex min-h-11 items-center justify-center rounded-sm border border-ink/15 bg-canvas px-3.5 text-sm font-medium text-ink transition-colors duration-150 ease-out-expo hover:bg-basswood aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-canvas'

type Props = {
  scene: boolean
  showConnections: boolean
  showPhoto: boolean
  onToggleConnections: () => void
  onTogglePhoto: () => void
  neighbors: Neighbor[]
}

export function SaleColumn({
  scene,
  showConnections,
  showPhoto,
  onToggleConnections,
  onTogglePhoto,
  neighbors,
}: Props) {
  const mode = useDataMode()
  const { metadata, property, prediction, loading, blocked, previewId, previewHref } = usePreviewEstimate()
  const home = property.data
  const tabular = modelByFamily(metadata.data, 'tabular')
  const model = tabular ?? metadata.data?.models.find((item) => item.id === metadata.data?.primary_model_id)
  const result = resultFor(prediction.data, model?.id ?? null)

  return (
    <div className="flex flex-col justify-center bg-canvas px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <p className="text-[0.8125rem] font-medium text-ink">King County · May 2014–May 2015</p>
      <h1
        id="hero-title"
        className="mt-8 max-w-[11em] text-[2.6rem] leading-[1.02] font-medium tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.25rem]"
      >
        Two readings of one sale.
      </h1>
      <div className="mt-6 flex flex-col items-start gap-2">
        <HistoricalLabel />
        <IllustrativeTag realLabel="Example property" mockLabel="Illustrative preview · demo data" />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        {blocked ? (
          <Notice tone="neutral" title="Preview unavailable">
            This example couldn’t be loaded right now. You can still browse every example in the explorer.
          </Notice>
        ) : (
          <SaleFacts
            previewId={previewId}
            previewHref={previewHref}
            zip={home?.zipcode ?? null}
            saleDate={home?.sale_date ?? null}
            salePrice={home?.actual_price_usd ?? null}
            waiting={!home}
          />
        )}

        {!blocked && (
          <div className="mt-6 border-t border-border pt-5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-ink">Estimated historical value</p>
              {model && <ModelTag model={model} />}
            </div>
            <EstimateBody
              loading={loading}
              error={prediction.isError ? prediction.error : null}
              onRetry={() => void prediction.refetch()}
              valuationYear={home?.valuation_year ?? null}
              price={result?.status === 'success' ? result.predicted_price_usd : null}
              message={result?.status === 'success' ? null : (result?.message ?? null)}
              settled={result != null}
            />
          </div>
        )}
      </div>

      <p className="mt-6 max-w-[38rem] text-base leading-relaxed text-ink">
        The graph reading also uses homes connected to this one.
      </p>
      {neighbors.length > 0 && (
        <ul aria-label="Connected homes" className="mt-3 max-w-[38rem] space-y-1 text-sm text-ink">
          {neighbors.map((neighbor) => (
            <li key={neighbor.property.id}>
              <span className="font-mono">{neighbor.property.id}</span>
              <span className="text-ink-muted">
                {' '}
                · {neighbor.property.zipcode ? `ZIP ${neighbor.property.zipcode}` : 'ZIP unavailable'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 max-w-[38rem] text-sm leading-relaxed text-ink-muted">
        Values describe that historical market, not what homes are worth today.
        {mode === 'mock' && ' In this demo, properties and estimates are illustrative.'}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link to="/explore" className={inkButton}>
          Explore properties
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <a href="#how-it-works" className={lineButton}>
          How it works
        </a>
      </div>

      {scene && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={sceneButton} aria-pressed={showConnections} aria-controls="landing-stage" onClick={onToggleConnections}>
            Show connections
          </button>
          <button type="button" className={sceneButton} aria-pressed={showPhoto} aria-controls="landing-stage" onClick={onTogglePhoto}>
            {showPhoto ? 'See the model' : 'See the photograph'}
          </button>
        </div>
      )}
    </div>
  )
}

function SaleFacts({
  previewId,
  previewHref,
  zip,
  saleDate,
  salePrice,
  waiting,
}: {
  previewId: string | null
  previewHref: string
  zip: string | null
  saleDate: string | null
  salePrice: number | null
  waiting: boolean
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-2xl font-medium tracking-tight text-ink">
          Property {previewId ? <span className="font-mono">{previewId}</span> : <Skeleton className="inline-block h-6 w-28 align-middle" />}
        </h2>
        {zip ? (
          <p className="text-sm text-ink-muted">ZIP {zip}</p>
        ) : waiting ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <p className="text-sm text-ink-muted">ZIP unavailable</p>
        )}
      </div>
      {previewId && (
        <Link to={previewHref} className="mt-2 inline-flex text-sm font-medium text-ink underline underline-offset-4">
          Open this property
        </Link>
      )}
      <dl className="mt-5">
        <dt className="text-[0.8125rem] text-ink-muted">Recorded sale</dt>
        {waiting ? (
          <dd className="mt-1">
            <Skeleton className="h-7 w-36" />
          </dd>
        ) : salePrice != null ? (
          <dd className="mt-1">
            <p className="text-xl font-medium text-ink tabular">{formatUsd(salePrice)}</p>
            <p className="text-sm text-ink-muted">
              {formatSaleDate(saleDate)}. A historical sale record, not an estimate.
            </p>
          </dd>
        ) : (
          <dd className="mt-1 text-sm text-ink-muted">No recorded sale price is available for this example.</dd>
        )}
      </dl>
    </div>
  )
}

function EstimateBody({
  loading,
  error,
  onRetry,
  valuationYear,
  price,
  message,
  settled,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  valuationYear: number | null
  price: number | null
  message: string | null
  settled: boolean
}) {
  if (error) {
    const described = describeError(error)
    return (
      <Notice tone="neutral" title="Estimate unavailable" onRetry={described.retryable ? onRetry : undefined} className="mt-3">
        The preview estimate couldn’t be loaded. You can request one from the explorer.
      </Notice>
    )
  }
  if (loading || !settled) {
    return (
      <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading estimate">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>
    )
  }
  if (price == null) {
    return <p className="mt-3 text-sm text-ink-muted">{message ?? 'The property-feature model did not return an estimate for this example.'}</p>
  }
  return (
    <>
      <p className="mt-2 text-[2.5rem] leading-none font-medium tracking-[-0.02em] text-deep-blue tabular">{formatUsd(price)}</p>
      {valuationYear != null && <p className="mt-2 text-sm text-ink-muted">Valued in the {valuationYear} market.</p>}
    </>
  )
}
