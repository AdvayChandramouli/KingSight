import { formatBathrooms, formatDistance, formatSqft, formatUsd } from '@/lib/format'
import type { EdgeType, Neighbor, PropertyRecord } from '@/services/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Mar 2015" from an ISO date; null when the date is missing or malformed. */
export function saleMonthYear(iso: string | null): string | null {
  if (!iso) return null
  const [y, m] = iso.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return null
  return `${MONTHS[m - 1]} ${y}`
}

/** "Sold $612,000 · Mar 2015": the recorded historical sale, never an estimate. */
export function recordedSaleText(record: PropertyRecord): string {
  if (record.actual_price_usd == null) return 'Sale price unavailable'
  const when = saleMonthYear(record.sale_date)
  return when ? `Sold ${formatUsd(record.actual_price_usd)} · ${when}` : `Sold ${formatUsd(record.actual_price_usd)}`
}

export function zipText(record: PropertyRecord): string {
  return record.zipcode ? `ZIP ${record.zipcode}` : 'ZIP unavailable'
}

export function bedsBathsText(record: PropertyRecord): string {
  const { bedrooms, bathrooms } = record.attributes
  return `${bedrooms} bd · ${formatBathrooms(bathrooms)} ba`
}

export function markerLabel(record: PropertyRecord, { selected = false } = {}): string {
  const sale =
    record.actual_price_usd != null
      ? `recorded sale ${formatUsd(record.actual_price_usd)}`
      : 'sale price unavailable'
  return `Property ${record.id}, ${formatSqft(record.attributes.sqft_living)}, ${sale}${selected ? ', selected' : ''}`
}

export const EDGE_TYPE_LABEL: Record<EdgeType, string> = {
  geographic: 'Nearby location',
  similarity: 'Similar home features',
  combined: 'Location and home features',
}

export function neighborLabel(neighbor: Neighbor): string {
  const kind = neighbor.property.role === 'held_out_example' ? 'explorable example' : 'reference-only'
  return `Connected home ${neighbor.property.id}, ${kind}, ${formatDistance(neighbor.distance_meters)}`
}
