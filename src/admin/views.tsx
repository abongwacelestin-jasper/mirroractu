import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, ExternalLink, FileText, Minus, Pencil, Radio, Search, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { CATEGORIES, CategoryId, EDITION_DATE, storyPath } from '@/data'
import { COUNTRIES } from '@/data/geo'
import { storyMedia } from '@/data/media'
import { ApiError, api } from '@/lib/api'
import { HAS_SITE_LINK, SITE_URL, adminPath } from '@/lib/target'
import { OverviewData, PasswordInput, useAdmin } from './AdminApp'
import { useLive } from './live'

type OverviewTrend = OverviewData['trends'][number]
import { Avatar, Btn, BulkBar, Check, ConfirmBtn, DayBars, Empty, Field, Kpi, Notice, Panel, Pill, RankBars, Segmented, ago, inputClass, useSelection, when } from './ui'

/** Load something from the API, with a way to load it again. */
function useLoad<T>(path: string, topics: string[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => {
    api<T>(path)
      .then((d) => {
        setData(d)
        setError('')
      })
      .catch((e: ApiError) => setError(e.message))
  }, [path])
  useEffect(reload, [reload])
  // Loaded again the moment the API says one of these subjects changed (see ./live.ts).
  useLive(topics, reload)
  return { data, error, reload }
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/* ---------- Overview ---------- */

export function Overview() {
  const { user, overview: data, corrections } = useAdmin()
  const [metric, setMetric] = useState<'views' | 'readers'>('views')
  // Trends as readers in one country see them. Empty means the global list.
  const [place, setPlace] = useState('')
  const [placed, setPlaced] = useState<{ levels: { level: string; name: string; measuredReaders: number; trends: OverviewTrend[] }[] } | null>(null)
  useEffect(() => {
    setPlaced(null)
    if (place) api<typeof placed>(`/admin/trends?country=${place}`).then(setPlaced).catch(() => {})
  }, [place])
  if (!data) return <OverviewSkeleton />
  const c = data.counts
  const noReaders = data.days.every((d) => d.views === 0)
  const open = corrections.filter((x) => x.status === 'open' || x.status === 'checking').length
  const shownLevel = place ? placed?.levels[0] ?? null : null
  const trends: OverviewTrend[] = shownLevel ? shownLevel.trends : data.trends

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Hero: who you are, what today looks like */}
      <section className="bg-ink text-white">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-5 pb-5 pt-6 sm:px-7">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mirror">{EDITION_DATE}</p>
            <p className="mt-1.5 font-serif text-[clamp(30px,4.2vw,48px)] leading-[1.15] tracking-[-0.01em]">{greeting()}, {user.name.split(' ')[0]}<span className="text-signal">.</span></p>
            <p className="mt-2 max-w-[52ch] text-[14.5px] text-mirror-light">
              {c.stories} stories are live{c.drafts ? `, ${c.drafts} unpublished` : ''}. {open ? `${open} ${open === 1 ? 'correction is' : 'corrections are'} waiting for an editor.` : 'No corrections are waiting.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={adminPath('stories?new=1')} className="rounded-full border border-signal bg-signal px-4 py-2 text-[14px] font-semibold text-ink hover:bg-signal-hover">New story</Link>
            <Link to={adminPath('wire')} className="flex items-center gap-2 rounded-full border border-rule-dark px-4 py-2 text-[14px] font-semibold hover:border-white"><Radio className="size-4" /> File to the wire</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-rule-dark lg:grid-cols-4">
          <Kpi dark label="Readers, last 24 hours" value={c.readers_today} note={`${c.views_today} story views`} trend={data.days.map((d) => d.readers)} />
          <Kpi dark label="Stories published" value={c.stories} note={c.drafts ? `${c.drafts} unpublished` : 'None unpublished'} />
          <Kpi dark label="Subscribers" value={c.subscribers} note="Morning email sign-ups" />
          <Kpi dark label="Wire updates, 24 hours" value={c.wire_today} note={`${open} corrections open`} />
        </div>
      </section>

      {noReaders && (
        <Notice>
          No readership recorded yet. Views are counted only for readers who allow <b className="font-semibold">Readership measurement</b> in their privacy choice, and no IP address is stored.
        </Notice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel
          kicker="Last 14 days"
          title={metric === 'views' ? 'Story views per day' : 'Readers per day'}
          action={<Segmented label="Measure" value={metric} onChange={setMetric} options={[['views', 'Views'], ['readers', 'Readers']]} />}
        >
          <DayBars label={metric === 'views' ? 'Story views per day' : 'Readers per day'} data={data.days.map((d) => ({ day: d.day, value: d[metric] }))} />
        </Panel>
        <Panel kicker="Last 7 days" title="Most read">
          <RankBars unit="readers" empty="No story has been read by a measured reader yet." rows={data.topStories.map((s) => ({ key: s.id, label: s.headline, value: s.readers }))} />
        </Panel>
      </div>

      <Panel
        kicker={shownLevel ? `As readers in ${shownLevel.name} see it · ${shownLevel.measuredReaders} measured readers, 24h` : 'What every reader sees under Global'}
        title="Today’s trends"
        flush
        action={
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <span className="hidden sm:inline">Seen from</span>
            <select value={place} onChange={(e) => setPlace(e.target.value)} className="border border-ink/25 bg-white px-2.5 py-1.5 text-[13.5px] font-semibold text-ink">
              <option value="">Global</option>
              {data.activeCountries.length > 0 && <optgroup label="Countries with readers">{data.activeCountries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.readers})</option>)}</optgroup>}
              <optgroup label="All editions">{COUNTRIES.filter((c) => c.code !== 'INT').map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</optgroup>
            </select>
          </label>
        }
      >
        {/* Wide screens: a table. Phones: the same rows as cards. */}
        <div className="hidden md:block">
          <table className="w-full border-collapse text-[14px] tabular-nums">
            <thead>
              <tr className="border-b border-rule text-left text-[12px] text-muted">
                <th className="w-12 py-2 pl-5 font-medium">Rank</th><th className="py-2 font-medium">Subject</th><th className="py-2 text-right font-medium">Stories</th>
                <th className="py-2 text-right font-medium">Wire, 24h</th><th className="py-2 text-right font-medium">Readers, 24h</th><th className="py-2 pr-5 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => (
                <tr key={t.id} className="border-b border-rule last:border-b-0 hover:bg-paper/60">
                  <td className="py-2.5 pl-5"><span className="flex items-center gap-1.5 text-[17px] font-extrabold">{t.rank}<Moved n={t.moved} /></span></td>
                  <td className="py-2.5 font-semibold">{t.label}{t.activeNow && <Pill tone="signal" className="ml-2">Active now</Pill>}{shownLevel && t.basis === 'local' && <Pill className="ml-2">About {shownLevel.name}</Pill>}{shownLevel && t.basis === 'read-here' && <Pill className="ml-2">Read there</Pill>}</td>
                  <td className="py-2.5 text-right">{t.storyIds.length}</td><td className="py-2.5 text-right">{t.wireCount}</td><td className="py-2.5 text-right">{t.readers}</td>
                  <td className="py-2.5 pr-5 text-right font-bold">{t.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ol className="md:hidden">
          {trends.map((t) => (
            <li key={t.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-rule px-4 py-3">
              <span className="text-[22px] font-extrabold leading-none tabular-nums">{t.rank}</span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{t.label}</span>
                <span className="block text-[12.5px] text-muted tabular-nums">{t.storyIds.length} stories · {t.wireCount} wire · {t.readers} readers</span>
              </span>
              {t.activeNow ? <Pill tone="signal">Active</Pill> : <span className="text-[14px] font-bold tabular-nums">{t.score}</span>}
            </li>
          ))}
        </ol>
        <p className="border-t border-rule px-4 py-3 text-[12.5px] text-muted sm:px-5">Score: stories filed, half a point per wire update in 24 hours, and readership on a log scale. For a country, stories about it and readers in it count for more.</p>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
        <Panel kicker="Last 7 days" title="Readers by country"><RankBars unit="readers" empty="No measured readers yet." rows={data.countries.map((r) => ({ key: r.key, label: r.key === 'INT' ? 'International' : r.key, value: r.readers }))} /></Panel>
        <Panel kicker="Last 7 days" title="Readers by language"><RankBars unit="readers" empty="No measured readers yet." rows={data.languages.map((r) => ({ key: r.key, label: r.key, value: r.readers }))} /></Panel>
      </div>
    </div>
  )
}

function Moved({ n }: { n: number }) {
  if (n > 0) return <ArrowUp className="size-3.5 text-[#a8300f]" strokeWidth={3} aria-label={`Up ${n}`} />
  if (n < 0) return <ArrowDown className="size-3.5 text-muted" strokeWidth={3} aria-label={`Down ${-n}`} />
  return <Minus className="size-3.5 text-muted" aria-label="No change" />
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="Loading the overview">
      <div className="shimmer h-[230px] bg-ink-2" />
      <div className="grid gap-5 2xl:grid-cols-[1.7fr_1fr]"><div className="shimmer h-[300px] bg-paper-2" /><div className="shimmer h-[300px] bg-paper-2" /></div>
    </div>
  )
}

/* ---------- Stories ---------- */

type AdminStory = {
  id: string; slug: string; h: string; st: string; what: string; why: string; ok: string[]; un: string[]; src: [string, string, string?][]
  cats: CategoryId[]; tier: 'low' | 'medium' | 'high'; d: string; desk: string; sub: string; tags: string; published: boolean; version: number; updatedAt: string
  countries?: string[]
}
const TIER_TONE = { high: 'ink', medium: 'neutral', low: 'neutral' } as const

export function Stories() {
  const { user, reload: reloadShared } = useAdmin()
  const { data, error, reload } = useLoad<{ stories: AdminStory[] }>('/admin/stories', ['content'])
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<AdminStory | null>(null)
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState<'all' | 'published' | 'unpublished'>('all')
  const [desk, setDesk] = useState<CategoryId | 'all'>('all')
  const creating = params.get('new') === '1'
  // "Go to" in the top bar opens a story for editing by its id.
  const wanted = params.get('edit')
  useEffect(() => {
    const found = wanted && data?.stories.find((x) => x.id === wanted)
    if (found) setEditing(found)
  }, [wanted, data])

  const close = () => {
    setEditing(null)
    setParams({}, { replace: true })
    reload()
    reloadShared()
  }
  const all = data?.stories ?? []
  const list = useMemo(
    () =>
      all
        .filter((s) => status === 'all' || s.published === (status === 'published'))
        .filter((s) => desk === 'all' || s.cats.includes(desk))
        .filter((s) => `${s.h} ${s.st} ${s.sub} ${s.tags}`.toLowerCase().includes(filter.trim().toLowerCase())),
    [all, status, desk, filter]
  )

  const selection = useSelection(list.map((s) => s.id))
  const [bulkNote, setBulkNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const bulk = (action: 'publish' | 'unpublish' | 'delete') =>
    api<{ changed: number }>('/admin/stories/bulk', { body: { ids: selection.ids, action } })
      .then((r) => {
        setBulkNote({ kind: 'ok', text: `${r.changed} ${r.changed === 1 ? 'story' : 'stories'} ${action === 'delete' ? 'deleted' : action === 'publish' ? 'published' : 'taken off the site'}.` })
        selection.clear()
        reload()
        reloadShared()
      })
      .catch((e: ApiError) => setBulkNote({ kind: 'error', text: e.message }))

  if (error) return <Notice kind="error">{error}</Notice>
  if (creating || editing) return <StoryForm story={creating ? null : editing} isAdmin={user.role === 'admin'} onDone={close} />

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search stories</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" placeholder="Search headlines, topics, words" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} pl-10`} />
        </label>
        <select aria-label="Desk" value={desk} onChange={(e) => setDesk(e.target.value as CategoryId | 'all')} className={`${inputClass} w-auto`}>
          <option value="all">All desks</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Segmented label="Status" value={status} onChange={setStatus} options={[['all', 'All', all.length], ['published', 'Live', all.filter((s) => s.published).length], ['unpublished', 'Unpublished', all.filter((s) => !s.published).length]]} />
      </div>

      <Panel flush>
        {!data ? (
          <div className="shimmer h-[320px] bg-paper-2" role="status" aria-label="Loading stories" />
        ) : list.length === 0 ? (
          <Empty title="No stories match.">Try another word, desk or status.</Empty>
        ) : (
          <ul>
            <li>
              <BulkBar selection={selection} total={list.length} noun={['story', 'stories']}>
                <Btn size="sm" tone="line" onClick={() => bulk('publish')}>Publish</Btn>
                <Btn size="sm" tone="line" onClick={() => bulk('unpublish')}>Take off the site</Btn>
                {user.role === 'admin' && <ConfirmBtn label="Delete" question={`Delete ${selection.count} for good?`} onConfirm={() => bulk('delete')} />}
              </BulkBar>
            </li>
            {list.map((s) => {
              const m = storyMedia(s.id)
              return (
                <li key={s.id} className={`flex items-start border-b border-rule last:border-b-0 ${selection.has(s.id) ? 'bg-paper' : ''}`}>
                  <Check checked={selection.has(s.id)} onChange={() => selection.toggle(s.id)} label={`Tick: ${s.h}`} className="ml-2 mt-3 sm:ml-3" />
                  <button type="button" onClick={() => setEditing(s)} className="group grid min-w-0 flex-1 grid-cols-[64px_minmax(0,1fr)] items-start gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-paper/60 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:px-5">
                    <span className="block aspect-[4/3] overflow-hidden bg-paper-2">
                      {m ? <img src={m.src} alt="" loading="lazy" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-muted"><FileText className="size-5" /></span>}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                        <span className="font-semibold capitalize text-ink">{s.cats[0]}</span>
                        <span className="tabular-nums">{s.d}</span>
                        <span>· {s.sub}</span>
                        <Pill tone={TIER_TONE[s.tier]} className="capitalize">{s.tier} risk</Pill>
                        {!s.published && <Pill tone="warn">Unpublished</Pill>}
                      </span>
                      <span className="mt-1 block text-[16.5px] font-semibold leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline">{s.h}</span>
                      <span className="mt-0.5 line-clamp-1 text-[13.5px] text-muted">{s.st}</span>
                      <span className="mt-1 block text-[12px] text-muted tabular-nums sm:hidden">{s.ok.length} confirmed · {s.un.length} open · v{s.version}</span>
                    </span>
                    <span className="hidden flex-col items-end gap-1 text-right text-[12px] text-muted tabular-nums sm:flex">
                      <span>{s.ok.length} confirmed · {s.un.length} open</span>
                      <span>{s.src.length} {s.src.length === 1 ? 'source' : 'sources'} · v{s.version}</span>
                      <span className="mt-1 flex items-center gap-1 font-semibold text-ink opacity-0 transition-opacity group-hover:opacity-100"><Pencil className="size-3.5" /> Edit</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
      {bulkNote && <Notice kind={bulkNote.kind}>{bulkNote.text}</Notice>}
      <p className="text-[12.5px] text-muted">{list.length} of {all.length} stories. A story’s address never changes when its headline does.</p>
    </div>
  )
}

const BLANK = { h: '', st: '', what: '', why: '', ok: '', un: '', cats: ['world'] as CategoryId[], tier: 'medium' as AdminStory['tier'], d: new Date().toISOString().slice(0, 10), desk: 'World desk', sub: '', tags: '', published: false, countries: [] as string[], src: [['Report', '', ''], ['', '', ''], ['', '', '']] as string[][] }

function StoryForm({ story, isAdmin, onDone }: { story: AdminStory | null; isAdmin: boolean; onDone: () => void }) {
  const [f, setF] = useState(() =>
    story ? { ...story, countries: story.countries ?? [], ok: story.ok.join('\n'), un: story.un.join('\n'), src: [0, 1, 2].map((i) => [story.src[i]?.[0] ?? '', story.src[i]?.[1] ?? '', story.src[i]?.[2] ?? '']) } : BLANK
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean)
  const err = (k: string) => errors[k] || Object.entries(errors).find(([key]) => key.startsWith(`${k}.`))?.[1]

  const save = async () => {
    setBusy(true)
    setErrors({})
    setMessage('')
    const body = {
      h: f.h, st: f.st, what: f.what, why: f.why, ok: lines(f.ok), un: lines(f.un), cats: f.cats, tier: f.tier, d: f.d, desk: f.desk, sub: f.sub, tags: f.tags, published: f.published, countries: f.countries,
      src: f.src.filter((s) => s[0].trim() && s[1].trim()).map((s) => (s[2].trim() ? [s[0], s[1], s[2].trim()] : [s[0], s[1]])),
    }
    try {
      await api(story ? `/admin/stories/${story.id}` : '/admin/stories', { method: story ? 'PUT' : 'POST', body })
      onDone()
    } catch (e) {
      const a = e as ApiError
      setMessage(a.fields?.length ? `${a.fields.length} ${a.fields.length === 1 ? 'field needs' : 'fields need'} attention. They are marked below.` : a.message)
      setErrors(Object.fromEntries((a.fields ?? []).map((x) => [x.field, x.problem])))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Btn tone="ghost" size="sm" onClick={onDone} className="-ml-2">← All stories</Btn>
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          {story ? <>Version {story.version} · changed {ago(story.updatedAt)}</> : 'Not saved yet'}
          <Pill tone={f.published ? 'good' : 'warn'}>{f.published ? 'Published' : 'Unpublished'}</Pill>
        </div>
      </div>
      {message && <Notice kind="error">{message}</Notice>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel kicker={story ? 'Editing' : 'New story'} title="The story">
          <div className="grid gap-4">
            <Field label="Headline" hint={`${f.h.length} of 200 characters`} error={err('h')}><input value={f.h} onChange={(e) => set({ h: e.target.value })} className={`${inputClass} text-[18px] font-semibold`} maxLength={200} /></Field>
            <Field label="Standfirst" hint="One or two sentences under the headline." error={err('st')}><textarea rows={2} value={f.st} onChange={(e) => set({ st: e.target.value })} className={inputClass} /></Field>
            <Field label="What happened" error={err('what')}><textarea rows={4} value={f.what} onChange={(e) => set({ what: e.target.value })} className={inputClass} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={`Confirmed (${lines(f.ok).length})`} hint="One established fact per line." error={err('ok')}><textarea rows={6} value={f.ok} onChange={(e) => set({ ok: e.target.value })} className={inputClass} /></Field>
              <Field label={`Still open (${lines(f.un).length})`} hint="One open question per line." error={err('un')}><textarea rows={6} value={f.un} onChange={(e) => set({ un: e.target.value })} className={inputClass} /></Field>
            </div>
            <Field label="Why it matters" error={err('why')}><textarea rows={2} value={f.why} onChange={(e) => set({ why: e.target.value })} className={inputClass} /></Field>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold">Sources <span className="font-normal text-muted">(up to three; never add one only to reach three)</span></legend>
              <div className="grid gap-2.5">
                {f.src.map((s, i) => (
                  <div key={i} className="grid gap-2 border-l-2 border-rule pl-3 sm:grid-cols-[160px_minmax(0,1fr)] lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
                    {(['Role, e.g. Primary record', 'Source name and date', 'Link (optional)'] as const).map((ph, j) => (
                      <input key={j} aria-label={`Source ${i + 1}: ${ph}`} placeholder={ph} value={s[j]} onChange={(e) => set({ src: f.src.map((row, r) => (r === i ? row.map((c, k) => (k === j ? e.target.value : c)) : row)) })} className={twMerge(inputClass, j === 2 && 'sm:col-span-2 lg:col-span-1')} />
                    ))}
                  </div>
                ))}
              </div>
              {err('src') && <p className="mt-1 text-[12.5px] font-semibold text-[#b3261e]">{err('src')}</p>}
            </fieldset>
          </div>
        </Panel>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
          <Panel kicker="Where it goes" title="Filing">
            <div className="grid gap-4">
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold">Desks <span className="font-normal text-muted">(first is the lead desk)</span></legend>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const on = f.cats.includes(c.id)
                    return (
                      <button key={c.id} type="button" aria-pressed={on} onClick={() => set({ cats: on ? f.cats.filter((x) => x !== c.id) : [...f.cats, c.id].slice(0, 3) })} className="rounded-full border border-ink/25 px-3 py-1.5 text-[13.5px] transition-colors aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white">
                        {on && f.cats[0] === c.id ? '★ ' : ''}{c.name}
                      </button>
                    )
                  })}
                </div>
                {err('cats') && <p className="mt-1 text-[12.5px] font-semibold text-[#b3261e]">{err('cats')}</p>}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Risk tier" error={err('tier')}>
                  <select value={f.tier} onChange={(e) => set({ tier: e.target.value as AdminStory['tier'] })} className={inputClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
                </Field>
                <Field label="Source date" error={err('d')}><input type="date" value={f.d} onChange={(e) => set({ d: e.target.value })} className={inputClass} /></Field>
              </div>
              {f.tier === 'high' && <Notice>High risk: a named editor must sign off against primary sources before this is published.</Notice>}
              <Field label="Desk line" hint="Shown on the story, e.g. Climate desk." error={err('desk')}><input value={f.desk} onChange={(e) => set({ desk: e.target.value })} className={inputClass} /></Field>
              <Field label="Topic" hint="Groups stories within a section, e.g. Elections." error={err('sub')}><input value={f.sub} onChange={(e) => set({ sub: e.target.value })} className={inputClass} /></Field>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold">Countries this is about <span className="font-normal text-muted">({f.countries.length} chosen)</span></legend>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRIES.filter((c) => c.code !== 'INT').map((c) => {
                    const on = f.countries.includes(c.code)
                    return (
                      <button key={c.code} type="button" aria-pressed={on} title={c.name} onClick={() => set({ countries: on ? f.countries.filter((x) => x !== c.code) : [...f.countries, c.code] })} className="rounded-full border border-ink/25 px-2.5 py-1 text-[12.5px] transition-colors aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white">
                        {c.name}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-[12px] text-muted">Puts the story in that country’s trends and its region’s. Leave empty for a story that is global.</p>
              </fieldset>
              <Field label="Search words" hint="Extra words readers might search for."><input value={f.tags} onChange={(e) => set({ tags: e.target.value })} className={inputClass} /></Field>
            </div>
          </Panel>

          <Panel kicker="On the site" title="Publish">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={f.published} onChange={(e) => set({ published: e.target.checked })} className="mt-1 size-[18px] accent-[#0e1424]" />
              <span><span className="block text-[15px] font-semibold">Published on the site</span><span className="block text-[13px] text-muted">Readers see it within a few seconds of saving. Untick to take it down without deleting it.</span></span>
            </label>
            {story?.published && HAS_SITE_LINK && <a href={SITE_URL + storyPath(story.id)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold underline decoration-signal decoration-2 underline-offset-4">View on the site <ExternalLink className="size-3.5" /></a>}
          </Panel>
        </div>
      </div>

      {/* Actions stay in reach: pinned above the bottom bar on phones. */}
      <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-wrap items-center gap-2.5 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8">
        <Btn tone="signal" onClick={save} disabled={busy}>{busy ? 'Saving…' : story ? 'Save changes' : 'Create story'}</Btn>
        <Btn tone="line" onClick={onDone}>Cancel</Btn>
        {story && isAdmin && (
          <Btn
            tone="danger"
            className="ml-auto"
            onClick={async () => {
              if (!window.confirm(`Delete “${story.h}” for good? Unpublishing is usually the better choice.`)) return
              await api(`/admin/stories/${story.id}`, { method: 'DELETE' }).then(onDone).catch((e: ApiError) => setMessage(e.message))
            }}
          >
            <Trash2 className="size-4" /> <span className="hidden sm:inline">Delete</span>
          </Btn>
        )}
      </div>
    </div>
  )
}

/* ---------- Live wire ---------- */

type WireRow = { id: number; at: string; desk: string; cat: string; text: string; storyId?: string; kind: string }
const KIND_TONE: Record<string, 'signal' | 'neutral'> = { confirmed: 'signal', update: 'neutral', result: 'neutral', data: 'neutral' }

export function Wire() {
  const { reload: reloadShared } = useAdmin()
  const { data, reload } = useLoad<{ items: WireRow[] }>('/wire?limit=60', ['wire', 'wire.changed'])
  const stories = useLoad<{ stories: AdminStory[] }>('/admin/stories').data?.stories ?? []
  const [f, setF] = useState({ cat: 'world' as CategoryId, kind: 'update', text: '', storyId: '' })
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const wireSel = useSelection((data?.items ?? []).map((w) => w.id))
  const post = async () => {
    setMessage(null)
    try {
      await api('/admin/wire', { body: { ...f, desk: CATEGORIES.find((c) => c.id === f.cat)!.name } })
      setF((x) => ({ ...x, text: '' }))
      setMessage({ kind: 'ok', text: 'Filed. It is on every open page now.' })
      reload()
      reloadShared()
    } catch (e) {
      setMessage({ kind: 'error', text: (e as ApiError).fields?.[0]?.problem ?? (e as ApiError).message })
    }
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
        <Panel kicker="Reaches every open page at once" title="File an update">
          <div className="grid gap-4">
            <Field label="Update" hint={`${f.text.length} of 300 characters. Say only what is established.`}>
              <textarea rows={3} maxLength={300} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="COP31: finance text circulated to delegates." className={`${inputClass} text-[16px]`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desk"><select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value as CategoryId })} className={inputClass}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Kind"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputClass}><option value="update">Update</option><option value="confirmed">Confirmed</option><option value="result">Result</option><option value="data">Data</option></select></Field>
            </div>
            <Field label="Linked story" hint="Readers who tap the update go here.">
              <select value={f.storyId} onChange={(e) => setF({ ...f, storyId: e.target.value })} className={inputClass}>
                <option value="">No story</option>
                {stories.filter((s) => s.published).map((s) => <option key={s.id} value={s.id}>{s.h.slice(0, 70)}</option>)}
              </select>
            </Field>
            {f.kind === 'confirmed' && <Notice>“Confirmed” triggers the “Just confirmed” alert for readers. Use it only for facts checked against a source.</Notice>}
            {message && <Notice kind={message.kind}>{message.text}</Notice>}
            <Btn tone="signal" onClick={post} disabled={f.text.trim().length < 8} className="justify-self-start"><Radio className="size-4" /> File to the wire</Btn>
          </div>
        </Panel>
        {f.text.trim() && (
          <Panel kicker="As readers will see it" title="Preview">
            <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 bg-ink p-4 text-white">
              <span className="pt-0.5 font-mono text-xs tabular-nums text-mirror">{new Date().toTimeString().slice(0, 5)}</span>
              <span>
                <span className={twMerge('text-[12.5px] font-semibold', f.kind === 'confirmed' ? 'text-signal' : 'text-mirror-light')}>{CATEGORIES.find((c) => c.id === f.cat)!.name} · <span className="capitalize">{f.kind}</span></span>
                <span className="mt-0.5 block text-[15px] leading-[1.35]">{f.text}</span>
              </span>
            </div>
          </Panel>
        )}
      </div>

      <Panel kicker="Newest first" title="On the wire" flush>
        {!data ? <div className="shimmer h-[300px] bg-paper-2" /> : data.items.length === 0 ? <Empty title="The wire is empty.">File the first update.</Empty> : (
          <ol>
            <li>
              <BulkBar selection={wireSel} total={data.items.length} noun={['update', 'updates']}>
                <ConfirmBtn label="Remove" question={`Remove ${wireSel.count} from the wire?`} onConfirm={() => api('/admin/wire/bulk', { body: { ids: wireSel.ids, action: 'delete' } }).then(() => { wireSel.clear(); reload(); reloadShared() })} />
              </BulkBar>
            </li>
            {data.items.map((w) => (
              <li key={w.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-t border-rule py-3 pl-1 pr-4 sm:grid-cols-[auto_92px_minmax(0,1fr)_auto] sm:pl-2 sm:pr-5 ${wireSel.has(w.id) ? 'bg-paper' : ''}`}>
                <Check checked={wireSel.has(w.id)} onChange={() => wireSel.toggle(w.id)} label={`Tick: ${w.text}`} className="-mt-2" />
                <span className="hidden font-mono text-[12px] tabular-nums text-muted sm:block">{when(w.at)}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-[12.5px]"><span className="font-semibold capitalize">{w.desk}</span><Pill tone={KIND_TONE[w.kind]} className="capitalize">{w.kind}</Pill><span className="text-muted sm:hidden">{ago(w.at)}</span></span>
                  <span className="mt-1 block text-[14.5px] leading-snug">{w.text}</span>
                </span>
                <button type="button" onClick={() => api(`/admin/wire/${w.id}`, { method: 'DELETE' }).then(() => { reload(); reloadShared() })} aria-label="Remove this update" title="Remove" className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-[#fdecea] hover:text-[#b3261e]"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}

/* ---------- Inbox ---------- */

const STATUS: Record<string, [string, 'signal' | 'warn' | 'good' | 'neutral']> = { open: ['Open', 'signal'], checking: ['Checking', 'warn'], corrected: ['Corrected', 'good'], no_change: ['No change needed', 'neutral'] }

/** Close a report either way. If the reader left an address, they are emailed the outcome and the note. */
function CloseReport({ correction, onDone }: { correction: { id: number; email: string | null }; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = (status: 'corrected' | 'no_change') => {
    setBusy(true)
    api(`/admin/corrections/${correction.id}`, { method: 'PATCH', body: { status, note: note.trim() || undefined } })
      .then(onDone)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setBusy(false))
  }
  return (
    <div className="mt-3 grid gap-2 bg-paper px-3.5 py-3">
      <label className="grid gap-1 text-[13px] font-semibold">
        {correction.email ? 'Note to the reader' : 'Note for the record'}
        <textarea value={note} maxLength={1000} rows={2} onChange={(e) => setNote(e.target.value)} placeholder={correction.email ? 'What you found, in a sentence or two. It is quoted in the email to the reader.' : 'What you found. Kept with the report.'} className={`${inputClass} text-[14px] font-normal`} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" disabled={busy} onClick={() => close('corrected')}>Corrected</Btn>
        <Btn size="sm" tone="line" disabled={busy} onClick={() => close('no_change')}>No change needed</Btn>
        <span className="text-[12.5px] text-muted">{correction.email ? `Either one emails the outcome to ${correction.email}.` : 'The reader left no address, so no email is sent.'}</span>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
    </div>
  )
}

export function InboxView() {
  const { corrections, reload } = useAdmin()
  const enquiries = useLoad<{ enquiries: { id: number; advertiser_id: string; offer_id: string; email: string; created_at: string }[] }>('/admin/enquiries', ['inbox'])
  const [tab, setTab] = useState<'waiting' | 'done' | 'enquiries'>('waiting')
  const waiting = corrections.filter((c) => c.status === 'open' || c.status === 'checking')
  const done = corrections.filter((c) => c.status === 'corrected' || c.status === 'no_change')
  const list = tab === 'waiting' ? waiting : done
  const n = enquiries.data?.enquiries.length ?? 0
  const { user } = useAdmin()
  const admin = user.role === 'admin'
  const reportSel = useSelection(list.map((c) => c.id))
  const enquirySel = useSelection((enquiries.data?.enquiries ?? []).map((e) => e.id))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Segmented label="Inbox" value={tab} onChange={setTab} options={[['waiting', 'Waiting', waiting.length], ['done', 'Handled', done.length], ['enquiries', 'Offer enquiries', n]]} />
      {tab !== 'enquiries' ? (
        <Panel flush>
          {list.length === 0 ? (
            <Empty title={tab === 'waiting' ? 'Nothing is waiting.' : 'Nothing handled yet.'}>{tab === 'waiting' ? 'Corrections readers report from any story appear here.' : 'Reports marked Corrected or No change needed move here.'}</Empty>
          ) : (
            <ul>
              {admin && (
                <li>
                  <BulkBar selection={reportSel} total={list.length} noun={['report', 'reports']} note="Deleting removes the report and the reader’s address for good. The reader is not told.">
                    <ConfirmBtn label="Delete" question={`Delete ${reportSel.count} for good?`} onConfirm={() => api('/admin/corrections/bulk', { body: { ids: reportSel.ids, action: 'delete' } }).then(() => { reportSel.clear(); reload() })} />
                  </BulkBar>
                </li>
              )}
              {list.map((c) => (
                <li key={c.id} className={`flex items-start border-t border-rule ${reportSel.has(c.id) ? 'bg-paper' : ''}`}>
                  {admin && <Check checked={reportSel.has(c.id)} onChange={() => reportSel.toggle(c.id)} label="Tick this report" className="ml-1 mt-2 sm:ml-2" />}
                  <div className={`min-w-0 flex-1 py-4 pr-4 sm:pr-5 ${admin ? '' : 'pl-4 sm:pl-5'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                      <Pill tone={STATUS[c.status][1]}>{STATUS[c.status][0]}</Pill>
                      <span>{when(c.created_at)}</span>
                      {c.email && <a href={`mailto:${c.email}`} className="underline underline-offset-2 hover:text-ink">{c.email}</a>}
                    </span>
                    <select
                      aria-label="Change status"
                      value={c.status}
                      onChange={(e) => api(`/admin/corrections/${c.id}`, { method: 'PATCH', body: { status: e.target.value } }).then(reload)}
                      className="border border-ink/25 bg-white px-2.5 py-1.5 text-[13px] font-semibold"
                    >
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                    </select>
                  </div>
                  {c.story_title && <p className="mt-2 text-[13px] font-semibold text-muted">About: <span className="text-ink">{c.story_title}</span></p>}
                  <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{c.message}</p>
                  {c.note && tab === 'done' && <p className="mt-2 border-l-[3px] border-rule pl-3 text-[13.5px] text-muted"><b className="text-ink">Editor’s note:</b> {c.note}</p>}
                  {tab === 'waiting' && <CloseReport correction={c} onDone={reload} />}
                  {c.handled_by_name && <p className="mt-2 text-[12px] text-muted">Last handled by {c.handled_by_name}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : (
        <Panel flush>
          {n === 0 ? <Empty title="No enquiries yet.">When a reader asks about an advertiser offer it appears here.</Empty> : (
            <ul>
              {admin && (
                <li>
                  <BulkBar selection={enquirySel} total={n} noun={['enquiry', 'enquiries']}>
                    <ConfirmBtn label="Delete" question={`Delete ${enquirySel.count} for good?`} onConfirm={() => api('/admin/enquiries/bulk', { body: { ids: enquirySel.ids, action: 'delete' } }).then(() => { enquirySel.clear(); enquiries.reload() })} />
                  </BulkBar>
                </li>
              )}
              {enquiries.data?.enquiries.map((e) => (
                <li key={e.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule py-3 pr-4 sm:pr-5 ${admin ? 'pl-1 sm:pl-2' : 'pl-4 sm:pl-5'} ${enquirySel.has(e.id) ? 'bg-paper' : ''}`}>
                  {admin && <Check checked={enquirySel.has(e.id)} onChange={() => enquirySel.toggle(e.id)} label="Tick this enquiry" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold capitalize">{e.offer_id.replace(/-/g, ' ')}</span>
                    <span className="block text-[13px] capitalize text-muted">{e.advertiser_id.replace(/-/g, ' ')}</span>
                  </span>
                  <span className="text-right text-[13px]"><a href={`mailto:${e.email}`} className="block font-semibold underline underline-offset-2">{e.email}</a><span className="text-muted">{when(e.created_at)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  )
}

/* ---------- Subscribers ---------- */

export function Subscribers() {
  const { user } = useAdmin()
  const { data, error, reload } = useLoad<{ subscribers: { id: number; email: string; status: string; source: string | null; country: string | null; created_at: string }[] }>('/admin/subscribers', ['subscribers'])
  const mail = useLoad<{ configured: boolean; counts: { never_asked: number } }>('/admin/mail', ['subscribers'])
  const [filter, setFilter] = useState('')
  const [asked, setAsked] = useState('')
  const neverAsked = mail.data?.counts.never_asked ?? 0
  if (error) return <Notice kind="error">{error}</Notice>
  const all = data?.subscribers ?? []
  const week = all.filter((s) => Date.now() - new Date(s.created_at).getTime() < 7 * 86400000).length
  const [show, setShow] = useState<'all' | 'confirmed' | 'pending' | 'unsubscribed' | 'bounced'>('all')
  const list = all.filter((s) => s.email.includes(filter.trim().toLowerCase())).filter((s) => show === 'all' || s.status === show)
  const selection = useSelection(list.map((s) => s.id))
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const bulk = (action: 'delete' | 'unsubscribe' | 'resend') =>
    api<{ changed: number }>('/admin/subscribers/bulk', { body: { ids: selection.ids, action } })
      .then((r) => {
        setNote({ kind: 'ok', text: action === 'resend' ? `Confirmation email sent to ${r.changed}. Only addresses still waiting are emailed, and not twice within three minutes.` : `${r.changed} ${r.changed === 1 ? 'address' : 'addresses'} ${action === 'delete' ? 'deleted' : 'unsubscribed'}.` })
        selection.clear()
        reload()
        mail.reload()
      })
      .catch((e: ApiError) => setNote({ kind: 'error', text: e.message }))
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Sign-ups" value={all.length} note="All time" />
        <Kpi label="This week" value={week} note="Last 7 days" />
        <Kpi label="Confirmed" value={all.filter((s) => s.status === 'confirmed').length} note={`${all.filter((s) => s.status === 'pending').length} pending`} />
      </div>
      <Notice>
        A sign-up is “pending” until the reader answers the confirmation email, and only confirmed addresses receive the morning email. Unanswered sign-ups are deleted after 30 days.
        {mail.data && !mail.data.configured && <> <b>Email is not connected yet</b>, so no confirmation is going out: see <Link to={adminPath('email')} className="font-semibold underline underline-offset-2">Email</Link>.</>}
      </Notice>
      {user.role === 'admin' && mail.data?.configured && neverAsked > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-signal bg-white px-4 py-3">
          <p className="min-w-0 flex-1 text-[14px]"><b>{neverAsked.toLocaleString('en')} {neverAsked === 1 ? 'address' : 'addresses'} signed up before email was connected</b> and {neverAsked === 1 ? 'was' : 'were'} never asked to confirm. {asked}</p>
          <Btn tone="line" size="sm" onClick={() => api<{ sent: number }>('/admin/subscribers/confirm-waiting', { body: {} }).then((r) => { setAsked(`Confirmation sent to ${r.sent}.`); mail.reload(); reload() }).catch((e: ApiError) => setAsked(e.message))}>Send them the confirmation email{neverAsked > 50 ? ' (50 at a time)' : ''}</Btn>
        </div>
      )}
      {note && <Notice kind={note.kind}>{note.text}</Notice>}
      <Segmented label="Status" value={show} onChange={setShow} options={[['all', 'All', all.length], ['confirmed', 'Confirmed', all.filter((s) => s.status === 'confirmed').length], ['pending', 'Waiting', all.filter((s) => s.status === 'pending').length], ['unsubscribed', 'Unsubscribed', all.filter((s) => s.status === 'unsubscribed').length], ['bounced', 'Bounced', all.filter((s) => s.status === 'bounced').length]]} />
      <Panel
        title="Sign-ups"
        flush
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" aria-label="Filter by email" placeholder="Filter by email" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} w-[170px] py-1.5 text-[14px] sm:w-[220px]`} />
            {user.role === 'admin' && <a href="/api/v1/admin/subscribers.csv" className="inline-flex items-center gap-2 rounded-full border border-ink/30 bg-white px-3.5 py-1.5 text-[13px] font-semibold hover:border-ink"><Download className="size-4" /> CSV</a>}
          </div>
        }
      >
        {!data ? <div className="shimmer h-[200px] bg-paper-2" /> : list.length === 0 ? <Empty title="No sign-ups to show.">Readers sign up from the footer and the Subscribe button.</Empty> : (
          <ul>
            {user.role === 'admin' && (
              <li>
                <BulkBar selection={selection} total={list.length} noun={['address', 'addresses']} note="Unsubscribe stops the emails and keeps a record. Delete removes the address completely, for a reader who asks to be forgotten.">
                  <Btn size="sm" tone="line" onClick={() => bulk('resend')}>Resend confirmation</Btn>
                  <Btn size="sm" tone="line" onClick={() => bulk('unsubscribe')}>Unsubscribe</Btn>
                  <ConfirmBtn label="Delete" question={`Delete ${selection.count} for good?`} onConfirm={() => bulk('delete')} />
                </BulkBar>
              </li>
            )}
            {list.map((s) => (
              <li key={s.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule py-2 pr-4 sm:pr-5 ${user.role === 'admin' ? 'pl-1 sm:pl-2' : 'pl-4 sm:pl-5'} ${selection.has(s.id) ? 'bg-paper' : ''}`}>
                {user.role === 'admin' && <Check checked={selection.has(s.id)} onChange={() => selection.toggle(s.id)} label={`Tick ${s.email}`} />}
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{s.email}</span>
                <span className="flex items-center gap-2.5 text-[12.5px] text-muted"><Pill tone={s.status === 'confirmed' ? 'good' : s.status === 'bounced' ? 'signal' : 'neutral'} className="capitalize">{s.status}</Pill>{s.country && <span>{COUNTRIES.find((c) => c.code === s.country)?.name ?? s.country}</span>}{s.source && <span>from {s.source}</span>}<span className="tabular-nums">{when(s.created_at)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

/* ---------- Staff ---------- */

export function Staff() {
  const { user: me } = useAdmin()
  const { data, error, reload } = useLoad<{ users: { id: number; email: string; name: string; role: 'admin' | 'editor'; disabled: boolean; created_at: string }[] }>('/admin/users', ['staff'])
  const [f, setF] = useState({ name: '', email: '', role: 'editor', password: '' })
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [resetting, setResetting] = useState<number | null>(null)
  const [temp, setTemp] = useState('')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel kicker={`${data?.users.length ?? 0} accounts`} title="Who can sign in" flush>
        {error && <Notice kind="error" className="m-4">{error}</Notice>}
        <ul>
          {data?.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 border-t border-rule px-4 py-3.5 sm:px-5">
              <Avatar name={u.name} className={u.disabled ? 'bg-paper-2 text-muted' : ''} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">{u.name}{u.id === me.id && <Pill>You</Pill>}<Pill tone={u.role === 'admin' ? 'ink' : 'neutral'}>{u.role === 'admin' ? 'Administrator' : 'Editor'}</Pill>{u.disabled && <Pill tone="warn">Switched off</Pill>}</span>
                <span className="block truncate text-[13px] text-muted">{u.email} · since {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </span>
              {u.id !== me.id && (
                <span className="flex flex-wrap gap-2">
                  <Btn size="sm" tone="line" onClick={() => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { role: u.role === 'admin' ? 'editor' : 'admin' } }).then(reload)}>{u.role === 'admin' ? 'Make editor' : 'Make admin'}</Btn>
                  <Btn size="sm" tone={u.disabled ? 'line' : 'danger'} onClick={() => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { disabled: !u.disabled } }).then(reload)}>{u.disabled ? 'Switch on' : 'Switch off'}</Btn>
                  <Btn size="sm" tone="line" onClick={() => setResetting(resetting === u.id ? null : u.id)}>New password</Btn>
                  <ConfirmBtn label="Delete" question={`Delete ${u.name}’s account?`} onConfirm={() => api(`/admin/users/${u.id}`, { method: 'DELETE' }).then(reload).catch((e: ApiError) => setMessage({ kind: 'error', text: e.message }))} />
                </span>
              )}
              {resetting === u.id && (
                <form
                  className="flex basis-full flex-wrap items-end gap-2 bg-paper px-3 py-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    api(`/admin/users/${u.id}/password`, { body: { password: temp } })
                      .then(() => { setMessage({ kind: 'ok', text: `${u.name} has a new first password and was signed out everywhere. Give it to them privately; they must replace it at sign-in.` }); setResetting(null); setTemp('') })
                      .catch((e2: ApiError) => setMessage({ kind: 'error', text: e2.message }))
                  }}
                >
                  <Field label={`New first password for ${u.name}`} hint="At least 12 characters. It also unlocks a locked account." className="min-w-[240px] flex-1"><PasswordInput value={temp} onChange={setTemp} autoComplete="new-password" /></Field>
                  <Btn type="submit" disabled={temp.length < 12}>Set password</Btn>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel kicker="They choose their own password at first sign-in" title="Add a member of staff">
        <div className="grid gap-4">
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputClass} /></Field>
          <Field label="Email"><input type="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputClass} /></Field>
          <Field label="Role"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inputClass}><option value="editor">Editor: stories, wire, inbox</option><option value="admin">Administrator: everything</option></select></Field>
          <Field label="First password" hint="At least 12 characters. Give it to them privately; they must replace it."><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" /></Field>
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          <Btn
            className="justify-self-start"
            disabled={!f.name || !f.email || f.password.length < 12}
            onClick={() =>
              api('/admin/users', { body: f })
                .then(() => { setMessage({ kind: 'ok', text: `${f.name} can now sign in.` }); setF({ name: '', email: '', role: 'editor', password: '' }); reload() })
                .catch((e: ApiError) => setMessage({ kind: 'error', text: e.fields?.[0] ? `${e.fields[0].field}: ${e.fields[0].problem}` : e.message }))
            }
          >
            Add to staff
          </Btn>
        </div>
      </Panel>
    </div>
  )
}

/* ---------- Audit ---------- */

const ACTION: Record<string, string> = {
  login: 'Signed in', 'login.failed': 'Failed sign-in', 'password.changed': 'Changed their password',
  'story.created': 'Created a story', 'story.updated': 'Edited a story', 'story.deleted': 'Deleted a story',
  'wire.posted': 'Filed to the wire', 'wire.deleted': 'Removed a wire update', 'correction.updated': 'Updated a correction',
  'subscribers.exported': 'Exported subscribers', 'user.created': 'Added a member of staff', 'user.updated': 'Changed a staff account',
  'user.created.from_env': 'Account created from settings', 'user.reset.from_env': 'Account reset from settings', 'user.promoted.from_env': 'Promoted from settings',
  'user.created.from_cli': 'Account created from the command line', 'user.reset.from_cli': 'Account reset from the command line',
}

export function Audit() {
  const { data, error } = useLoad<{ entries: { id: number; at: string; action: string; target: string | null; detail: any; user_name: string | null }[] }>('/admin/audit', ['audit', 'staff', 'inbox', 'subscribers', 'mail', 'engine', 'content', 'wire.changed'])
  const [filter, setFilter] = useState<'all' | 'content' | 'access'>('all')
  if (error) return <Notice kind="error">{error}</Notice>
  const access = (a: string) => /^(login|password|user)/.test(a)
  const list = (data?.entries ?? []).filter((e) => filter === 'all' || (filter === 'access') === access(e.action))
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Segmented label="Show" value={filter} onChange={setFilter} options={[['all', 'Everything'], ['content', 'Content'], ['access', 'Sign-in and staff']]} />
      <Panel kicker="Most recent 200" title="What happened" flush>
        {!data ? <div className="shimmer h-[260px] bg-paper-2" /> : list.length === 0 ? <Empty title="Nothing recorded yet." /> : (
          <ol>
            {list.map((e) => (
              <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 border-t border-rule px-4 py-3 first:border-t-0 sm:px-5">
                <span className="min-w-0">
                  <span className="block text-[14.5px]"><b className="font-semibold">{e.user_name ?? 'System'}</b> · {ACTION[e.action] ?? e.action}{e.action === 'login.failed' && <Pill tone="warn" className="ml-2">Check</Pill>}</span>
                  <span className="block truncate text-[13px] text-muted">{e.detail?.headline ?? e.detail?.text ?? e.detail?.email ?? e.target ?? ''}</span>
                </span>
                <span className="whitespace-nowrap text-right text-[12px] tabular-nums text-muted">{when(e.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}

/* ---------- Your account ---------- */

export function Account({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAdmin()
  const [pw, setPw] = useState({ current: '', next: '' })
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-2">
      <Panel kicker="Signed in as" title={user.name}>
        <div className="flex items-center gap-4">
          <Avatar name={user.name} className="size-14 text-[18px]" />
          <div className="min-w-0">
            <p className="truncate text-[15px]">{user.email}</p>
            <p className="mt-1"><Pill tone={user.role === 'admin' ? 'ink' : 'neutral'}>{user.role === 'admin' ? 'Administrator' : 'Editor'}</Pill></p>
          </div>
        </div>
        <p className="mt-4 border-t border-rule pt-3 text-[13.5px] text-muted">{user.role === 'admin' ? 'You can manage stories, the wire, the inbox, subscribers, staff and the audit log.' : 'You can manage stories, the wire and the inbox. Ask an administrator for anything else.'}</p>
        <Btn tone="line" onClick={onSignOut} className="mt-4">Sign out</Btn>
      </Panel>
      <Panel kicker="Signs you out everywhere else" title="Change your password">
        <div className="grid gap-4">
          <Field label="Current password"><PasswordInput value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 12 characters."><PasswordInput value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} autoComplete="new-password" /></Field>
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          <Btn
            className="justify-self-start"
            disabled={!pw.current || pw.next.length < 12}
            onClick={() => api('/auth/password', { body: pw }).then(() => { setMessage({ kind: 'ok', text: 'Password changed.' }); setPw({ current: '', next: '' }) }).catch((e: ApiError) => setMessage({ kind: 'error', text: e.message }))}
          >
            Change password
          </Btn>
        </div>
      </Panel>
    </div>
  )
}
