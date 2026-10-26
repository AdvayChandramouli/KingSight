const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return usd.format(value)
}

/** Compact currency, e.g. $1.24M or $648K, for tight spaces. */
export function formatUsdCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`
  return `${sign}$${Math.round(abs)}`
}

/** Signed currency with an explicit + or − (true minus sign). */
export function formatSignedUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = Math.round(value)
  if (rounded === 0) return '$0'
  return `${rounded > 0 ? '+' : '−'}${usd.format(Math.abs(rounded))}`
}

/** Signed log-price contribution; never formatted as dollars. */
export function formatSignedLog(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const fixed = Math.abs(value).toFixed(3)
  if (Number(fixed) === 0) return '0.000'
  return `${value > 0 ? '+' : '−'}${fixed}`
}

export function formatSqft(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${integer.format(value)} sq ft`
}

export function formatInteger(value: number): string {
  return integer.format(value)
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return 'Distance unknown'
  const miles = meters / 1609.344
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`
}

export function formatSaleDate(iso: string | null): string {
  if (!iso) return 'Sale date unavailable'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatBathrooms(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '')
}

export function formatCoordinate(value: number): string {
  return value.toFixed(5)
}
