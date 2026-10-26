import { useLayoutEffect, useRef } from 'react'

/**
 * Radix only restores focus to a `Dialog.Trigger`; our dialogs are often
 * opened by plain buttons, so remember whatever had focus when opening.
 */
export function useReturnFocus(open: boolean) {
  const previous = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open) previous.current = document.activeElement as HTMLElement | null
  }, [open])
  return (event: Event) => {
    const el = previous.current
    if (el && el.isConnected && el !== document.body) {
      event.preventDefault()
      el.focus()
    }
  }
}
