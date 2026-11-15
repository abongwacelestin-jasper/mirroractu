import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

/** Building blocks for the dashboard, in the same visual language as the public site. */

export const inputClass =
  'block w-full rounded-none border border-ink/25 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition-shadow duration-150 placeholder:text-faint focus:border-ink focus:shadow-[0_0_0_3px_rgba(255,90,54,.25)]'

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={twMerge('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-[12.5px] font-semibold text-[#b3261e]">{error}</span>}
    </label>
  )
}

export function Btn({ tone = 'solid', size = 'md', className, ...rest }: { tone?: 'solid' | 'signal' | 'line' | 'ghost' | 'danger'; size?: 'sm' | 'md' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={twMerge(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'px-3.5 py-1.5 text-[13px]' : 'px-[18px] py-2.5 text-[14.5px]',
        tone === 'solid' && 'border-ink bg-ink text-white hover:bg-ink-2',
        tone === 'signal' && 'border-signal bg-signal text-ink hover:bg-signal-hover',
        tone === 'line' && 'border-ink/30 bg-white text-ink hover:border-ink',
        tone === 'ghost' && 'border-transparent text-muted hover:bg-ink/5 hover:text-ink',
        tone === 'danger' && 'border-[#b3261e]/50 bg-white text-[#b3261e] hover:bg-[#b3261e] hover:text-white',
        className
      )}
      {...rest}
    />
  )
}

/** A titled card. `flush` removes the inner padding for tables and lists that run edge to edge. */
export function Panel({ title, kicker, action, children, className, flush = false }: { title?: string; kicker?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={twMerge('min-w-0 border-t-2 border-ink bg-white shadow-[0_1px_0_rgba(14,20,36,.08)]', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-3.5 sm:px-5">
          <div className="min-w-0">
            {kicker && <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{kicker}</p>}
            {title && <h2 className="text-[18px] leading-tight tracking-[-0.01em]">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? '' : 'px-4 pb-5 sm:px-5'}>{children}</div>
    </section>
  )
}

/** Small state label. Meaning is carried by the word; the tint only helps scanning. */
export function Pill({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'ink' | 'signal' | 'warn' | 'good'; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-semibold leading-none',
        tone === 'neutral' && 'bg-paper-2 text-ink',
        tone === 'ink' && 'bg-ink text-white',
        tone === 'signal' && 'bg-signal/15 text-[#a8300f]',
        tone === 'warn' && 'bg-dew/30 text-[#6b4a00]',
        tone === 'good' && 'bg-[#dfeee2] text-[#1d5b2c]',
        className
      )}
    >
      {children}
    </span>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return <span aria-hidden="true" className={twMerge('flex size-9 flex-none items-center justify-center rounded-full bg-signal text-[13px] font-extrabold text-ink', className)}>{initials}</span>
}

/** Two or three choices in a row, e.g. Views | Readers. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string, number?][]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full border border-ink/20 bg-white p-0.5">
      {options.map(([id, text, count]) => (
        <button key={id} role="tab" type="button" aria-selected={value === id} onClick={() => onChange(id)} className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-muted transition-colors duration-150 hover:text-ink aria-selected:bg-ink aria-selected:text-white">
          {text}
          {count !== undefined && <span className="tabular-nums opacity-70">{count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Notice({ kind = 'info', children, className }: { kind?: 'info' | 'ok' | 'error'; children: React.ReactNode; className?: string }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={twMerge('border-l-[3px] px-3.5 py-2.5 text-[14px]', kind === 'error' ? 'border-[#b3261e] bg-[#fdecea]' : kind === 'ok' ? 'border-[#1d5b2c] bg-[#eef6ef]' : 'border-signal bg-paper', className)}>
      {children}
    </p>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-serif text-[24px] leading-tight">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-[42ch] text-[14px] text-muted">{children}</p>}
    </div>
  )
}

export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}

/**
 * A panel that slides in from the right on wide screens and up from the bottom on phones.
 * Used for the "Now" rail and the navigation menu on small screens.
 */
export function Drawer({ open, onClose, title, side = 'right', children }: { open: boolean; onClose: () => void; title: string; side?: 'right' | 'left'; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])
  const phone = typeof window !== 'undefined' && window.innerWidth < 640 && side === 'right'
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-[70] bg-ink/55 backdrop-blur-[2px]">
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={phone ? { y: '100%' } : { x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0, y: 0 }}
            exit={phone ? { y: '100%' } : { x: side === 'right' ? '100%' : '-100%' }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className={twMerge(
              'absolute flex flex-col bg-paper shadow-[0_0_60px_-10px_rgba(14,20,36,.6)]',
              phone ? 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl' : twMerge('inset-y-0 w-[min(380px,92vw)]', side === 'right' ? 'right-0' : 'left-0')
            )}
          >
            {phone && <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-ink/20" />}
            <div className="flex flex-none items-center justify-between gap-3 px-4 pb-2 pt-3">
              <h2 className="text-[18px]">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"><X className="size-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- Figures and charts ---------- */

/** A line with no axes, for the trend beside a headline number. One series, labelled for screen readers. */
export function Sparkline({ values, label, className }: { values: number[]; label: string; className?: string }) {
  const max = Math.max(1, ...values)
  const w = 100
  const h = 28
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label} className={twMerge('h-7 w-full', className)}>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** A headline number with its label, a note and an optional trend line. Text stays in ink. */
export function Kpi({ label, value, note, trend, dark = false }: { label: string; value: number | string; note?: string; trend?: number[]; dark?: boolean }) {
  return (
    <div className={twMerge('min-w-0 p-4', dark ? 'bg-ink-2 text-white' : 'border-t-2 border-ink bg-white')}>
      <p className={twMerge('truncate text-[12.5px]', dark ? 'text-mirror' : 'text-muted')}>{label}</p>
      <p className="mt-1 text-[34px] font-extrabold leading-none tracking-[-0.035em] tabular-nums sm:text-[38px]">{typeof value === 'number' ? value.toLocaleString('en-GB') : value}</p>
      {trend && trend.some((v) => v > 0) && <Sparkline values={trend} label={`${label}, last ${trend.length} days`} className={twMerge('mt-2', dark ? 'text-signal' : 'text-ink')} />}
      {note && <p className={twMerge('mt-1.5 truncate text-[12px]', dark ? 'text-mirror' : 'text-muted')}>{note}</p>}
    </div>
  )
}

/**
 * Bar chart for one series over days. One hue, bars anchored to the baseline with rounded
 * tops and a gap between them, a recessive axis, the peak labelled, a tooltip on every bar,
 * and the same numbers as a table underneath for anyone who prefers one.
 */
export function DayBars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0])
  const short = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return (
    <figure>
      <div className="flex h-[190px] items-end gap-[3px] border-b border-ink/30 pt-6" role="img" aria-label={`${label}, last ${data.length} days. Peak ${peak.value} on ${short(peak.day)}.`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" tabIndex={0} aria-label={`${short(d.day)}: ${d.value}`}>
            <div className="w-full rounded-t-[4px] bg-ink transition-colors duration-100 group-hover:bg-signal group-focus:bg-signal" style={{ height: `${Math.max(d.value ? 2 : 0, (d.value / max) * 100)}%` }} />
            {d === peak && d.value > 0 && <span className="pointer-events-none absolute inset-x-0 text-center text-[11.5px] font-semibold tabular-nums" style={{ bottom: `calc(${(d.value / max) * 100}% + 4px)` }}>{d.value}</span>}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-[12px] text-white group-hover:block group-focus:block">
              {short(d.day)}: <b className="tabular-nums">{d.value}</b>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-muted">
        <span>{short(data[0].day)}</span>
        <span>{short(data[Math.floor(data.length / 2)].day)}</span>
        <span>{short(data[data.length - 1].day)}</span>
      </div>
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as a table</summary>
        <table className="mt-2 w-full max-w-[320px] border-collapse tabular-nums">
          <tbody>{data.map((d) => <tr key={d.day} className="border-t border-rule"><td className="py-1">{short(d.day)}</td><td className="py-1 text-right">{d.value}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  )
}

/** Ranked horizontal bars: label, one-hue bar, value. */
export function RankBars({ rows, unit, empty = 'Nothing to show yet.' }: { rows: { key: string; label: string; value: number }[]; unit: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="text-[14px] text-muted">{empty}</p>
  return (
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {rows.map((r, i) => (
        <li key={r.key} className="min-w-0" title={`${r.label}: ${r.value} ${unit}`}>
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="min-w-0 truncate"><span className="mr-2 font-mono text-[11px] text-muted">{i + 1}</span>{r.label}</span>
            <span className="flex-none font-semibold tabular-nums">{r.value.toLocaleString('en-GB')}</span>
          </div>
          <div className="mt-1 h-1.5 bg-paper-2"><div className="h-full rounded-r-[3px] bg-ink" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ol>
  )
}
