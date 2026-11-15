import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMoney } from '@/lib/money'
import { useSearchTracking } from '@/lib/track'
import { CalendarDays, Clock, Image as ImageIcon, Mic, Play, Search, SlidersHorizontal, TrendingUp, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AdTag } from '@/components/ads/AdSlot'
import { MonoDate, Pill } from '@/components/ui'
import { CATEGORIES, categoryName, sectionPath, storyDate, storyPath } from '@/data'
import { storyMedia } from '@/data/media'
import { offerPath } from '@/data/offers'
import { TREND_TOPICS, formatSeconds } from '@/data/trends'
import { DEFAULT_FILTERS, SearchFilters, SearchType, runSearch, searchPath, termsOf } from '@/lib/search'
import { useStoredValue } from '@/lib/store'
import { WIRE_KIND_LABEL, useWire } from '@/live/feed'
import { LiveResults, useLiveSearch } from '@/live/search'

const TYPE_LABEL: Record<SearchType, string> = { all: 'All', stories: 'Stories', videos: 'Videos', photos: 'Photos', topics: 'Topics', dates: 'Dates', offers: 'Offers' }
const TYPE_ORDER: SearchType[] = ['all', 'stories', 'videos', 'photos', 'topics', 'dates', 'offers']

/** Wraps the parts of `text` that match the query in <mark>. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!clean.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${clean.join('|')})`, 'ig'))
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i} className="bg-dew/55 text-inherit">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </>
  )
}

type Props = {
  query: string
  onQuery: (q: string) => void
  filters: SearchFilters
  onFilters: (f: SearchFilters) => void
  /** Called when a result is opened, e.g. to close the dialog. */
  onOpenResult?: () => void
  /** The dialog shows a shorter list and a link to the full results page. */
  variant?: 'dialog' | 'page'
  onClose?: () => void
}

/**
 * The search experience, shared by the search dialog and the /search page: the box (typed or
 * spoken), result-type tabs with live counts, filters, and results that update on every keystroke.
 * Arrow keys move through results; Enter opens one.
 */
export function SearchPanel({ query, onQuery, filters, onFilters, onOpenResult, variant = 'page', onClose }: Props) {
  const money = useMoney()
  const input = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  // Filters start open on the results page, except on phones where they would push results off screen.
  const [showFilters, setShowFilters] = useState(() => variant === 'page' && window.innerWidth >= 640)
  const [recentRaw, setRecentRaw] = useStoredValue('ma-searches', '[]')
  const recent: string[] = JSON.parse(recentRaw)
  const dialog = variant === 'dialog'

  const terms = useMemo(() => termsOf(query), [query])
  const results = useMemo(() => runSearch(query, filters), [query, filters])
  // The same words, searched on the server too: stories as they stand this second, two weeks
  // of the wire, and what outside sources show is trending.
  const live = useLiveSearch(query)
  const have = new Set(results.stories.map((x) => x.story.id))
  const fresh = (live.results?.stories ?? []).filter((x) => !have.has(x.id))
  const liveCount = fresh.length + (live.results?.wire.length ?? 0) + (live.results?.web.length ?? 0)
  useSearchTracking(query, results.counts.all + liveCount)
  const set = (patch: Partial<SearchFilters>) => onFilters({ ...filters, ...patch })
  const filtersOn = filters.desk !== 'all' || !!filters.from || !!filters.to || filters.sort !== 'relevance' || filters.openOnly

  useEffect(() => {
    input.current?.focus()
  }, [])

  const remember = () => {
    const q = query.trim()
    if (q.length < 2) return
    setRecentRaw(JSON.stringify([q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6)))
  }
  const opened = () => {
    remember()
    onOpenResult?.()
  }

  // Arrow keys walk the results; Enter in the box opens the first one.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const links = [...(root.current?.querySelectorAll<HTMLElement>('[data-result]') ?? [])]
    if (!links.length) return
    const at = links.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      links[Math.min(at + 1, links.length - 1)].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (at <= 0) input.current?.focus()
      else links[at - 1].focus()
    } else if (e.key === 'Enter' && document.activeElement === input.current && query.trim()) {
      e.preventDefault()
      links[0].click()
    }
  }

  const show = (t: SearchType) => filters.type === 'all' || filters.type === t
  const cap = (n: number) => (dialog && filters.type === 'all' ? n : 999)
  const none = query.trim() !== '' && results.counts.all === 0 && results.photos.length === 0 && liveCount === 0 && !live.loading

  return (
    <div ref={root} onKeyDown={onKeyDown}>
      {/* The box */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          remember()
        }}
        className="flex items-center gap-2 border-b-2 border-ink pb-2.5 sm:gap-3"
      >
        <Search className="size-6 flex-none" strokeWidth={2.4} />
        <input
          ref={input}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search stories, videos, places, dates"
          aria-label="Search MirrorActu"
          aria-describedby="search-count"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-1 text-[20px] font-semibold tracking-[-0.02em] outline-none placeholder:font-normal placeholder:text-[#9aa0b0] sm:text-[28px]"
        />
        {query && (
          <IconButton label="Clear search" onClick={() => { onQuery(''); input.current?.focus() }}><X className="size-5" /></IconButton>
        )}
        <VoiceButton onText={onQuery} />
        <IconButton label={showFilters ? 'Hide filters' : 'Show filters'} pressed={showFilters} onClick={() => setShowFilters(!showFilters)} badge={filtersOn}>
          <SlidersHorizontal className="size-5" />
        </IconButton>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-1 hidden rounded-full border border-ink px-3.5 py-1.5 text-sm font-semibold hover:bg-ink hover:text-white sm:block">
            Close <kbd className="ml-1 font-mono text-[11px] opacity-70">esc</kbd>
          </button>
        )}
        {onClose && <IconButton label="Close search" onClick={onClose} className="sm:hidden"><X className="size-6" /></IconButton>}
      </form>

      {/* Result types, with live counts */}
      <div role="tablist" aria-label="Result type" className="no-scrollbar -mx-[18px] mt-3 flex gap-1.5 overflow-x-auto px-[18px] sm:mx-0 sm:px-0">
        {TYPE_ORDER.map((t) => {
          const n = t === 'photos' ? results.photos.length : results.counts[t]
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={filters.type === t}
              disabled={n === 0 && filters.type !== t}
              onClick={() => set({ type: t })}
              className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-rule px-3 py-1.5 text-[14px] font-semibold transition-colors duration-150 hover:border-ink disabled:opacity-40 disabled:hover:border-rule aria-selected:border-ink aria-selected:bg-ink aria-selected:text-white"
            >
              {TYPE_LABEL[t]}
              <span className="text-[12px] font-normal tabular-nums opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      {showFilters && (
        <fieldset className="mt-3 grid gap-x-5 gap-y-3 border-y border-rule bg-paper/50 px-3.5 py-3.5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <legend className="sr-only">Filters</legend>
          <label className="block text-[12.5px] font-semibold text-muted">
            Desk
            <select value={filters.desk} onChange={(e) => set({ desk: e.target.value as SearchFilters['desk'] })} className="mt-1 block w-full border border-ink/30 bg-white px-2.5 py-2 text-[15px] font-normal text-ink">
              <option value="all">All desks</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[12.5px] font-semibold text-muted">
              From
              <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} className="mt-1 block w-full border border-ink/30 bg-white px-2 py-[7px] text-[14px] font-normal text-ink" />
            </label>
            <label className="block text-[12.5px] font-semibold text-muted">
              To
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} className="mt-1 block w-full border border-ink/30 bg-white px-2 py-[7px] text-[14px] font-normal text-ink" />
            </label>
          </div>
          <label className="block text-[12.5px] font-semibold text-muted">
            Order
            <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as SearchFilters['sort'] })} className="mt-1 block w-full border border-ink/30 bg-white px-2.5 py-2 text-[15px] font-normal text-ink">
              <option value="relevance">Best match</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[14px]">
              <input type="checkbox" checked={filters.openOnly} onChange={(e) => set({ openOnly: e.target.checked })} className="size-4 accent-[#ff5a36]" />
              Still-open questions only
            </label>
            {filtersOn && (
              <button type="button" onClick={() => onFilters({ ...DEFAULT_FILTERS, type: filters.type })} className="self-start text-[13.5px] font-semibold underline decoration-signal decoration-2 underline-offset-4">
                Clear filters
              </button>
            )}
          </div>
        </fieldset>
      )}

      <p id="search-count" aria-live="polite" className="mt-3 text-[13px] text-muted">
        {query.trim()
          ? none
            ? `Nothing matches “${query.trim()}”.`
            : `${results.counts.all} ${results.counts.all === 1 ? 'result' : 'results'} for “${query.trim()}”, updating as you type.`
          : 'Type to search. Use ↑ ↓ to move through results and Enter to open one.'}
      </p>

      {/* Nothing typed yet: recent and trending searches */}
      {!query.trim() && (
        <div className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {recent.length > 0 && (
            <section aria-label="Recent searches">
              <h3 className="mb-2 flex items-center justify-between text-[13px] font-semibold tracking-normal text-muted">
                <span className="flex items-center gap-2"><Clock className="size-4" /> Your recent searches</span>
                <button type="button" onClick={() => setRecentRaw('[]')} className="font-normal underline underline-offset-2 hover:text-ink">Clear</button>
              </h3>
              <div className="flex flex-wrap gap-2">{recent.map((r) => <Pill key={r} onClick={() => onQuery(r)}>{r}</Pill>)}</div>
            </section>
          )}
          <section aria-label="Trending searches">
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold tracking-normal text-muted"><TrendingUp className="size-4" /> Trending today</h3>
            <div className="flex flex-wrap gap-2">{TREND_TOPICS.slice(0, 8).map((t) => <Pill key={t.id} onClick={() => onQuery(t.query)}>{t.label}</Pill>)}</div>
          </section>
          <section aria-label="Browse desks" className={recent.length ? 'sm:col-span-2' : ''}>
            <h3 className="mb-2 text-[13px] font-semibold tracking-normal text-muted">Browse a desk</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Link key={c.id} to={sectionPath(c.id)} onClick={onOpenResult} className="rounded-full border border-rule px-3.5 py-1.5 text-sm transition-colors duration-150 hover:border-ink">{c.name}</Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {none && (
        <div className="mt-4 border-l-[3px] border-signal bg-paper p-4 text-[15px]">
          <p className="font-semibold">Try a place, a name or a shorter word.</p>
          <p className="mt-1 text-muted">
            {filtersOn ? 'Your filters may be hiding results. ' : ''}
            {filtersOn && <button type="button" onClick={() => onFilters(DEFAULT_FILTERS)} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-4">Clear filters</button>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">{TREND_TOPICS.slice(0, 5).map((t) => <Pill key={t.id} onClick={() => onQuery(t.query)}>{t.label}</Pill>)}</div>
        </div>
      )}

      {/* Results */}
      <div className="mt-2">
        {show('topics') && query.trim() && (results.desks.length > 0 || results.topics.length > 0) && (
          <Group title="Topics and desks">
            <div className="flex flex-wrap gap-2 py-3">
              {results.desks.map((c) => (
                <Link key={c.id} data-result to={sectionPath(c.id)} onClick={opened} className="rounded-full border border-ink bg-ink px-3.5 py-1.5 text-sm font-semibold text-white">{c.name} desk</Link>
              ))}
              {results.topics.map((t) => (
                <Link key={t.id} data-result to={`/trends#trend-${t.id}`} onClick={opened} className="flex items-center gap-1.5 rounded-full border border-ink px-3.5 py-1.5 text-sm font-semibold hover:bg-ink hover:text-white">
                  <TrendingUp className="size-3.5" /> {t.label}
                </Link>
              ))}
            </div>
          </Group>
        )}

        {show('stories') && results.stories.length > 0 && (
          <Group title="Stories" count={results.stories.length}>
            {results.stories.slice(0, cap(5)).map(({ story: s, snippet }) => {
              const m = storyMedia(s.id)
              return (
                <Link key={s.id} data-result to={storyPath(s.id)} onClick={opened} className="group grid grid-cols-[minmax(0,1fr)_84px] items-start gap-x-4 border-b border-rule py-3.5 outline-none focus-visible:bg-paper sm:grid-cols-[minmax(0,1fr)_128px]">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2.5 text-[12.5px] font-semibold">
                      {categoryName(s.cats[0])}
                      <MonoDate className="font-normal text-muted">{storyDate(s)}</MonoDate>
                      {s.un.length > 0 && <span className="font-normal text-muted">{s.un.length} still open</span>}
                    </span>
                    <strong className="mt-0.5 block text-[18px] font-semibold leading-tight tracking-[-0.015em] decoration-signal decoration-2 underline-offset-4 group-hover:underline sm:text-[19px]">
                      <Highlight text={s.h} terms={terms} />
                    </strong>
                    <span className="mt-1 block text-[14.5px] leading-snug text-muted"><Highlight text={snippet} terms={terms} /></span>
                  </span>
                  {m && <img src={m.src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />}
                </Link>
              )
            })}
          </Group>
        )}

        {show('videos') && results.videos.length > 0 && (
          <Group title="Videos" count={results.videos.length}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 py-3.5 sm:grid-cols-3">
              {results.videos.slice(0, cap(3)).map((v) => (
                <Link key={v.id} data-result to={`/trends?v=${v.id}#video`} onClick={opened} className="group block">
                  <span className="relative block aspect-video overflow-hidden bg-ink">
                    <img src={v.poster} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-9 items-center justify-center rounded-full bg-signal text-ink"><Play className="ml-0.5 size-4" fill="currentColor" /></span></span>
                    <span className="absolute bottom-1 right-1 bg-ink/85 px-1 font-mono text-[10.5px] tabular-nums text-white">{formatSeconds(v.seconds)}</span>
                  </span>
                  <span className="mt-2 block text-[14.5px] font-semibold leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline"><Highlight text={v.title} terms={terms} /></span>
                </Link>
              ))}
            </div>
          </Group>
        )}

        {show('photos') && filters.type === 'photos' && results.photos.length > 0 && (
          <Group title="Photos" count={results.photos.length} icon={<ImageIcon className="size-4" />}>
            <div className="grid grid-cols-2 gap-2 py-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {results.photos.map((s) => {
                const m = storyMedia(s.id)!
                return (
                  <Link key={s.id} data-result to={storyPath(s.id)} onClick={opened} className="group relative block overflow-hidden bg-ink">
                    <img src={m.src} alt={m.alt} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-2 pt-6 text-[12.5px] font-semibold leading-tight text-white">{s.h}</span>
                  </Link>
                )
              })}
            </div>
            <p className="pb-2 text-[12px] text-muted">File photos. Credits are listed under Picture credits.</p>
          </Group>
        )}

        {show('all') && query.trim() && (live.results ? <LiveMatches live={live.results} fresh={fresh} terms={terms} onOpen={opened} /> : <WireMatches terms={terms} onOpen={opened} />)}

        {show('dates') && results.dates.length > 0 && (query.trim() || filters.type === 'dates') && (
          <Group title="Coming up" count={results.dates.length} icon={<CalendarDays className="size-4" />}>
            {results.dates.slice(0, cap(3)).map(([, label, title, , id]) => (
              <Link key={title} data-result to={storyPath(id)} onClick={opened} className="group grid grid-cols-[76px_minmax(0,1fr)] items-baseline gap-3 border-b border-rule py-2.5 text-[15px] outline-none focus-visible:bg-paper">
                <MonoDate className="font-medium text-ink">{label}</MonoDate>
                <span className="decoration-signal decoration-2 underline-offset-4 group-hover:underline"><Highlight text={title} terms={terms} /></span>
              </Link>
            ))}
          </Group>
        )}

        {show('offers') && results.offers.length > 0 && (
          <Group title="Offers from advertisers" count={results.offers.length} icon={<AdTag className="text-[9px]">Ad</AdTag>}>
            {results.offers.slice(0, cap(2)).map(({ advertiser, offer }) => (
              <Link key={offer.id} data-result to={offerPath(advertiser, offer)} onClick={opened} className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-rule py-2.5 outline-none focus-visible:bg-paper">
                <span className="min-w-0">
                  <span className="block text-[15.5px] font-semibold decoration-signal decoration-2 underline-offset-4 group-hover:underline"><Highlight text={offer.title} terms={terms} /></span>
                  <span className="block text-[13px] text-muted">Paid for by {advertiser.name}</span>
                </span>
                <span className="whitespace-nowrap text-[15px] font-bold tabular-nums" translate="no">{money.price(offer.price)}</span>
              </Link>
            ))}
          </Group>
        )}
      </div>

      {dialog && query.trim() && !none && (
        <Link to={searchPath(query, filters)} onClick={opened} className={twMerge('mt-5 inline-flex items-center gap-2 rounded-full border border-signal bg-signal px-5 py-2.5 text-[15px] font-semibold text-ink transition-colors hover:bg-signal-hover')}>
          See all {results.counts.all} results
        </Link>
      )}
    </div>
  )
}

function Group({ title, count, icon, children }: { title: string; count?: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mt-4">
      <h3 className="flex items-center gap-2 border-b-2 border-ink pb-1.5 text-[13px] font-semibold tracking-normal">
        {icon}
        {title}
        {count !== undefined && <span className="font-normal tabular-nums text-muted">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

/** Live wire updates that match the search, newest first: the "happening right now" results. */
const pulse = <span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-signal opacity-60 motion-safe:animate-ping" /><span className="relative size-2 rounded-full bg-signal" /></span>

/** What the server found in live data: stories newer than this page, the wire, and outside trends. */
function LiveMatches({ live, fresh, terms, onOpen }: { live: LiveResults; fresh: LiveResults['stories']; terms: string[]; onOpen: () => void }) {
  return (
    <>
      {fresh.length > 0 && (
        <Group title="Just published" count={fresh.length} icon={pulse}>
          {fresh.map((x) => (
            <Link key={x.id} data-result to={`/story/${x.slug}`} onClick={onOpen} className="group block border-b border-rule py-2.5 outline-none focus-visible:bg-paper">
              <span className="text-[12.5px] font-semibold capitalize text-muted">{x.cat ?? 'News'} · <span className="tabular-nums">{x.d}</span></span>
              <span className="block text-[16px] font-semibold leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline"><Highlight text={x.h} terms={terms} /></span>
              <span className="line-clamp-1 text-[13.5px] text-muted">{x.st}</span>
            </Link>
          ))}
        </Group>
      )}
      {live.wire.length > 0 && (
        <Group title="On the wire" count={live.wire.length} icon={pulse}>
          {live.wire.map((w) => (
            <Link key={w.id} data-result to={w.storyId ? storyPath(w.storyId) : '/live'} onClick={onOpen} className="group grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-rule py-2.5 outline-none focus-visible:bg-paper">
              <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">{new Date(w.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}<br />{new Date(w.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>
                <span className={twMerge('text-[12.5px] font-semibold', w.kind === 'confirmed' ? 'text-signal' : 'text-muted')}>{w.desk} · {WIRE_KIND_LABEL[w.kind as keyof typeof WIRE_KIND_LABEL] ?? w.kind}</span>
                <span className="block text-[15px] leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline"><Highlight text={w.text} terms={terms} /></span>
              </span>
            </Link>
          ))}
        </Group>
      )}
      {live.web.length > 0 && (
        <Group title="Trending on the web" count={live.web.length} icon={<TrendingUp className="size-4" />}>
          <p className="pb-1 text-[12.5px] text-muted"><b className="text-ink">Not MirrorActu reporting.</b> From outside sources, unchecked. Each link opens another site.</p>
          {live.web.map((x, i) => (
            <div key={x.url + i} className="border-b border-rule py-2.5">
              <a data-result href={x.url} target="_blank" rel="noopener noreferrer nofollow" data-track={`webtrend:${x.source}`} className="text-[15.5px] font-semibold leading-snug decoration-signal decoration-2 underline-offset-4 outline-none hover:underline focus-visible:underline" translate="no"><Highlight text={x.title} terms={terms} /></a>
              <p className="text-[12.5px] text-muted">{x.credit.name} · {x.note}{x.places.length > 1 ? ` · in ${x.places.slice(0, 3).join(', ')}${x.places.length > 3 ? ` and ${x.places.length - 3} more` : ''}` : ''}</p>
              {x.headline && <p className="truncate text-[12.5px] text-muted"><a href={x.headline.url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-rule underline-offset-2 hover:text-ink" translate="no"><Highlight text={x.headline.title} terms={terms} /></a>{x.headline.publisher && ` · ${x.headline.publisher}`}</p>}
            </div>
          ))}
        </Group>
      )}
    </>
  )
}

function WireMatches({ terms, onOpen }: { terms: string[]; onOpen: () => void }) {
  const { items } = useWire({ max: 40 })
  const hits = items.filter((w) => terms.every((t) => `${w.text} ${w.desk}`.toLowerCase().includes(t))).slice(0, 3)
  if (!hits.length) return null
  return (
    <Group
      title="On the wire now"
      count={hits.length}
      icon={<span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-signal opacity-60 motion-safe:animate-ping" /><span className="relative size-2 rounded-full bg-signal" /></span>}
    >
      {hits.map((w) => (
        <Link key={w.id} data-result to={w.storyId ? storyPath(w.storyId) : '/live'} onClick={onOpen} className="group grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-rule py-2.5 outline-none focus-visible:bg-paper">
          <span className="pt-0.5 font-mono text-xs tabular-nums text-muted">{w.time}</span>
          <span>
            <span className={twMerge('text-[12.5px] font-semibold', w.kind === 'confirmed' ? 'text-signal' : 'text-muted')}>{w.desk} · {WIRE_KIND_LABEL[w.kind]}</span>
            <span className="block text-[15px] leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline"><Highlight text={w.text} terms={terms} /></span>
          </span>
        </Link>
      ))}
    </Group>
  )
}

function IconButton({ label, pressed, badge, className, children, ...rest }: { label: string; pressed?: boolean; badge?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={twMerge('relative flex size-10 flex-none items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-paper hover:text-ink aria-pressed:bg-ink aria-pressed:text-white', className)}
      {...rest}
    >
      {children}
      {badge && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-signal ring-2 ring-white" />}
    </button>
  )
}

/** Search by voice, where the browser supports it (Chrome, Edge, Safari). Hidden elsewhere. */
function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  const rec = useRef<any>(null)
  const Recognition = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null
  useEffect(() => () => rec.current?.abort?.(), [])
  if (!Recognition) return null

  const toggle = () => {
    if (listening) return rec.current?.stop()
    const r = new Recognition()
    rec.current = r
    r.lang = 'en-GB'
    r.interimResults = true
    r.onresult = (e: any) => onText([...e.results].map((x: any) => x[0].transcript).join(' '))
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    setListening(true)
    r.start()
  }

  return (
    <IconButton label={listening ? 'Stop listening' : 'Search by voice'} pressed={listening} onClick={toggle}>
      <Mic className={twMerge('size-5', listening && 'motion-safe:animate-pulse')} />
    </IconButton>
  )
}
