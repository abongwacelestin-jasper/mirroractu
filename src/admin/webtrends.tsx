/**
 * The dashboard's Web trends page: the engine that fetches "Trending on the web". It shows, for
 * each outside source, whether it is on, how much of today's allowance is used, whether the
 * source has asked us to slow down, and every list with its age and next fetch.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { ApiError, api } from '@/lib/api'
import { useAdmin } from './AdminApp'
import { Btn, Empty, Field, Notice, Panel, Pill, Segmented, ago, inputClass, when } from './ui'

type SourceState = {
  id: string; label: string; credit: { name: string; url: string }; configured: boolean; enabled: boolean; pausedUntil: string | null
  gapS: number; normalGapS: number; budget: number; requestsToday: number; errorsToday: number; slowDownsToday: number
  lists: { total: number; ok: number; waiting: number; unsupported: number; failing: number }
}
type FeedRow = { source: string; country: string; name: string; status: string; n: number; fetched_at: string | null; next_at: string; interval_s: number; fails: number; last_error: string | null; mode: string | null; wanted: boolean }
type Status = { running: boolean; sources: SourceState[]; feeds: FeedRow[]; blocked: string[] }

const every = (s: number) => (s >= 7200 ? `every ${Math.round(s / 3600)} hours` : s >= 120 ? `every ${Math.round(s / 60)} minutes` : s > 0 ? `every ${s} seconds` : 'not yet')
const until = (iso: string) => {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  return m <= 0 ? 'due now' : m < 60 ? `in ${m} min` : m < 2880 ? `in ${Math.round(m / 60)} h` : `in ${Math.round(m / 1440)} days`
}

function SourceCard({ s, admin, onChange }: { s: SourceState; admin: boolean; onChange: () => void }) {
  const used = s.budget ? Math.min(100, Math.round((s.requestsToday / s.budget) * 100)) : 0
  const state: [string, 'good' | 'warn' | 'signal' | 'neutral'] = !s.configured ? ['Not in WEB_TRENDS_SOURCES', 'neutral'] : !s.enabled ? ['Switched off', 'neutral'] : s.pausedUntil ? [`Paused ${until(s.pausedUntil)}`, 'warn'] : used >= 100 ? ['Allowance used, resumes tomorrow', 'warn'] : ['Fetching', 'good']
  return (
    <Panel title={s.label} kicker={s.credit.name} action={<Pill tone={state[1]}>{state[0]}</Pill>}>
      <div className="grid gap-3 text-[13.5px]">
        <div>
          <div className="flex items-baseline justify-between gap-2"><span className="text-muted">Requests today</span><span className="tabular-nums"><b>{s.requestsToday.toLocaleString('en')}</b> of {s.budget.toLocaleString('en')}</span></div>
          <div className="mt-1 h-1.5 bg-paper-2" role="img" aria-label={`${used}% of today's allowance used`}><div className={`h-full ${used >= 90 ? 'bg-signal' : 'bg-ink'}`} style={{ width: `${Math.max(used, s.requestsToday ? 2 : 0)}%` }} /></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div><dt className="text-[12px] text-muted">Lists with content</dt><dd className="font-semibold tabular-nums">{s.lists.ok} of {s.lists.total - s.lists.unsupported}</dd></div>
          <div><dt className="text-[12px] text-muted">Gap between requests</dt><dd className="font-semibold tabular-nums">{s.gapS}s{s.gapS > s.normalGapS && <span className="font-normal text-muted"> (normally {s.normalGapS}s)</span>}</dd></div>
          <div><dt className="text-[12px] text-muted">Told to slow down today</dt><dd className="font-semibold tabular-nums">{s.slowDownsToday}</dd></div>
          <div><dt className="text-[12px] text-muted">Errors today</dt><dd className="font-semibold tabular-nums">{s.errorsToday}</dd></div>
        </dl>
        {s.lists.unsupported > 0 && <p className="text-[12.5px] text-muted">{s.lists.unsupported} {s.lists.unsupported === 1 ? 'country has' : 'countries have'} no list from this source. They are tried again every three days.</p>}
        {admin && s.configured && (
          <Btn tone="line" size="sm" className="justify-self-start" onClick={() => api(`/admin/web-trends/sources/${s.id}`, { method: 'PATCH', body: { enabled: !s.enabled } }).then(onChange)}>
            {s.enabled ? 'Switch this source off' : 'Switch this source on'}
          </Btn>
        )}
      </div>
    </Panel>
  )
}

export function WebTrendsAdmin() {
  const { user } = useAdmin()
  const [data, setData] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [source, setSource] = useState('google')
  const [word, setWord] = useState('')
  const reload = useCallback(() => {
    api<Status>('/admin/web-trends').then((d) => (setData(d), setError(''))).catch((e: ApiError) => setError(e.message))
  }, [])
  useEffect(() => {
    reload()
    const t = window.setInterval(reload, 15000)
    return () => window.clearInterval(t)
  }, [reload])

  if (error) return <Notice kind="error">{error}</Notice>
  if (!data) return <div className="shimmer h-[420px] bg-paper-2" />
  const feeds = data.feeds.filter((f) => f.source === source && f.status !== 'unsupported')
  const saveBlocked = (terms: string[]) => api('/admin/web-trends/blocked', { method: 'PUT', body: { terms } }).then(reload).catch((e: ApiError) => setError(e.message))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {!data.running && <Notice kind="error"><b>The engine is off</b> (<code>WEB_TRENDS=off</code> on the API). Lists already fetched stay on the site until they are too old to show.</Notice>}
      <Notice>
        These lists come from outside sources and appear on the Trends page under “Trending on the web”, apart from the newsroom’s own trends. The engine fetches the lists readers are looking at first, slows down for lists that are not changing, stays inside each source’s daily allowance, and pauses a source that asks it to. A failed fetch never removes a list: the last good one stays up.
      </Notice>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {data.sources.map((s) => <SourceCard key={s.id} s={s} admin={user.role === 'admin'} onChange={reload} />)}
      </div>

      <Panel title="Every list" kicker="One per source and country" action={<Segmented label="Source" value={source} onChange={setSource} options={data.sources.map((s) => [s.id, s.credit.name.replace('The ', ''), s.lists.ok] as [string, string, number])} />} flush>
        {feeds.length === 0 ? <Empty title="No lists for this source." /> : (
          <ul>
            {feeds.map((f) => (
              <li key={f.country} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule px-4 py-2.5 sm:px-5">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[14.5px] font-semibold">{f.name}{f.wanted && <Pill tone="signal">Readers looking</Pill>}</span>
                  <span className="block text-[12.5px] text-muted">
                    {f.n > 0 ? `${f.n} items, fetched ${f.fetched_at ? ago(f.fetched_at) : ''}` : f.status === 'new' ? 'Not fetched yet' : f.status === 'empty' ? 'The source had nothing for this country' : 'Nothing yet'}
                    {f.interval_s > 0 && ` · checked ${every(f.interval_s)}`}
                    {f.mode === 'about' && ' · articles about the country'}
                  </span>
                  {f.last_error && <span className="block break-words text-[12.5px] text-[#b3261e]">{f.fails > 0 ? `Failed ${f.fails} ${f.fails === 1 ? 'time' : 'times'}: ` : ''}{f.last_error}</span>}
                </span>
                <span className="flex items-center gap-2.5 text-[12.5px] tabular-nums text-muted">
                  <span title={when(f.next_at)}>Next {until(f.next_at)}</span>
                  <button type="button" aria-label={`Fetch ${f.name} now`} title="Fetch as soon as the source allows" onClick={() => api('/admin/web-trends/refresh', { body: { source: f.source, country: f.country } }).then(reload)} className="flex size-8 items-center justify-center rounded-full hover:bg-ink/5 hover:text-ink"><RefreshCw className="size-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Words that must not appear" kicker="Any item containing one is dropped from every list">
        <p className="mb-3 text-[13.5px] text-muted">Adult and gambling terms are always removed. Add anything else you do not want shown: a name, a slur, a brand.</p>
        <form className="flex max-w-[460px] gap-2" onSubmit={(e) => { e.preventDefault(); const w = word.trim().toLowerCase(); if (w.length >= 2 && !data.blocked.includes(w)) saveBlocked([...data.blocked, w]); setWord('') }}>
          <Field label="Add a word or phrase" className="flex-1"><input value={word} maxLength={60} onChange={(e) => setWord(e.target.value)} className={inputClass} /></Field>
          <Btn type="submit" className="self-end">Add</Btn>
        </form>
        {data.blocked.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.blocked.map((b) => (
              <li key={b}><button type="button" onClick={() => saveBlocked(data.blocked.filter((x) => x !== b))} aria-label={`Remove ${b}`} className="rounded-full border border-ink/25 bg-white px-3 py-1 text-[13px] font-semibold hover:border-ink">{b} <span aria-hidden="true" className="text-muted">×</span></button></li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
