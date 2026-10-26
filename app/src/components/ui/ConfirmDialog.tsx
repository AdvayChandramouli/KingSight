import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { useReturnFocus } from './useReturnFocus'

type Props = {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Keep editing', onConfirm, onCancel }: Props) {
  const returnFocus = useReturnFocus(open)
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-6 shadow-lift outline-none">
          <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-[0.95rem] text-ink-muted">{children}</div>
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
