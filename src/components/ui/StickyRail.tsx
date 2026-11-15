import React, { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * A side column that stays in view while the page scrolls, without a scrollbar of its own.
 *
 * If the column fits on screen it sticks to the top, under the header. If it is taller than
 * the screen it scrolls with the page until its foot reaches the bottom of the screen and
 * rests there, so every part of it can be reached with the one page scrollbar.
 *
 * `from` is the width at which it starts sticking; below that it is an ordinary block.
 */
export function StickyRail({ offset = 92, from = 0, className, children }: { offset?: number; from?: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number | null>(offset)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const place = () => {
      if (window.innerWidth < from) return setTop(null)
      const gap = 16
      const tall = el.offsetHeight + offset + gap > window.innerHeight
      setTop(tall ? window.innerHeight - el.offsetHeight - gap : offset)
    }
    place()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    ro?.observe(el)
    window.addEventListener('resize', place)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [offset, from])

  return (
    <div ref={ref} className={twMerge(top !== null && 'sticky', className)} style={top !== null ? { top } : undefined}>
      {children}
    </div>
  )
}
