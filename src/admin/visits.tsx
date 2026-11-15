/**
 * The dashboard's Visits page. A visit is one reader's time on the site in one tab: the page
 * they arrived on, each page after it, what they clicked and searched for, and how long each
 * page was on screen. The list shows recent visits; opening one shows its route, step by step.
 *
 * A visit is known only by a random code made in the reader's browser for that visit. There is
 * no IP address, visits are not linked to each other, and nothing says who the reader is.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Monitor, Smartphone, Tablet } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { COUNTRIES } from '@/data/geo'
import { ApiError, api } from '@/lib/api'
import { adminPath } from '@/lib/target'
import { Event, TYPE, countryName, describe } from './engagement'
import { useLive } from './live'
import { Btn, Empty, Kpi, Notice, Panel, Pill, Segmented, inputClass } from './ui'

type Visit = { visit: string; started: string; ended: string; pages: number; clicks: number; searches: number; seconds: number; country: string | null; device: string | null; os: string | null; browser: string | null; lang: string | null; entry: string | null; exit: string | null; ref: string | null }
type Step = Omit<Event, 'type'> & { type: Event['type'] | 'time'; device: string | null; os: string | null; browser: string | null }

const DEVICE = { phone: Smartphone, tablet: Tablet, desktop: Monitor } as const
const secs = (n: number) => (n < 60 ? `${Math.round(n)}s` : `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, '0')}s`)
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const page = (path: string | null) => (path === '/' ? 'Front page' : path ?? 'Unknown')
/** A visit's short name, for telling two apart on screen. It means nothing outside this page. */
export const visitName = (id: string) => `Visit ${id.slice(0, 5).toUpperCase()}`
const deviceWords = (v: { device: string | null; os: string | null; browser: string | null }) => [v.device && v.device[0].toUpperCase() + v.device.slice(1), v.os, v.browser].filter(Boolean).join(' · ') || 'Device not recorded'

function DeviceIcon({ device, className }: { device: string | null; className?: string }) {
  const Icon = DEVICE[(device ?? 'desktop') as keyof typeof DEVICE] ?? Monitor
  return <Icon className={className} aria-hidden="true" />
}

/* ---------- One visit, step by step ---------- */

function Route({ id }: { id: string }) {
  const [data, setData] = useState<{ steps: Step[]; titles: Record<string, string> } | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    api<{ steps: Step[]; titles: Record<string, string> }>(`/admin/visits/${id}`).then((d) => (setData(d), setError(''))).catch((e: ApiError) => setError(e.message))
  }, [id])
  useEffect(load, [load])
  // If the visit is still going on, its next steps arrive by themselves.
  useLive(['events'], (m) => m.t === 'events' && (m.d.items as { visit?: string }[]).some((e) => e.visit === id) && load(), 600)

  const back = <Link to={adminPath('visits')} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold underline decoration-signal decoration-2 underline-offset-4"><ArrowLeft className="size-4" /> All visits</Link>
  if (error) return <div className="grid gap-4">{back}<Notice kind="error">{error}</Notice></div>
  if (!data) return <div className="shimmer h-[420px] bg-paper-2" />

  const steps = data.steps
  const first = steps[0]
  const last = steps.at(-1)!
  // Time on screen is reported when a page is left: attach it to the page it belongs to.
  const timeOn = new Map<number, number>()
  const shown: (Step & { n: number })[] = []
  steps.forEach((s) => {
    if (s.type === 'time') {
      const at = [...shown].reverse().find((x) => (x.type === 'page' || x.type === 'view') && (data.titles[x.path ?? ''] ?? x.path) === (data.titles[s.path ?? ''] ?? s.path) && !timeOn.has(x.n))
      if (at) timeOn.set(at.n, s.value ?? 0)
      return
    }
    // A story sends both "page" and "story" for the same moment: show it once, as the story.
    const prev = shown.at(-1)
    const isPage = (x: Step) => x.type === 'page' || x.type === 'view'
    const same = (x: Step, y: Step) => (data.titles[x.path ?? ''] ?? x.path) === (data.titles[y.path ?? ''] ?? y.path)
    if (prev && isPage(prev) && isPage(s) && same(prev, s) && Math.abs(new Date(s.at).getTime() - new Date(prev.at).getTime()) < 5000) {
      if (s.type === 'view') prev.type = 'view'
      return
    }
    shown.push({ ...s, n: shown.length })
  })
  const pages = shown.filter((s) => s.type === 'page' || s.type === 'view')
  const onScreen = [...timeOn.values()].reduce((a, b) => a + b, 0)
  const span = (new Date(last.at).getTime() - new Date(first.at).getTime()) / 1000
  const live = Date.now() - new Date(last.at).getTime() < 120000

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">{back}{live && <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1d5b2c]"><span className="size-2 animate-pulse rounded-full bg-[#1d5b2c]" /> Still on the site</span>}</div>
      <div className="flex flex-wrap items-end justify-between gap-4 bg-ink px-5 py-5 text-white sm:px-7">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mirror">One visit · {stamp(first.at)}</p>
          <h2 className="mt-1 text-[30px] font-extrabold leading-none tracking-[-0.035em]">{visitName(id)}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-mirror-light">
            <span className="flex items-center gap-1.5"><DeviceIcon device={first.device} className="size-4" />{deviceWords(first)}</span>
            <span>{first.country ? countryName(first.country) : 'No country'}</span>
            {first.lang && <span>Reading in {first.lang}</span>}
          </p>
        </div>
        <p className="max-w-[40ch] text-[12.5px] text-mirror">This name is a random code for this visit only. It is not a person, an account or an IP address, and it is not linked to this reader’s other visits.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pages" value={pages.length} note={`Arrived on ${page(pages[0]?.path ?? null)}`} dark />
        <Kpi label="On screen" value={onScreen ? secs(onScreen) : '–'} note={onScreen ? 'Seconds pages were really in view' : 'Reported as each page is left'} />
        <Kpi label="From first to last" value={secs(span)} note={`${clock(first.at)} to ${clock(last.at)}`} />
        <Kpi label="Clicks and searches" value={shown.filter((s) => s.type === 'click' || s.type === 'search').length} note={first.ref ? `Arrived from ${first.ref}` : 'Arrived directly'} />
      </div>

      <Panel title="The route" kicker={`${shown.length} steps, in order`}>
        <ol className="relative ml-2 border-l-2 border-ink/15">
          {shown.map((s, i) => {
            const gap = i > 0 ? (new Date(s.at).getTime() - new Date(shown[i - 1].at).getTime()) / 1000 : 0
            const isPage = s.type === 'page' || s.type === 'view'
            const title = data.titles[s.path ?? '']
            return (
              <li key={s.at + i} className="relative pb-5 pl-6 last:pb-0">
                <span aria-hidden="true" className={`absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-white ${isPage ? 'bg-ink' : s.type === 'click' ? 'bg-signal' : 'bg-dew'}`} />
                {i > 0 && gap >= 1 && <p className="-mt-1 mb-1.5 text-[11.5px] text-muted tabular-nums">{secs(gap)} later</p>}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <time dateTime={s.at} className="font-mono text-[12.5px] tabular-nums">{clock(s.at)}</time>
                  <Pill tone={TYPE[s.type as Event['type']][1]}>{i === 0 ? 'Arrived' : TYPE[s.type as Event['type']][0]}</Pill>
                  <span className="min-w-0 break-words text-[15px] font-semibold">{isPage ? title ?? page(s.path) : describe(s as Event)}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {isPage && title && <span className="break-all">{s.path} · </span>}
                  {!isPage && s.path && <>on {page(s.path)} · </>}
                  {s.ref && <>came from {s.ref} · </>}
                  {isPage && (timeOn.has(s.n) ? <b className="text-ink">{secs(timeOn.get(s.n)!)} on screen</b> : i === shown.length - 1 && live ? 'on this page now' : 'time on screen not reported')}
                </p>
              </li>
            )
          })}
          <li className="relative pl-6 pt-1 text-[12.5px] text-muted"><span aria-hidden="true" className="absolute -left-[5px] top-2.5 size-2 rounded-full bg-ink/30" />{live ? 'The visit is still going on. New steps appear here by themselves.' : `Last seen leaving ${page(pages.at(-1)?.path ?? null)} at ${clock(last.at)}.`}</li>
        </ol>
      </Panel>
    </div>
  )
}

/* ---------- Recent visits ---------- */

export function Visits() {
  const [params, setParams] = useSearchParams()
  const id = params.get('id')
  const [days, setDays] = useState<'1' | '7' | '30'>('1')
  const [country, setCountry] = useState('')
  const [device, setDevice] = useState('')
  const [data, setData] = useState<{ total: number; averagePages: number | null; visits: Visit[]; more: boolean } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const url = (offset: number) => `/admin/visits?days=${days}&offset=${offset}${country ? `&country=${country}` : ''}${device ? `&device=${device}` : ''}`
  const load = useCallback(() => {
    api<{ total: number; averagePages: number | null; visits: Visit[]; more: boolean }>(url(0)).then((d) => (setData(d), setError(''))).catch((e: ApiError) => setError(e.message))
  }, [days, country, device])
  useEffect(() => {
    if (id) return
    setData(null)
    load()
  }, [load, id])
  useLive(['events'], () => !id && load(), 3000)

  if (id && /^[a-z0-9]{10,24}$/.test(id)) return <Route id={id} />
  if (error) return <Notice kind="error">{error}</Notice>
  const more = () => {
    setLoading(true)
    api<{ visits: Visit[]; more: boolean }>(url(data!.visits.length)).then((d) => setData((x) => (x ? { ...x, visits: [...x.visits, ...d.visits], more: d.more } : x))).catch(() => {}).finally(() => setLoading(false))
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented label="Period" value={days} onChange={setDays} options={[['1', '24 hours'], ['7', '7 days'], ['30', '30 days']]} />
        <select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)} className={`${inputClass} w-auto py-2 text-[14px]`}>
          <option value="">All countries</option>
          {COUNTRIES.filter((c) => c.code !== 'INT').map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select aria-label="Device" value={device} onChange={(e) => setDevice(e.target.value)} className={`${inputClass} w-auto py-2 text-[14px]`}>
          <option value="">All devices</option><option value="phone">Phones</option><option value="tablet">Tablets</option><option value="desktop">Computers</option>
        </select>
      </div>
      <Notice>A visit is one reader’s time on the site in one tab. It is known by a random code made in their browser for that visit only: no IP address, no account, and no link to the same reader’s other visits. Only readers who allowed measurement appear.</Notice>

      {!data ? <div className="shimmer h-[360px] bg-paper-2" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Visits" value={data.total} note="In this period, with these filters" dark />
            <Kpi label="Pages per visit" value={data.averagePages ?? '–'} note="On average" />
            <Kpi label="On phones" value={data.visits.length ? `${Math.round((data.visits.filter((v) => v.device === 'phone').length / data.visits.length) * 100)}%` : '–'} note="Of the visits listed" />
          </div>
          <Panel title="Recent visits" kicker="Newest first. Open one for its route" flush>
            {data.visits.length === 0 ? <Empty title="No visits to show.">Visits appear as readers who allowed measurement use the site.</Empty> : (
              <ul>
                {data.visits.map((v) => {
                  const going = Date.now() - new Date(v.ended).getTime() < 120000
                  return (
                    <li key={v.visit} className="border-t border-rule">
                      <button type="button" onClick={() => setParams({ id: v.visit })} className="group grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 px-4 py-3 text-left transition-colors hover:bg-paper sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5">
                        <span className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-ink text-white"><DeviceIcon device={v.device} className="size-[18px]" /></span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-semibold"><span className="decoration-signal decoration-2 underline-offset-4 group-hover:underline" translate="no">{visitName(v.visit)}</span>{going && <Pill tone="good">On the site now</Pill>}<span className="text-[13px] font-normal text-muted">{v.country ? countryName(v.country) : 'No country'} · {deviceWords(v)}</span></span>
                          <span className="mt-0.5 block truncate text-[13px] text-muted">{page(v.entry)}{v.pages > 1 && v.exit && v.exit !== v.entry ? ` → … → ${page(v.exit)}` : ''}{v.ref ? ` · from ${v.ref}` : ''}</span>
                        </span>
                        <span className="col-start-2 mt-1 flex flex-wrap gap-x-4 text-[12.5px] tabular-nums text-muted sm:col-start-auto sm:mt-0 sm:flex-col sm:items-end sm:gap-0.5">
                          <span className="text-ink">{stamp(v.started)}</span>
                          <span>{v.pages} {v.pages === 1 ? 'page' : 'pages'}{v.clicks ? ` · ${v.clicks} ${v.clicks === 1 ? 'click' : 'clicks'}` : ''}{v.searches ? ` · ${v.searches} ${v.searches === 1 ? 'search' : 'searches'}` : ''}</span>
                          <span>{v.seconds ? `${secs(v.seconds)} on screen` : 'time not reported yet'}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {data.more && <div className="border-t border-rule px-4 py-3 sm:px-5"><Btn tone="line" disabled={loading} onClick={more}>{loading ? 'Loading…' : 'Show 50 more'}</Btn></div>}
          </Panel>
        </>
      )}
    </div>
  )
}
