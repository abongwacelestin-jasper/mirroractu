import React, { useEffect, useRef, useState } from 'react'

type Parsed = { prefix: string; number: number; decimals: number; grouped: boolean; suffix: string }

const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i

/**
 * Finds the number inside a figure such as "52%", "$129m+", "1,800" or "+1.75°C".
 * Returns null for text that should not be animated: no number, a date ("1 Jan"),
 * a range, or a time ("1h 25m").
 */
function parse(value: number | string): Parsed | null {
  if (typeof value === 'number') return { prefix: '', number: value, decimals: Number.isInteger(value) ? 0 : 1, grouped: false, suffix: '' }
  const m = value.match(/^([^\d]*)(\d[\d,]*)(\.\d+)?(.*)$/s)
  if (!m) return null
  const [, prefix, whole, fraction = '', suffix] = m
  if (/\d/.test(suffix) || MONTH.test(suffix)) return null
  return { prefix, number: parseFloat(whole.replace(/,/g, '') + fraction), decimals: fraction ? fraction.length - 1 : 0, grouped: whole.includes(','), suffix }
}

const format = (p: Parsed, n: number) =>
  p.prefix + n.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals, useGrouping: p.grouped }) + p.suffix

/**
 * A figure that counts up from zero the first time it scrolls into view. Give it a number or
 * the figure as written ("52%", "$4,074"): the surrounding symbols stay put while the number
 * runs. Text with no number in it, dates and times are shown as they are.
 *
 * Readers who ask for reduced motion, and screen readers, get the final figure straight away.
 */
export function CountUp({ value, duration = 1100, className }: { value: number | string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const parsed = parse(value)
  const final = parsed ? format(parsed, parsed.number) : String(value)
  const [shown, setShown] = useState(final)

  useEffect(() => {
    const el = ref.current
    if (!parsed || !el || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(final)
      return
    }
    setShown(format(parsed, 0))
    let frame = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setShown(t < 1 ? format(parsed, parsed.number * eased) : final)
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [final, duration])

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }} translate="no" aria-label={final}>
      <span aria-hidden="true">{shown}</span>
    </span>
  )
}
