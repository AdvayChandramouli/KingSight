import { cn } from '@/components/ui/cn'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatUsd } from '@/lib/format'
import type { ModelFamily, ModelResult } from '@/services/types'
import { IllustrativeTag } from './IllustrativeTag'
import { modelByFamily, resultFor, usePreviewEstimate } from './usePreviewEstimate'

const COPY: Record<ModelFamily, { fallback: string; body: string }> = {
  tabular: {
    fallback: 'Property-feature model',
    body: 'Reads the home on its own terms: size, rooms, grade, condition, age, waterfront, and coordinates. It learned how those details related to recorded sale prices across the county.',
  },
  graph: {
    fallback: 'Neighborhood-graph model',
    body: 'Reads the same details, then adds the homes this one is connected to in a property graph. Those surroundings become part of the context for its estimate.',
  },
}

export function PerspectivesSection() {
  const { metadata, prediction, loading, blocked, previewId } = usePreviewEstimate()
  const tabular = modelByFamily(metadata.data, 'tabular')
  const graph = modelByFamily(metadata.data, 'graph')
  const failed = blocked || prediction.isError
  const tabularResult = resultFor(prediction.data, tabular?.id ?? null)
  const graphResult = resultFor(prediction.data, graph?.id ?? null)

  return (
    <section aria-labelledby="perspectives-title" className="border-t border-border">
      <div className="mx-auto max-w-[90rem] px-6 py-16 sm:px-8 lg:px-12 lg:py-24">
        <h2 id="perspectives-title" className="max-w-[16ch] text-[2rem] font-medium tracking-tight text-ink sm:text-4xl">
          Two perspectives on value
        </h2>
        <p className="mt-5 max-w-[36rem] text-ink-muted">
          KingSight asks two different models the same question: what was this home likely worth in the 2014–2015
          market?
        </p>

        <div className="mt-10 grid border-y border-border md:grid-cols-2">
          <Perspective
            family="tabular"
            label={tabular?.perspective_label}
            result={tabularResult}
            loading={loading}
            failed={failed}
            previewId={previewId}
            className="md:border-r md:border-border"
          />
          <Perspective
            family="graph"
            label={graph?.perspective_label}
            result={graphResult}
            loading={loading}
            failed={failed}
            previewId={previewId}
            detail={metadata.data?.graph.available ? `Connections: ${metadata.data.graph.rule_label}` : undefined}
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-12">
          <p className="max-w-[44rem] text-lg leading-relaxed text-ink">
            The two estimates can differ, and neither is the right answer by default. Comparing them shows how each
            model reads the same home. <Difference tabular={tabularResult} graph={graphResult} />
          </p>
          <IllustrativeTag realLabel={`Property ${previewId ?? 'example'}`} className="self-start justify-self-start" />
        </div>
      </div>
    </section>
  )
}

type PerspectiveProps = {
  family: ModelFamily
  label: string | undefined
  result: ModelResult | undefined
  loading: boolean
  failed: boolean
  detail?: string
  className?: string
  previewId: string | null
}

function Perspective({ family, label, result, loading, failed, detail, className, previewId }: PerspectiveProps) {
  const graph = family === 'graph'
  const ok = result?.status === 'success' && result.predicted_price_usd != null

  return (
    <div className={cn('flex flex-col py-8 md:px-8 md:first:pl-0', className)}>
      <h3 className={cn('inline-flex items-center gap-2.5 text-2xl font-medium', graph ? 'text-clay-ink' : 'text-deep-blue')}>
        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', graph ? 'bg-clay' : 'bg-deep-blue')} />
        {label ?? COPY[family].fallback}
      </h3>
      <p className="mt-3 max-w-[32rem] text-ink-muted">{COPY[family].body}</p>
      {detail && <p className="mt-3 text-sm font-medium text-clay-ink">{detail}</p>}

      <div className="mt-auto pt-8">
        <div className="border-t border-border pt-5">
          <p className="text-[0.8125rem] text-ink-muted">Property {previewId ?? '…'}</p>
          {failed ? (
            <p className="mt-1 text-sm text-ink-muted">Example estimate unavailable right now.</p>
          ) : loading || !result ? (
            <Skeleton className="mt-2 h-8 w-36" />
          ) : ok ? (
            <p className={cn('mt-1 text-[1.875rem] leading-tight font-medium tabular', graph ? 'text-clay-ink' : 'text-deep-blue')}>
              {formatUsd(result.predicted_price_usd)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">
              {result.message ?? 'This model did not return an estimate for this example.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Difference({ tabular, graph }: { tabular: ModelResult | undefined; graph: ModelResult | undefined }) {
  const a = tabular?.status === 'success' ? tabular.predicted_price_usd : null
  const b = graph?.status === 'success' ? graph.predicted_price_usd : null
  if (a == null || b == null) return null
  const diff = Math.round(b - a)
  if (diff === 0) return <span className="text-ink-muted">For this example, the two estimates match.</span>
  return (
    <span className="text-ink-muted">
      For this example, the neighborhood-graph estimate is{' '}
      <span className="font-medium text-ink tabular">{formatUsd(Math.abs(diff))}</span> {diff > 0 ? 'higher' : 'lower'}.
    </span>
  )
}
