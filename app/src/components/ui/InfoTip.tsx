import { CircleHelp } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type Props = { label: string; children: ReactNode }

/**
 * Plain-language help that works without hover: a button toggles a small
 * popover. Escape or an outside click closes it.
 */
export function InfoTip({ label, children }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-m-2 inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:text-evergreen"
      >
        <CircleHelp aria-hidden className="size-4" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute top-full left-1/2 z-30 mt-1 w-64 -translate-x-1/2 rounded-md border border-border bg-surface p-3 text-left text-sm leading-snug font-normal text-ink shadow-lift animate-[ks-reveal_150ms_ease-out]"
        >
          {children}
        </span>
      )}
    </span>
  )
}
