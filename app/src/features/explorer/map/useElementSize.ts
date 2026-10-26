import { useEffect, useState, type RefObject } from 'react'

export type Size = { width: number; height: number }

/** Tracks an element's content size; reports 0×0 while it is display:none. */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = (width: number, height: number) =>
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    const rect = el.getBoundingClientRect()
    update(Math.round(rect.width), Math.round(rect.height))
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) update(Math.round(box.width), Math.round(box.height))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}
