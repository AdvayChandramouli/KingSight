import { formatInteger } from '@/lib/format'
import type { DiscoveryResults } from './useDiscoveryResults'

function plural(n: number) {
  return `${formatInteger(n)} ${n === 1 ? 'property' : 'properties'}`
}

export function countText(results: Pick<DiscoveryResults, 'total' | 'overallTotal' | 'filtered' | 'items' | 'hasNextPage'>): string {
  const { total, overallTotal, filtered, items, hasNextPage } = results
  if (total == null) return `${formatInteger(items.length)}${hasNextPage ? '+' : ''} ${items.length === 1 && !hasNextPage ? 'property' : 'properties'}`
  if (filtered && overallTotal != null) return `${formatInteger(total)} of ${plural(overallTotal)}`
  return plural(total)
}
