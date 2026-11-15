/**
 * The dashboard's Engagement page: pages opened, clicks, where readers arrive from, what they
 * search for, how busy each hour or day was, and a heat map of where requests come from.
 * Every number covers only readers who allowed measurement.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { ApiError, api } from '@/lib/api'
import { AFRICA_SHAPES, AFRICA_VIEW, MapShape, WORLD_SHAPES, WORLD_VIEW } from './maps.generated'
import { useLive, useLiveStatus, usePresence } from './live'
import { Btn, Empty, Kpi, Notice, Panel, Pill, RankBars, Segmented } from './ui'

type Totals = { pages: number; readers: number; clicks: number; searches: number; referred: number }
type CountryRow = { code: string; requests: number; pages: number; readers: number }
type Data = {
  days: 1 | 7 | 30
  totals: Totals
  previous: Totals
  series: { t: string; n: number }[]
  pages: { path: string; views: number; readers: number }[]
  referrers: { ref: string; visits: number }[]
  clicks: { label: string; n: number }[]
  searches: { q: string; n: number; empty: number }[]
  countries: CountryRow[]
  busiestHour: { hour: number; n: number } | null
  unknownCountry: number
}

const fmt = (n: number) => n.toLocaleString('en')
const PERIOD = { 1: '24 hours', 7: '7 days', 30: '30 days' } as const
/** "+12% on the 7 days before", in words rather than arrows. */
const change = (now: number, before: number, days: 1 | 7 | 30) => (before === 0 ? (now === 0 ? `No activity in ${PERIOD[days]}` : `New in these ${PERIOD[days]}`) : `${now >= before ? '+' : '−'}${Math.abs(Math.round(((now - before) / before) * 100))}% on the ${PERIOD[days]} before`)

/* ---------- Detail: one country, page, site, click, search or stretch of time ---------- */

export type Pick = { by: 'country' | 'page' | 'ref' | 'click' | 'search' | 'time' | 'type'; value: string; title: string }
type Event = { at: string; type: 'page' | 'view' | 'click' | 'search'; path: string | null; label: string | null; ref: string | null; value: number | null; country: string | null; lang: string | null }
type Detail = {
  summary: { requests: number; readers: number; pages: number; views: number; clicks: number; searches: number; first: string | null; last: string | null }
  hours: { hour: number; n: number }[]
  types: { key: string; n: number }[]
  pages: { key: string; n: number }[]
  countries: { key: string; n: number }[]
  referrers: { key: string; n: number }[]
  languages: { key: string; n: number }[]
  labels: { key: string; n: number; type: 'click' | 'search' }[]
  events: Event[]
  more: boolean
}

const TYPE: Record<Event['type'], [string, 'ink' | 'neutral' | 'signal' | 'warn']> = { page: ['Page', 'neutral'], view: ['Story', 'ink'], click: ['Click', 'signal'], search: ['Search', 'warn'] }
const KIND: Record<Pick['by'], string> = { country: 'Country', page: 'Page', ref: 'Arrived from', click: 'Click', search: 'Search', time: 'Time', type: 'Kind of request' }
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
/** What one request was, in a sentence. */
const describe = (e: Event) => (e.type === 'search' ? `Searched “${e.label}”${e.value === 0 ? ', nothing found' : e.value != null ? `, ${e.value} results` : ''}` : e.type === 'click' ? clickName(e.label ?? '') : e.path === '/' ? 'Front page' : e.path ?? '')

function DetailModal({ pick, days, onClose, onPick }: { pick: Pick; days: Data['days']; onClose: () => void; onPick: (p: Pick) => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const url = (offset: number) => `/admin/engagement/detail?days=${days}&by=${pick.by}&value=${encodeURIComponent(pick.value)}&offset=${offset}`

  useEffect(() => {
    setDetail(null)
    setEvents([])
    setError('')
    api<Detail>(url(0)).then((d) => { setDetail(d); setEvents(d.events) }).catch((e: ApiError) => setError(e.message))
    panel.current?.focus()
    panel.current?.scrollTo(0, 0)
  }, [pick.by, pick.value, days])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
    }
  }, [])
  const more = () => {
    setLoading(true)
    api<Detail>(url(events.length)).then((d) => { setEvents((e) => [...e, ...d.events]); setDetail((x) => (x ? { ...x, more: d.more } : x)) }).catch(() => {}).finally(() => setLoading(false))
  }

  const s = detail?.summary
  const peak = detail ? detail.hours.reduce((a, b) => (b.n > a.n ? b : a), detail.hours[0]) : null
  const max = Math.max(1, ...(detail?.hours.map((h) => h.n) ?? [1]))
  // Requests grouped under the day they happened, so the times read as a timeline.
  const grouped = events.reduce<[string, Event[]][]>((acc, e) => {
    const d = day(e.at)
    if (acc.at(-1)?.[0] === d) acc.at(-1)![1].push(e)
    else acc.push([d, [e]])
    return acc
  }, [])
  const side: [string, Pick['by'], { key: string; n: number }[], (k: string) => string][] = detail
    ? ([
        ['Pages', 'page', pick.by === 'page' ? [] : detail.pages, (k: string) => (k === '/' ? 'Front page' : k)],
        ['Countries', 'country', pick.by === 'country' ? [] : detail.countries, countryName],
        ['Arrived from', 'ref', pick.by === 'ref' ? [] : detail.referrers, (k: string) => k],
        ['Clicks and searches', 'click', pick.by === 'click' || pick.by === 'search' ? [] : detail.labels, (k: string) => (detail.labels.find((l) => l.key === k)?.type === 'search' ? `Searched “${k}”` : clickName(k))],
      ] as [string, Pick['by'], { key: string; n: number }[], (k: string) => string][]).filter(([, , rows]) => rows.length > 0)
    : []

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-ink/60 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${KIND[pick.by]}: ${pick.title}`} className="scroll-quiet flex max-h-[92dvh] w-full max-w-[920px] flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-paper outline-none sm:max-h-[88dvh] sm:rounded-none">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-rule bg-ink px-5 py-4 text-white sm:px-7">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mirror">{KIND[pick.by]} · last {PERIOD[days]}</p>
            <h2 className="mt-0.5 break-words text-[24px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[28px]">{pick.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 flex size-10 flex-none items-center justify-center rounded-full text-mirror-light hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
        </div>

        <div className="grid gap-6 px-5 py-5 sm:px-7 sm:py-6">
          {error && <Notice kind="error">{error}</Notice>}
          {!detail && !error && <div className="shimmer h-[360px] bg-paper-2" />}
          {detail && s && (
            <>
              <dl className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
                {([['Requests', s.requests], ['Readers', s.readers], ['Pages and stories', s.pages + s.views], ['Clicks and searches', s.clicks + s.searches]] as [string, number][]).map(([k, v]) => (
                  <div key={k} className="bg-white px-4 py-3"><dt className="text-[12px] text-muted">{k}</dt><dd className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums">{fmt(v)}</dd></div>
                ))}
              </dl>
              {s.requests === 0 ? <Empty title="Nothing measured here in this period." /> : (
                <>
                  <p className="-mt-2 text-[13.5px] text-muted">First request <b className="text-ink">{s.first ? stamp(s.first) : ''}</b>, most recent <b className="text-ink">{s.last ? stamp(s.last) : ''}</b>. Times are in your own time zone.</p>

                  <section>
                    <h3 className="mb-2 text-[15px] font-semibold">When in the day <span className="font-normal text-muted">(UTC, all {PERIOD[days]} together)</span></h3>
                    <div className="flex h-[92px] items-end gap-[2px] bg-white px-3 pt-3" role="img" aria-label={`Requests by hour of the day. Busiest: ${String(peak?.hour ?? 0).padStart(2, '0')}:00 with ${fmt(peak?.n ?? 0)}.`}>
                      {detail.hours.map((h) => (
                        <div key={h.hour} className="group relative flex h-full min-w-0 flex-1 items-end">
                          <div className={`w-full rounded-t-[2px] ${h === peak && h.n > 0 ? 'bg-signal' : 'bg-ink/70 group-hover:bg-ink'}`} style={{ height: `${h.n === 0 ? 1 : Math.max(4, (h.n / max) * 100)}%` }} />
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-[11.5px] tabular-nums text-white group-hover:block">{String(h.hour).padStart(2, '0')}:00 · {fmt(h.n)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between bg-white px-3 pb-2 pt-1 text-[11px] tabular-nums text-muted"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
                  </section>

                  {side.length > 0 && (
                    <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                      {side.map(([title, by, rows, name]) => (
                        <div key={title} className="min-w-0">
                          <h3 className="mb-2.5 border-t-2 border-ink pt-2 text-[15px] font-semibold">{title}</h3>
                          <RankBars rows={rows.map((r) => ({ key: r.key, label: name(r.key), value: r.n }))} unit="requests" onPick={(k) => onPick({ by: by === 'click' && detail.labels.find((l) => l.key === k)?.type === 'search' ? 'search' : by, value: k, title: name(k) })} />
                        </div>
                      ))}
                    </section>
                  )}

                  <section>
                    <h3 className="mb-1 text-[15px] font-semibold">Every request <span className="font-normal text-muted">newest first, {fmt(events.length)} of {fmt(s.requests)}</span></h3>
                    {grouped.map(([d, list]) => (
                      <div key={d}>
                        <p className="sticky top-[76px] z-[5] bg-paper py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted sm:top-[84px]">{d}</p>
                        <ol className="bg-white">
                          {list.map((e, i) => (
                            <li key={e.at + i} className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-3 border-b border-rule px-3 py-2 sm:grid-cols-[84px_64px_minmax(0,1fr)_auto]">
                              <time dateTime={e.at} className="font-mono text-[12.5px] tabular-nums text-ink">{clock(e.at)}</time>
                              <span className="hidden sm:block"><Pill tone={TYPE[e.type][1]}>{TYPE[e.type][0]}</Pill></span>
                              <span className="min-w-0">
                                <span className="block break-words text-[14px] font-semibold leading-snug"><span className="mr-1.5 font-normal text-muted sm:hidden">{TYPE[e.type][0]}:</span>{describe(e)}</span>
                                {(e.type === 'click' || e.type === 'search') && e.path && <span className="block truncate text-[12px] text-muted">on {e.path === '/' ? 'the front page' : e.path}</span>}
                                {e.ref && <span className="block truncate text-[12px] text-muted">arrived from {e.ref}</span>}
                              </span>
                              <span className="col-start-2 text-[12px] text-muted sm:col-start-auto sm:text-right">{e.country ? countryName(e.country) : 'No country'}{e.lang && e.lang !== 'en' ? ` · ${e.lang}` : ''}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                    {detail.more && <div className="mt-3"><Btn tone="line" disabled={loading} onClick={more}>{loading ? 'Loading…' : 'Show 60 more'}</Btn></div>}
                    <p className="mt-3 text-[12.5px] text-muted">Each line is one measured request. No reader is identified: there is no IP address, and requests are not linked to one another.</p>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Heat map ---------- */

/** One hue, light to dark: more requests, darker. Countries with nothing are a neutral grey. */
const RAMP = ['#ffe1d8', '#ffb7a4', '#ff8a6d', '#ec5630', '#b0300e']
const NONE = '#e4e0d6'
const AFRICAN = new Set(AFRICA_SHAPES.map((s) => s[0]))
const NAMES = new Map([...WORLD_SHAPES, ...AFRICA_SHAPES].map((s) => [s[0], s[1]]))
export const countryName = (code: string) => NAMES.get(code) ?? code

function HeatMap({ rows, metric, onPick }: { rows: CountryRow[]; metric: 'requests' | 'readers'; onPick: (p: Pick) => void }) {
  const [view, setView] = useState<'africa' | 'world'>('africa')
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null)
  const by = useMemo(() => new Map(rows.map((r) => [r.code, r])), [rows])
  const shapes: MapShape[] = view === 'africa' ? AFRICA_SHAPES : WORLD_SHAPES
  const inView = rows.filter((r) => (view === 'africa' ? AFRICAN.has(r.code) : true))
  const max = Math.max(1, ...inView.map((r) => r[metric]))
  const total = Math.max(1, rows.reduce((n, r) => n + r[metric], 0))
  // Steps are on a log scale, so one very busy country does not wash out all the others.
  const step = (v: number) => Math.min(RAMP.length - 1, Math.max(0, Math.ceil((RAMP.length * Math.log1p(v)) / Math.log1p(max)) - 1))
  const edges = RAMP.map((_, i) => Math.max(1, Math.round(Math.expm1(((i + 1) * Math.log1p(max)) / RAMP.length))))
  const ranked = [...inView].sort((a, b) => b[metric] - a[metric]).slice(0, 10)
  const active = hover ? by.get(hover.code) : undefined
  const unit = metric === 'requests' ? 'requests' : 'readers'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Segmented label="Map" value={view} onChange={setView} options={[['africa', 'Africa'], ['world', 'World']]} />
          {/* Legend: the same five steps the map uses */}
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-3 border border-ink/15" style={{ background: NONE }} /> None</span>
            <span className="flex" aria-hidden="true">{RAMP.map((c) => <span key={c} className="h-3 w-6 border-y border-ink/15 first:border-l last:border-r" style={{ background: c }} />)}</span>
            <span className="tabular-nums">1 to {fmt(max)} {unit}</span>
          </div>
        </div>
        <div className="relative bg-paper/70" onMouseLeave={() => setHover(null)}>
          <svg viewBox={view === 'africa' ? AFRICA_VIEW : WORLD_VIEW} role="img" aria-label={`Map of ${view === 'africa' ? 'Africa' : 'the world'}: ${unit} by country. ${ranked.length ? `Most from ${ranked.slice(0, 3).map((r) => `${countryName(r.code)} (${fmt(r[metric])})`).join(', ')}.` : 'No data yet.'} The table beside it lists the figures.`} className={`mx-auto block h-auto w-full ${view === 'africa' ? 'max-w-[560px]' : ''}`}>
            {shapes.map(([code, , d]) => {
              const row = by.get(code)
              const v = row?.[metric] ?? 0
              return (
                <path
                  key={code}
                  d={d}
                  fill={v > 0 ? RAMP[step(v)] : NONE}
                  stroke={hover?.code === code ? '#0e1424' : '#ffffff'}
                  strokeWidth={hover?.code === code ? 1.6 : 0.7}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  onMouseMove={(e) => {
                    const box = e.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect()
                    setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top })
                  }}
                  onClick={() => row && onPick({ by: 'country', value: code, title: countryName(code) })}
                  className={row ? 'cursor-pointer' : undefined}
                />
              )
            })}
            {/* The outline of the country under the pointer, drawn last so it is never hidden. */}
            {hover && <path d={shapes.find((s) => s[0] === hover.code)?.[2]} fill="none" stroke="#0e1424" strokeWidth={1.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          </svg>
          {hover && (
            <div role="status" className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+12px)] bg-ink px-3 py-2 text-[12.5px] leading-snug text-white shadow-lg" style={{ left: Math.max(90, hover.x), top: Math.max(70, hover.y) }}>
              <b className="block text-[13.5px]">{countryName(hover.code)}</b>
              {active ? (
                <>
                  <span className="block tabular-nums">{fmt(active.requests)} requests ({Math.round((active.requests / Math.max(1, rows.reduce((n, r) => n + r.requests, 0))) * 100)}% of all)</span>
                  <span className="block tabular-nums text-mirror-light">{fmt(active.pages)} pages · {fmt(active.readers)} readers</span>
                </>
              ) : (
                <span className="block text-mirror-light">Nothing measured here</span>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-[12px] text-muted">Darker means more {unit}. Steps are logarithmic. Hover for a country’s figures; click it, or its row, for every request and its time. Outlines: Natural Earth.</p>
      </div>

      <div className="min-w-0">
        <h3 className="mb-2 text-[15px] font-semibold">{view === 'africa' ? 'Busiest in Africa' : 'Busiest countries'}</h3>
        {ranked.length === 0 ? (
          <p className="text-[14px] text-muted">No country has measured activity in this period yet.</p>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-ink text-left text-[11.5px] uppercase tracking-[0.08em] text-muted">
                <th className="py-1.5 font-medium">Country</th>
                <th className="py-1.5 text-right font-medium">Requests</th>
                <th className="py-1.5 text-right font-medium">Readers</th>
                <th className="py-1.5 pl-3 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.code} tabIndex={0} role="button" aria-label={`${countryName(r.code)}: open the detail`} onClick={() => onPick({ by: 'country', value: r.code, title: countryName(r.code) })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick({ by: 'country', value: r.code, title: countryName(r.code) }))} className={`cursor-pointer border-b border-rule transition-colors hover:bg-paper focus-visible:bg-paper ${hover?.code === r.code ? 'bg-paper' : ''}`} onMouseEnter={() => setHover(null)}>
                  <td className="py-2">
                    <span className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 flex-none border border-ink/15" style={{ background: RAMP[step(r[metric])] }} /><span className="truncate font-semibold">{countryName(r.code)}</span></span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.requests)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.readers)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums text-muted">{Math.round((r[metric] / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ---------- Load over time ---------- */

function LoadBars({ series, days, onPick }: { series: Data['series']; days: Data['days']; onPick: (p: Pick) => void }) {
  const max = Math.max(1, ...series.map((s) => s.n))
  const peak = series.reduce((a, b) => (b.n > a.n ? b : a), series[0])
  const label = (t: string) => (days === 1 ? `${t.slice(11, 13)}:00` : new Date(`${t}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
  return (
    <div>
      <div className="flex h-[150px] items-end gap-[2px]" role="img" aria-label={`Requests per ${days === 1 ? 'hour' : 'day'}. Highest: ${fmt(peak?.n ?? 0)} at ${peak ? label(peak.t) : 'none'}.`}>
        {series.map((s) => (
          <button key={s.t} type="button" disabled={s.n === 0} onClick={() => onPick({ by: 'time', value: s.t, title: days === 1 ? `${label(s.t)} to ${String((Number(s.t.slice(11, 13)) + 1) % 24).padStart(2, '0')}:00 UTC` : label(s.t) })} aria-label={`${label(s.t)}: ${fmt(s.n)} requests. Open the detail.`} className="group relative flex h-full min-w-0 flex-1 items-end enabled:cursor-pointer">
            <div className={`w-full rounded-t-[3px] transition-colors ${s === peak && s.n > 0 ? 'bg-signal' : 'bg-ink/75 group-hover:bg-ink'}`} style={{ height: `${s.n === 0 ? 1 : Math.max(3, (s.n / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-[11.5px] tabular-nums text-white group-hover:block">{label(s.t)}: {fmt(s.n)}</span>
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between border-t border-ink/20 pt-1 text-[11.5px] tabular-nums text-muted">
        <span>{series[0] ? label(series[0].t) : ''}</span>
        {peak && peak.n > 0 && <span className="font-semibold text-ink">Peak {fmt(peak.n)}, {label(peak.t)}</span>}
        <span>{series.at(-1) ? label(series.at(-1)!.t) : ''}</span>
      </div>
    </div>
  )
}

const CLICK: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^out:(.+)$/, (m) => `Link out to ${m[1]}`],
  [/^offer:(.+)$/, (m) => `Offer: ${m[1].replace(/[-/]/g, ' ')}`],
  [/^story:(.+)$/, (m) => `Story action: ${m[1]}`],
  [/^promo:(.+)$/, (m) => `Promotion: ${m[1]}`],
  [/^subscribe:(.+)$/, (m) => `Subscribe button (${m[1]})`],
  [/^mailto$/, () => 'Email link'],
  [/^webtrend:(.+)$/, (m) => `Trending on the web (${m[1]})`],
]
const clickName = (label: string) => {
  for (const [re, name] of CLICK) {
    const m = label.match(re)
    if (m) return name(m)
  }
  return label
}

export function Engagement() {
  const [days, setDays] = useState<'1' | '7' | '30'>('7')
  const [metric, setMetric] = useState<'requests' | 'readers'>('requests')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [pick, setPick] = useState<Pick | null>(null)
  const wanted = useRef(days)
  wanted.current = days
  const load = (period = wanted.current) => api<Data>(`/admin/engagement?days=${period}`).then((d) => period === wanted.current && (setData(d), setError(''))).catch((e: ApiError) => period === wanted.current && setError(e.message))
  useEffect(() => {
    setData(null)
    load(days)
    // A safety net only: figures normally move the moment a reader does something.
    const t = window.setInterval(() => load(), 300000)
    return () => window.clearInterval(t)
  }, [days])
  // Reader activity arrives in small batches. Each batch goes on the "Happening now" list at
  // once, and the totals, map and lists are worked out again a moment later.
  const [recent, setRecent] = useState<Event[]>([])
  useLive(['events'], (m) => m.t === 'events' && setRecent((r) => [...(m.d.items as Event[]).slice().reverse(), ...r].slice(0, 14)), 0)
  useLive(['events'], () => void load(), 2500)
  const presence = usePresence()
  const connection = useLiveStatus()

  if (error) return <Notice kind="error">{error}</Notice>
  const d = data
  const all = d ? d.countries.reduce((n, r) => n + r.requests, 0) : 0
  const africa = d ? d.countries.filter((r) => AFRICAN.has(r.code)).reduce((n, r) => n + r.requests, 0) : 0
  const empty = d && d.totals.pages + d.totals.clicks + d.totals.searches === 0 && all === 0

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Period" value={days} onChange={setDays} options={[['1', '24 hours'], ['7', '7 days'], ['30', '30 days']]} />
        <p className="text-[12.5px] text-muted">Readers who allowed measurement only. No IP addresses are stored. {connection === 'live' ? 'Updating live, as it happens.' : 'Live updates are reconnecting; figures refresh every few minutes.'}</p>
      </div>

      {!d ? <div className="shimmer h-[420px] bg-paper-2" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Pages opened" value={d.totals.pages} note={change(d.totals.pages, d.previous.pages, d.days)} dark />
            <Kpi label="Readers" value={d.totals.readers} note={change(d.totals.readers, d.previous.readers, d.days)} />
            <Kpi label="Clicks" value={d.totals.clicks} note={change(d.totals.clicks, d.previous.clicks, d.days)} />
            <Kpi label="Searches" value={d.totals.searches} note={change(d.totals.searches, d.previous.searches, d.days)} />
          </div>

          <Panel title="Right now" kicker={connection === 'live' ? 'Live' : 'Reconnecting'} action={<span className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${connection === 'live' ? 'text-[#1d5b2c]' : 'text-muted'}`}><span className={`size-2 rounded-full ${connection === 'live' ? 'animate-pulse bg-[#1d5b2c]' : 'bg-faint'}`} />{connection === 'live' ? 'Connected' : 'Waiting'}</span>}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <div>
                <p className="text-[12.5px] text-muted">Readers on the site</p>
                <p className="text-[56px] font-extrabold leading-none tracking-[-0.04em] tabular-nums" aria-live="polite">{presence ? fmt(presence.total) : '–'}</p>
                <p className="mt-1.5 text-[12.5px] text-muted">Pages open at this moment, everyone included. Countries are shown only for readers who allowed measurement.</p>
                {presence && Object.keys(presence.countries).length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(presence.countries).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, n]) => (
                      <li key={code}><button type="button" onClick={() => setPick({ by: 'country', value: code, title: countryName(code) })} className="rounded-full border border-ink/20 bg-white px-2.5 py-1 text-[12.5px] font-semibold tabular-nums hover:border-ink">{countryName(code)} {n}</button></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="min-w-0">
                <p className="mb-1.5 text-[12.5px] text-muted">Happening now</p>
                {recent.length === 0 ? <p className="border-t border-rule pt-3 text-[14px] text-muted">Waiting for the next reader. Each page opened, click and search appears here the moment it happens.</p> : (
                  <ol className="border-t border-rule">
                    {recent.map((e, i) => (
                      <li key={e.at + i} className={`grid grid-cols-[70px_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-rule py-1.5 ${i === 0 ? 'rise' : ''}`}>
                        <time dateTime={e.at} className="font-mono text-[12px] tabular-nums">{clock(e.at)}</time>
                        <span className="min-w-0 truncate text-[13.5px]"><b className="mr-1.5 font-semibold">{TYPE[e.type][0]}</b>{describe(e)}{e.ref ? <span className="text-muted"> · from {e.ref}</span> : null}</span>
                        <span className="text-[12px] text-muted">{e.country ? countryName(e.country) : ''}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </Panel>

          {empty && <Notice>Nothing has been measured in this period yet. Counts appear as readers accept “Readership measurement” in the cookie notice and use the site.</Notice>}

          <Panel
            title="Where requests come from"
            kicker={all ? `${Math.round((africa / all) * 100)}% from Africa · ${d.countries.length} ${d.countries.length === 1 ? 'country' : 'countries'}` : 'Heat map'}
            action={<Segmented label="Measure" value={metric} onChange={setMetric} options={[['requests', 'Requests'], ['readers', 'Readers']]} />}
          >
            <HeatMap rows={d.countries} metric={metric} onPick={setPick} />
            {d.unknownCountry > 0 && <p className="mt-3 border-t border-rule pt-3 text-[12.5px] text-muted">{fmt(d.unknownCountry)} more {d.unknownCountry === 1 ? 'request has' : 'requests have'} no country (international edition, or the country could not be told). <button type="button" onClick={() => setPick({ by: 'country', value: 'none', title: 'No country' })} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-[3px]">See them</button></p>}
          </Panel>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
            <Panel title={d.days === 1 ? 'Load, hour by hour' : 'Load, day by day'} kicker={d.busiestHour ? `Busiest hour of the day: ${String(d.busiestHour.hour).padStart(2, '0')}:00 to ${String((d.busiestHour.hour + 1) % 24).padStart(2, '0')}:00 UTC` : 'Requests'}>
              <LoadBars series={d.series} days={d.days} onPick={setPick} />
              <p className="mt-3 text-[12.5px] text-muted">Every measured request: pages, story views, clicks and searches. The busiest hour is where to expect congestion.</p>
            </Panel>
            <Panel title="Where readers arrive from" kicker={`${fmt(d.totals.referred)} of ${fmt(d.totals.pages)} pages came from another site`}>
              <RankBars rows={d.referrers.map((r) => ({ key: r.ref, label: r.ref, value: r.visits }))} unit="visits" onPick={(k) => setPick({ by: 'ref', value: k, title: k })} empty="No visits from other sites yet. Direct visits and visits from apps that hide the sender are not listed." />
            </Panel>
            <Panel title="Most opened pages" kicker="By page views">
              <RankBars rows={d.pages.map((p) => ({ key: p.path, label: p.path === '/' ? 'Front page' : p.path, value: p.views }))} unit="views" onPick={(k) => setPick({ by: 'page', value: k, title: k === '/' ? 'Front page' : k })} empty="No pages opened yet." />
            </Panel>
            <Panel title="What gets clicked" kicker="Links out, offers, promotions and story actions">
              <RankBars rows={d.clicks.map((c) => ({ key: c.label, label: clickName(c.label), value: c.n }))} unit="clicks" onPick={(k) => setPick({ by: 'click', value: k, title: clickName(k) })} empty="No clicks counted yet." />
            </Panel>
            <Panel title="What readers search for" kicker="Their words, most frequent first" className="xl:col-span-2" flush>
              {d.searches.length === 0 ? <Empty title="No searches yet.">When readers use search, their words appear here, with a note when nothing was found.</Empty> : (
                <ul className="grid sm:grid-cols-2">
                  {d.searches.map((s) => (
                    <li key={s.q} className="relative flex items-center justify-between gap-3 border-t border-rule px-4 py-2.5 transition-colors hover:bg-paper sm:px-5">
                      <button type="button" onClick={() => setPick({ by: 'search', value: s.q, title: `“${s.q}”` })} aria-label={`“${s.q}”: open the detail`} className="absolute inset-0" />
                      <span className="min-w-0 truncate text-[14.5px] font-semibold">“{s.q}”</span>
                      <span className="flex flex-none items-center gap-2 text-[12.5px] tabular-nums text-muted">
                        {s.empty > 0 && <span className="bg-signal/15 px-1.5 py-0.5 font-semibold text-ink">{s.empty === s.n ? 'Nothing found' : `${s.empty} found nothing`}</span>}
                        {fmt(s.n)} {s.n === 1 ? 'search' : 'searches'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="border-t border-rule px-4 py-3 text-[12.5px] text-muted sm:px-5">“Nothing found” marks subjects readers want and the site does not cover yet.</p>
            </Panel>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4 text-[13.5px]">
            <span className="text-muted">Every request, by kind:</span>
            {([['page', 'Pages'], ['view', 'Story views'], ['click', 'Clicks'], ['search', 'Searches']] as const).map(([k, name]) => <Btn key={k} size="sm" tone="line" onClick={() => setPick({ by: 'type', value: k, title: name })}>{name}</Btn>)}
          </div>
        </>
      )}
      {pick && d && <DetailModal pick={pick} days={d.days} onClose={() => setPick(null)} onPick={setPick} />}
    </div>
  )
}
