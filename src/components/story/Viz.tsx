import React from 'react'
import { twMerge } from 'tailwind-merge'

import { NBA_RESULTS, Story, VIZ } from '@/data'

export type VizTone = 'paper' | 'white' | 'dark'

/**
 * The data graphic that stands in for a photograph. Every story with an entry in VIZ gets one.
 * `tone` is the surface it sits on.
 */
export function Viz({ story, tone = 'paper', className }: { story: Story; tone?: VizTone; className?: string }) {
  const v = VIZ[story.id]
  if (!v) return null
  const dark = tone === 'dark'
  const main = dark ? 'text-white' : 'text-ink'
  const sub = dark ? 'text-mirror' : 'text-muted'
  const line = dark ? 'border-rule-dark' : 'border-rule'
  const cap = (t: string) => <p className={twMerge('mb-3.5 text-[13px]', sub)}>{t}</p>
  const src = (t: string) => <p className={twMerge('mt-3.5 text-xs', sub)}>Source: {t}</p>

  let body: React.ReactNode = null

  if (v.k === 'bars') {
    const max = Math.max(...v.rows.map((r) => r[1]))
    body = (
      <>
        {cap(v.cap)}
        <div className="grid grid-cols-[minmax(0,auto)_1fr_auto] items-center gap-x-3.5 gap-y-[9px] text-sm">
          {v.rows.map(([label, value, shown, hi]) => (
            <React.Fragment key={label}>
              <span className={twMerge('max-w-[13ch] leading-tight sm:max-w-[20ch]', hi && 'font-semibold')}>{label}</span>
              <span className="relative h-4">
                <i className={twMerge('absolute inset-y-0 left-0', hi ? 'bg-current' : 'hatch')} style={{ width: `${(value / max) * 100}%` }} />
              </span>
              <span className={twMerge('text-right', hi && 'font-semibold')}>{shown}</span>
            </React.Fragment>
          ))}
        </div>
        {src(v.src)}
      </>
    )
  } else if (v.k === 'div') {
    const neg = Math.max(0, ...v.rows.map((r) => -r[1]))
    const pos = Math.max(0, ...v.rows.map((r) => r[1]))
    const axis = (neg / (neg + pos)) * 100
    body = (
      <>
        {cap(v.cap)}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3.5 gap-y-[9px] text-sm">
          {v.rows.map(([label, value, shown]) => {
            const w = (Math.abs(value) / (neg + pos)) * 100
            return (
              <React.Fragment key={label}>
                <span>{label}</span>
                <span className="relative h-4">
                  <span className="absolute -inset-y-[5px] border-l border-current" style={{ left: `${axis}%` }} />
                  <i
                    className={twMerge('absolute inset-y-0', value > 0 ? 'hatch' : 'bg-current')}
                    style={value < 0 ? { right: `${100 - axis}%`, width: `${w}%` } : { left: `${axis}%`, width: `${w}%` }}
                  />
                </span>
                <span className="text-right font-semibold">{shown}</span>
              </React.Fragment>
            )
          })}
        </div>
        {src(v.src)}
      </>
    )
  } else if (v.k === 'prog') {
    body = (
      <>
        {cap(v.cap)}
        <div className={twMerge('relative h-[22px] border', dark ? 'border-mirror' : 'border-muted')}>
          <i className="absolute inset-y-0 left-0 bg-current" style={{ width: `${v.p}%` }} />
        </div>
        <div className="mt-2.5 flex justify-between text-[13.5px]">
          <span><b className="text-[22px] font-semibold">{v.p}%</b> funded</span>
          <span>$2.9bn needed</span>
        </div>
        {src(v.src)}
      </>
    )
  } else if (v.k === 'fig') {
    body = (
      <div>
        <b className="block text-[52px] font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-[64px]">{v.n}</b>
        <span className={twMerge('mt-2.5 block max-w-[30ch] text-sm', sub)}>{v.c}</span>
      </div>
    )
  } else if (v.k === 'seats') {
    const pct = (n: number) => `${(n / 131) * 100}%`
    body = (
      <>
        {cap('Preliminary seats in a 131-seat parliament')}
        <div className="relative mt-[26px] flex h-[34px]">
          <i className="h-full bg-current" style={{ width: pct(67) }} />
          <i className={twMerge('h-full border', dark ? 'border-mirror' : 'border-muted')} style={{ width: pct(7) }} />
          <i className="hatch h-full" style={{ width: pct(57) }} />
          <div className="absolute -bottom-1.5 -top-[22px] border-l border-dashed border-signal" style={{ left: pct(66) }}>
            <span className="absolute -top-0.5 left-1.5 whitespace-nowrap text-xs">66 needed</span>
          </div>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-[13.5px]">
          <div><b className="block text-[22px] font-semibold tracking-[-0.02em]">67</b>Governing coalition</div>
          <div className="text-right"><b className="block text-[22px] font-semibold tracking-[-0.02em]">57</b>Labour, Greens, Māori Party</div>
        </div>
        {src('Xinhua, 8 Nov. Seven seats sit outside both blocs. Final count 27 Nov.')}
      </>
    )
  } else if (v.k === 'scale') {
    const x = (t: number) => `${(t / 2.4) * 100}%`
    body = (
      <>
        {cap('Global temperature above the pre-industrial estimate')}
        <div className="relative mx-2.5 mt-1.5 h-24">
          <div className="absolute inset-x-0 top-[62px] h-px bg-current" />
          {[0, 0.5, 1, 1.5, 2].map((t) => (
            <div key={t} className="absolute top-[57px] h-[11px] border-l border-current" style={{ left: x(t) }}>
              <span className={twMerge('absolute top-[15px] -translate-x-1/2 whitespace-nowrap text-xs', sub)}>{t ? `+${t}°C` : '0'}</span>
            </div>
          ))}
          <div className={twMerge('absolute bottom-[22px] top-[30px] border-l border-dashed', dark ? 'border-mirror' : 'border-muted')} style={{ left: x(1.5) }}>
            <span className={twMerge('absolute -top-1 right-2 whitespace-nowrap text-xs', sub)}>Paris limit</span>
          </div>
          <div className="absolute top-[55px] -ml-[7px] size-[15px] rounded-full bg-signal" style={{ left: x(1.75) }}>
            <span className="absolute -right-1 -top-[58px] whitespace-nowrap text-sm font-semibold">Oct 2026: +1.75°C</span>
          </div>
        </div>
        {src('Copernicus bulletin of 5 Nov, via RMetS')}
      </>
    )
  } else if (v.k === 'scores') {
    body = (
      <>
        {cap('NBA, Friday 13 November (US time)')}
        <NbaScores dark={dark} />
        {src('sports data feed')}
      </>
    )
  }

  return (
    <div
      className={twMerge(
        'px-6 pb-5 pt-[22px] tabular-nums',
        main,
        tone === 'paper' && 'bg-paper',
        tone === 'white' && 'bg-white',
        tone === 'dark' && 'bg-ink-2',
        line,
        className
      )}
    >
      {body}
    </div>
  )
}

export function NbaScores({ dark = false }: { dark?: boolean }) {
  return (
    <div className="grid text-[15px]">
      {NBA_RESULTS.map(([home, hs, as, away], i) => (
        <div
          key={home}
          className={twMerge(
            'grid grid-cols-[1fr_34px_34px_1fr] items-baseline gap-2.5 py-2',
            i === 0 ? 'pt-0' : dark ? 'border-t border-rule-dark' : 'border-t border-rule'
          )}
        >
          <b className="font-semibold">{home}</b>
          <b className="text-right font-semibold">{hs}</b>
          <span>{as}</span>
          <span className={dark ? 'text-mirror' : 'text-muted'}>{away}</span>
        </div>
      ))}
    </div>
  )
}
