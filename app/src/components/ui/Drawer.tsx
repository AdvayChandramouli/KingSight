import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { useReturnFocus } from './useReturnFocus'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** `right` is a side drawer; `bottom` is a mobile sheet. */
  side?: 'right' | 'bottom'
  footer?: ReactNode
}

/**
 * Accessible drawer/sheet: focus trap, Escape to close, focus restoration to
 * the trigger (Radix Dialog semantics).
 */
export function Drawer({ open, onOpenChange, title, description, children, side = 'right', footer }: Props) {
  const returnFocus = useReturnFocus(open)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 data-[state=open]:animate-[ks-fade_180ms_ease-out]" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-lift outline-none',
            side === 'right'
              ? 'inset-y-0 right-0 w-full max-w-[34rem] data-[state=open]:animate-[ks-slide-in_220ms_var(--ease-out-expo)]'
              : 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl data-[state=open]:animate-[ks-rise_220ms_var(--ease-out-expo)]',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-ink-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sand-soft hover:text-ink"
              aria-label="Close"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">{children}</div>
          {footer && <div className="border-t border-border px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
