/**
 * The dashboard's Engagement page: pages opened, clicks, where readers arrive from, what they
 * search for, how busy each hour or day was, and a heat map of where requests come from.
 * Every number covers only readers who allowed measurement.
 */
import React, { useEffect, useMemo, useState } from 'react'

import { ApiError, api } from '@/lib/api'
import { AFRICA_SHAPES, AFRICA_VIEW, MapShape, WORLD_SHAPES, WORLD_VIEW } from './maps.generated'
import { Empty, Kpi, Notice, Panel, RankBars, Segmented } from './ui'

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

/* ---------- Heat map ---------- */

/** One hue, light to dark: more requests, darker. Countries with nothing are a neutral grey. */
const RAMP = ['#ffe1d8', '#ffb7a4', '#ff8a6d', '#ec5630', '#b0300e']
const NONE = '#e4e0d6'
const AFRICAN = new Set(AFRICA_SHAPES.map((s) => s[0]))
const NAMES = new Map([...WORLD_SHAPES, ...AFRICA_SHAPES].map((s) => [s[0], s[1]]))
export const countryName = (code: string) => NAMES.get(code) ?? code

function HeatMap({ rows, metric }: { rows: CountryRow[]; metric: 'requests' | 'readers' }) {
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
                  onClick={(e) => {
                    const box = e.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect()
                    setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top })
                  }}
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
        <p className="mt-2 text-[12px] text-muted">Darker means more {unit}. Steps are logarithmic. Hover or tap a country for its figures. Outlines: Natural Earth.</p>
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
                <tr key={r.code} className={`border-b border-rule ${hover?.code === r.code ? 'bg-paper' : ''}`} onMouseEnter={() => setHover(null)}>
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

function LoadBars({ series, days }: { series: Data['series']; days: Data['days'] }) {
  const max = Math.max(1, ...series.map((s) => s.n))
  const peak = series.reduce((a, b) => (b.n > a.n ? b : a), series[0])
  const label = (t: string) => (days === 1 ? `${t.slice(11, 13)}:00` : new Date(`${t}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
  return (
    <div>
      <div className="flex h-[150px] items-end gap-[2px]" role="img" aria-label={`Requests per ${days === 1 ? 'hour' : 'day'}. Highest: ${fmt(peak?.n ?? 0)} at ${peak ? label(peak.t) : 'none'}.`}>
        {series.map((s) => (
          <div key={s.t} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div className={`w-full rounded-t-[3px] transition-colors ${s === peak && s.n > 0 ? 'bg-signal' : 'bg-ink/75 group-hover:bg-ink'}`} style={{ height: `${s.n === 0 ? 1 : Math.max(3, (s.n / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-[11.5px] tabular-nums text-white group-hover:block">{label(s.t)}: {fmt(s.n)}</span>
          </div>
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
  useEffect(() => {
    let live = true
    const load = () => api<Data>(`/admin/engagement?days=${days}`).then((d) => live && (setData(d), setError(''))).catch((e: ApiError) => live && setError(e.message))
    setData(null)
    load()
    const t = window.setInterval(load, 60000)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [days])

  if (error) return <Notice kind="error">{error}</Notice>
  const d = data
  const all = d ? d.countries.reduce((n, r) => n + r.requests, 0) : 0
  const africa = d ? d.countries.filter((r) => AFRICAN.has(r.code)).reduce((n, r) => n + r.requests, 0) : 0
  const empty = d && d.totals.pages + d.totals.clicks + d.totals.searches === 0 && all === 0

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Period" value={days} onChange={setDays} options={[['1', '24 hours'], ['7', '7 days'], ['30', '30 days']]} />
        <p className="text-[12.5px] text-muted">Readers who allowed measurement only. No IP addresses are stored. Refreshes every minute.</p>
      </div>

      {!d ? <div className="shimmer h-[420px] bg-paper-2" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Pages opened" value={d.totals.pages} note={change(d.totals.pages, d.previous.pages, d.days)} dark />
            <Kpi label="Readers" value={d.totals.readers} note={change(d.totals.readers, d.previous.readers, d.days)} />
            <Kpi label="Clicks" value={d.totals.clicks} note={change(d.totals.clicks, d.previous.clicks, d.days)} />
            <Kpi label="Searches" value={d.totals.searches} note={change(d.totals.searches, d.previous.searches, d.days)} />
          </div>

          {empty && <Notice>Nothing has been measured in this period yet. Counts appear as readers accept “Readership measurement” in the cookie notice and use the site.</Notice>}

          <Panel
            title="Where requests come from"
            kicker={all ? `${Math.round((africa / all) * 100)}% from Africa · ${d.countries.length} ${d.countries.length === 1 ? 'country' : 'countries'}` : 'Heat map'}
            action={<Segmented label="Measure" value={metric} onChange={setMetric} options={[['requests', 'Requests'], ['readers', 'Readers']]} />}
          >
            <HeatMap rows={d.countries} metric={metric} />
            {d.unknownCountry > 0 && <p className="mt-3 border-t border-rule pt-3 text-[12.5px] text-muted">{fmt(d.unknownCountry)} more {d.unknownCountry === 1 ? 'request has' : 'requests have'} no country (international edition, or the country could not be told).</p>}
          </Panel>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
            <Panel title={d.days === 1 ? 'Load, hour by hour' : 'Load, day by day'} kicker={d.busiestHour ? `Busiest hour of the day: ${String(d.busiestHour.hour).padStart(2, '0')}:00 to ${String((d.busiestHour.hour + 1) % 24).padStart(2, '0')}:00 UTC` : 'Requests'}>
              <LoadBars series={d.series} days={d.days} />
              <p className="mt-3 text-[12.5px] text-muted">Every measured request: pages, story views, clicks and searches. The busiest hour is where to expect congestion.</p>
            </Panel>
            <Panel title="Where readers arrive from" kicker={`${fmt(d.totals.referred)} of ${fmt(d.totals.pages)} pages came from another site`}>
              <RankBars rows={d.referrers.map((r) => ({ key: r.ref, label: r.ref, value: r.visits }))} unit="visits" empty="No visits from other sites yet. Direct visits and visits from apps that hide the sender are not listed." />
            </Panel>
            <Panel title="Most opened pages" kicker="By page views">
              <RankBars rows={d.pages.map((p) => ({ key: p.path, label: p.path === '/' ? 'Front page' : p.path, value: p.views }))} unit="views" empty="No pages opened yet." />
            </Panel>
            <Panel title="What gets clicked" kicker="Links out, offers, promotions and story actions">
              <RankBars rows={d.clicks.map((c) => ({ key: c.label, label: clickName(c.label), value: c.n }))} unit="clicks" empty="No clicks counted yet." />
            </Panel>
            <Panel title="What readers search for" kicker="Their words, most frequent first" className="xl:col-span-2" flush>
              {d.searches.length === 0 ? <Empty title="No searches yet.">When readers use search, their words appear here, with a note when nothing was found.</Empty> : (
                <ul className="grid sm:grid-cols-2">
                  {d.searches.map((s) => (
                    <li key={s.q} className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2.5 sm:px-5">
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
        </>
      )}
    </div>
  )
}
