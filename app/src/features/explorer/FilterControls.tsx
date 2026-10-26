import { Search, X } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/components/ui/cn'
import type { WaterfrontFilter } from './explorerState'
import type { FilterDraftApi } from './useFilterDraft'

const inputClass =
  'block w-full min-h-11 rounded-md border border-control/70 bg-surface px-3 text-[0.95rem] text-ink placeholder:text-ink-muted/80 transition-colors duration-150 hover:border-control focus-visible:border-evergreen focus-visible:outline-2 focus-visible:outline-offset-0 aria-invalid:border-danger'

export function SearchField({ api }: { api: FilterDraftApi }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
        Search property ID or ZIP
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          id={id}
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. KC-1042 or 98103"
          value={api.draft.q}
          onChange={(e) => api.setQ(e.target.value)}
          className={cn(inputClass, 'pr-11 pl-9 [&::-webkit-search-cancel-button]:hidden')}
        />
        {api.draft.q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => api.setQ('')}
            className="absolute top-1/2 right-0.5 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-sand-soft hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function SqftInput({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error: string | null
  placeholder: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-[0.8125rem] text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={50}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(inputClass, 'tabular')}
      />
      {error && (
        <p id={errorId} className="mt-1 text-[0.8125rem] leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** Living-area range, waterfront, and Clear filters. */
export function FilterFields({ api, showClear = true }: { api: FilterDraftApi; showClear?: boolean }) {
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-[0.8125rem] font-medium text-ink">Living area (sq ft)</legend>
        <div className="flex gap-2.5">
          <SqftInput label="Min sq ft" placeholder="Any" value={api.draft.minSqft} onChange={api.setMinSqft} error={api.minError} />
          <SqftInput label="Max sq ft" placeholder="Any" value={api.draft.maxSqft} onChange={api.setMaxSqft} error={api.maxError} />
        </div>
      </fieldset>
      <div>
        <p aria-hidden className="mb-1.5 text-[0.8125rem] font-medium text-ink">
          Waterfront
        </p>
        <SegmentedControl<WaterfrontFilter>
          label="Waterfront"
          className="flex w-full"
          value={api.draft.waterfront}
          onChange={api.setWaterfront}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
      </div>
      {showClear && <ClearFiltersButton api={api} />}
    </div>
  )
}

export function ClearFiltersButton({ api, className }: { api: FilterDraftApi; className?: string }) {
  const d = api.draft
  const dirty = Boolean(d.q || d.minSqft || d.maxSqft || d.waterfront !== 'any')
  return (
    <Button variant="ghost" size="sm" className={cn('min-h-11 px-3', className)} onClick={api.clear} disabled={!dirty}>
      Clear filters
    </Button>
  )
}
