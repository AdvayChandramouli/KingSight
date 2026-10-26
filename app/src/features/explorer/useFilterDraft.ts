import { useEffect, useState } from 'react'
import { EMPTY_FILTERS, useExplorer, type Filters, type WaterfrontFilter } from './explorerState'

export const FILTER_DEBOUNCE_MS = 250

export type FilterDraft = {
  q: string
  minSqft: string
  maxSqft: string
  waterfront: WaterfrontFilter
}

type ParsedNumber = { ok: true; value: number | null } | { ok: false }

function parseSqft(raw: string): ParsedNumber {
  const text = raw.trim()
  if (!text) return { ok: true, value: null }
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return { ok: false }
  return { ok: true, value }
}

function toDraft(filters: Filters): FilterDraft {
  return {
    q: filters.q,
    minSqft: filters.minSqft == null ? '' : String(filters.minSqft),
    maxSqft: filters.maxSqft == null ? '' : String(filters.maxSqft),
    waterfront: filters.waterfront,
  }
}

/** Filters the draft would commit; invalid number fields keep their last committed value. */
function resolve(draft: FilterDraft, current: Filters): Filters {
  const min = parseSqft(draft.minSqft)
  const max = parseSqft(draft.maxSqft)
  return {
    q: draft.q,
    minSqft: min.ok ? min.value : current.minSqft,
    maxSqft: max.ok ? max.value : current.maxSqft,
    waterfront: draft.waterfront,
  }
}

function sameFilters(a: Filters, b: Filters): boolean {
  return a.q === b.q && a.minSqft === b.minSqft && a.maxSqft === b.maxSqft && a.waterfront === b.waterfront
}

/**
 * Local input state for the filter controls. Text and number edits commit to the
 * shared explorer filters after a short debounce; waterfront commits at once.
 */
export function useFilterDraft() {
  const { filters, setFilters, clearFilters } = useExplorer()
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(filters))
  const [seenFilters, setSeenFilters] = useState(filters)

  // Filters changed elsewhere (e.g. cleared from another control): adopt them.
  if (seenFilters !== filters) {
    setSeenFilters(filters)
    if (!sameFilters(resolve(draft, filters), filters)) setDraft(toDraft(filters))
  }

  useEffect(() => {
    const next = resolve(draft, filters)
    if (sameFilters(next, filters)) return
    const timer = window.setTimeout(() => setFilters(next), FILTER_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [draft, filters, setFilters])

  const min = parseSqft(draft.minSqft)
  const max = parseSqft(draft.maxSqft)
  const minError = min.ok ? null : 'Enter a positive number of square feet.'
  const maxError = max.ok
    ? min.ok && min.value != null && max.value != null && min.value > max.value
      ? 'Maximum is smaller than the minimum.'
      : null
    : 'Enter a positive number of square feet.'

  return {
    draft,
    minError,
    maxError,
    setQ: (q: string) => setDraft((d) => ({ ...d, q })),
    setMinSqft: (minSqft: string) => setDraft((d) => ({ ...d, minSqft })),
    setMaxSqft: (maxSqft: string) => setDraft((d) => ({ ...d, maxSqft })),
    setWaterfront: (waterfront: WaterfrontFilter) => {
      const nextDraft = { ...draft, waterfront }
      setDraft(nextDraft)
      setFilters(resolve(nextDraft, filters))
    },
    clear: () => {
      setDraft(toDraft(EMPTY_FILTERS))
      clearFilters()
    },
  }
}

export type FilterDraftApi = ReturnType<typeof useFilterDraft>
