import { X } from 'lucide-react'
import { useId } from 'react'
import { InfoTip } from '@/components/ui/InfoTip'
import { fieldLabel, formatFeatureValue } from '@/features/prediction/modelDisplay'
import { formatCoordinate, formatSaleDate, formatUsd } from '@/lib/format'
import type { AttributeKey, Metadata, PropertyAttributes, PropertyDetail } from '@/services/types'
import { ATTRIBUTE_ORDER } from './attributeSchema'

export function PropertyHeader({ property, onClose }: { property: PropertyDetail; onClose: () => void }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h2 className="font-display text-[2rem] leading-tight font-semibold text-ink sm:text-[2.25rem]">
          Property {property.id}
        </h2>
        <p className="text-[0.95rem] text-ink-muted">
          {property.zipcode ? `ZIP ${property.zipcode}` : 'ZIP unavailable'}
          {property.neighborhood_label && <> · {property.neighborhood_label}</>}
        </p>
      </div>
      <button
        type="button"
        aria-label="Close property details"
        onClick={onClose}
        className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sand-soft hover:text-ink"
      >
        <X aria-hidden className="size-5" />
      </button>
    </header>
  )
}

/** The recorded historical sale, kept visually apart from model estimates. */
export function RecordedSale({ property, asOriginal }: { property: PropertyDetail; asOriginal: boolean }) {
  const headingId = useId()
  const price = property.actual_price_usd
  const sqft = property.attributes.sqft_living
  const perSqft = price != null && Number.isFinite(sqft) && sqft > 0 ? price / sqft : null

  return (
    <section aria-labelledby={headingId} className="rounded-lg bg-sand-soft px-5 py-4">
      <h3 id={headingId} className="font-sans text-sm font-semibold tracking-normal text-ink">
        {asOriginal ? 'Original property · recorded historical sale' : 'Recorded historical sale'}
      </h3>
      {price != null ? (
        <dl className="tabular mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <dt className="text-[0.8125rem] text-ink-muted">Recorded sale price</dt>
            <dd className="text-xl font-semibold text-ink">{formatUsd(price)}</dd>
          </div>
          <div>
            <dt className="text-[0.8125rem] text-ink-muted">Sale date</dt>
            <dd className="text-ink">{formatSaleDate(property.sale_date)}</dd>
          </div>
          {perSqft != null && (
            <div>
              <dt className="text-[0.8125rem] text-ink-muted">Price per sq ft</dt>
              <dd className="text-ink">{formatUsd(perSqft)}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-1.5 text-sm text-ink-muted">
          Recorded sale price unavailable{property.sale_date ? ` · ${formatSaleDate(property.sale_date)}` : ''}.
        </p>
      )}
      <p className="mt-2 text-[0.8125rem] text-ink-muted">
        {asOriginal
          ? 'This is the unchanged record. Your edits are hypothetical, so this price is not a benchmark for them.'
          : 'What the home actually sold for — an observation, separate from any model estimate.'}
      </p>
    </section>
  )
}

/** Read-only attribute summary with plain-language help for grade and condition. */
export function AttributeSummary({ values, metadata }: { values: PropertyAttributes; metadata: Metadata }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 min-[480px]:grid-cols-3">
      {ATTRIBUTE_ORDER.map((key) => (
        <SummaryItem key={key} attrKey={key} values={values} metadata={metadata} />
      ))}
    </dl>
  )
}

function SummaryItem({ attrKey, values, metadata }: { attrKey: AttributeKey; values: PropertyAttributes; metadata: Metadata }) {
  const field = metadata.fields.find((f) => f.key === attrKey)
  const label = fieldLabel(metadata, attrKey)
  const showHelp = (attrKey === 'grade' || attrKey === 'condition') && field?.help
  const value = values[attrKey]
  const scale = (attrKey === 'grade' || attrKey === 'condition') && field?.max != null ? ` of ${field.max}` : ''
  return (
    <div className="min-w-0">
      <dt className="flex min-h-6 items-center gap-1 text-[0.8125rem] text-ink-muted">
        {label}
        {showHelp && <InfoTip label={label}>{field.help}</InfoTip>}
      </dt>
      <dd className="tabular font-medium text-ink">
        {formatFeatureValue(attrKey, value)}
        {scale && <span className="font-normal text-ink-muted">{scale}</span>}
      </dd>
    </div>
  )
}

export function LockedLocation({ property }: { property: PropertyDetail }) {
  return (
    <div className="rounded-lg bg-sand-soft px-4 py-3 text-sm">
      <p className="font-medium text-ink">Location</p>
      <p className="tabular text-ink">
        {formatCoordinate(property.latitude)}, {formatCoordinate(property.longitude)}
      </p>
      <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Location is fixed for existing properties.</p>
    </div>
  )
}
