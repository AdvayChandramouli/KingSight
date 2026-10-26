import { BarChart3, CircleAlert, History, Network, Rows3, type LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Notice } from '@/components/ui/Notice'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDataMode } from '@/services/context'
import { useMetadata } from '@/services/queries'
import type { Metadata, VerifiedMetric } from '@/services/types'

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

export function HowItWorksDrawer({ open, onOpenChange }: Props) {
  const mode = useDataMode()
  const metadata = useMetadata()
  useRestoreFocus(open)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title="How KingSight works"
      description="What an estimate means, where it comes from, and how to read it."
    >
      <div className="space-y-9 text-[0.95rem] leading-relaxed text-ink-muted">
        {mode === 'mock' && (
          <Notice tone="neutral" title="You’re viewing demo data">
            Every property, estimate, and explanation in this demo is illustrative. None of it is a
            result from a trained model.
          </Notice>
        )}

        <Section icon={History} title="A historical market">
          <p>
            KingSight uses records of King County home sales from{' '}
            <strong className="font-medium text-ink">May 2014 to May 2015</strong>. Every estimate
            describes that market, in that period. It is not what a home is worth today.
          </p>
        </Section>

        <Section icon={Rows3} title="Estimating from property features" iconClass="text-deep-blue">
          <p>
            The property-feature model reads each home on its own: living area, bedrooms, bathrooms,
            construction grade, condition, year built, waterfront, and location. It learned how those
            details related to recorded sale prices, then applies that to the home you choose.
          </p>
        </Section>

        <Section icon={Network} title="Neighborhood context" iconClass="text-clay-ink">
          <p>
            The neighborhood-graph model also looks at properties connected to the home in a graph.
            Those connections give it context about the surroundings.
          </p>
          <GraphRule metadata={metadata.data} loading={metadata.isPending} />
          <p>
            A connection is model context. It doesn’t prove that one home influences another’s price,
            and the connected homes aren’t a ranked list of comparable sales.
          </p>
        </Section>

        <Section icon={BarChart3} title="Reading an explanation">
          <ul className="list-disc space-y-2 pl-5 marker:text-control">
            <li>
              Each bar is a signed contribution: how much one attribute pushed this model’s estimate
              higher (+) or lower (−) relative to its reference prediction, for this home only.
            </li>
            <li>
              Contributions are shown in the model’s own units. Some models explain in dollars; others
              in log-price, which is not a dollar amount. The units are always labeled.
            </li>
            <li>
              Attributes that move together, such as living area and bathrooms, can share importance,
              so one may look small because another carries the same signal.
            </li>
            <li>
              A ranking of what matters across many homes is a different thing from the contributions
              for one home. KingSight labels any such ranking “Across evaluated homes”.
            </li>
            <li>
              A large contribution from latitude means location mattered for this estimate. It doesn’t
              mean homes further north always cost more.
            </li>
            <li>Contributions describe model behavior. They are not causes of a price.</li>
          </ul>
        </Section>

        <Section icon={CircleAlert} title="What an estimate is not">
          <ul className="list-disc space-y-2 pl-5 marker:text-control">
            <li>A model estimate is not a professional appraisal.</li>
            <li>
              Changing a home’s details shows how sensitive the model is to them. It doesn’t predict
              what a renovation would return.
            </li>
            <li>Connected properties are not comparable sales.</li>
            <li>When the two models disagree, neither is automatically the right one.</li>
            <li>
              Estimates are single values. A range appears only when the service supplies one with a
              documented meaning; the gap between the two models is not a confidence band.
            </li>
          </ul>
        </Section>

        {metadata.data?.metrics && metadata.data.metrics.length > 0 && (
          <Metrics metrics={metadata.data.metrics} metadata={metadata.data} />
        )}
      </div>
    </Drawer>
  )
}

/**
 * Radix only restores focus to a `Dialog.Trigger`; this drawer is opened from
 * plain buttons, so return focus to whatever was focused when it opened.
 */
function useRestoreFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null)
  // Layout effect: must read the opener before the dialog's own focus effect moves focus.
  useLayoutEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      return
    }
    const el = opener.current
    if (!el) return
    opener.current = null
    const id = window.setTimeout(() => {
      if (el.isConnected) el.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])
}

function Section({
  icon: Icon,
  title,
  iconClass = 'text-evergreen',
  children,
}: {
  icon: LucideIcon
  title: string
  iconClass?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2.5 font-display text-xl font-medium text-ink">
        <Icon aria-hidden className={`size-5 shrink-0 ${iconClass}`} />
        {title}
      </h3>
      {children}
    </section>
  )
}

function GraphRule({ metadata, loading }: { metadata: Metadata | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading graph details" className="space-y-2 rounded-md bg-sand-soft p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }
  if (!metadata) {
    return <p>Details about how homes are connected aren’t available right now.</p>
  }
  if (!metadata.graph.available) {
    return <p>Graph context isn’t available in this version.</p>
  }
  return (
    <div className="rounded-md bg-clay-soft/70 p-4">
      <p className="font-medium text-ink">{metadata.graph.rule_label}</p>
      {metadata.graph.description && <p className="mt-1">{metadata.graph.description}</p>}
    </div>
  )
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

function Metrics({ metrics, metadata }: { metrics: VerifiedMetric[]; metadata: Metadata }) {
  const nameOf = (id: string) => metadata.models.find((m) => m.id === id)?.perspective_label ?? id
  return (
    <Section icon={BarChart3} title="How the models were evaluated">
      <p>
        These figures were supplied with the models. Each one names the homes it was measured on, the
        price scale used, and where it comes from.
      </p>
      <dl className="divide-y divide-border rounded-md border border-border bg-surface">
        {metrics.map((m) => (
          <div key={`${m.model_id}-${m.name}`} className="px-4 py-3">
            <dt className="text-sm text-ink-muted">
              {nameOf(m.model_id)} · {m.name}
            </dt>
            <dd className="mt-0.5">
              <span className="font-semibold text-ink tabular">
                {number.format(m.value)} {m.unit}
              </span>
              <span className="mt-1 block text-[0.8125rem]">
                Evaluated on {m.split} · target scale: {m.target_scale} · source: {m.provenance}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
