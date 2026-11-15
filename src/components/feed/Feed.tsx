import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { AdSlot } from '@/components/ads/AdSlot'
import { ButtonLink } from '@/components/ui'
import { BRIEF_IDS, CATEGORIES, STORIES, Story, newestFirst, storyPath } from '@/data'
import { nearScore } from '@/data/countries'
import { WIRE_KIND_LABEL, useWire } from '@/live/feed'
import { useEdition } from '@/lib/edition'
import { useFollowedSections, useHiddenStories, useLikedStories, useReadStories, useStoredValue } from '@/lib/store'
import { FeedCard, FeedCardSkeleton } from './FeedCard'

type Tab = 'for-you' | 'following' | 'latest'
const TABS: [Tab, string][] = [
  ['for-you', 'For you'],
  ['following', 'Following'],
  ['latest', 'Latest'],
]

const PAGE = 6
/** Stand-in for the fetch of the next page. */
const PAGE_LOAD_MS = 550
const AD_EVERY = 5

/**
 * "For you" puts unread stories from the desks you follow first, then stories about your
 * country and region, then the editors' picks, newest first within each group.
 */
function rank(stories: Story[], follows: string[], read: string[], likedDesks: string[], country: string) {
  const score = (s: Story) =>
    (s.cats.some((c) => follows.includes(c)) ? 4 : 0) +
    (read.includes(s.id) ? 0 : 2) +
    (s.cats.some((c) => likedDesks.includes(c)) ? 1.5 : 0) +
    nearScore(s, country) +
    (BRIEF_IDS.includes(s.id) ? 1 : 0)
  return [...stories].sort((a, b) => score(b) - score(a) || b.d.localeCompare(a.d))
}

/** The personal feed: tabs, a "new updates" prompt fed by the wire, and endless scrolling. */
export function Feed() {
  const [tab, setTab] = useStoredValue('ma-feed-tab', 'for-you') as [Tab, (t: Tab) => void]
  const [follows, toggleFollow] = useFollowedSections()
  const [read] = useReadStories()
  const [liked] = useLikedStories()
  const [hidden] = useHiddenStories()
  const [country] = useEdition()
  const [shown, setShown] = useState(PAGE)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  // Rank once per tab/follow change, not on every read, so cards do not jump while reading.
  const readAtRank = useRef(read)
  const list = useMemo(() => {
    readAtRank.current = read
    const visible = STORIES.filter((s) => !hidden.includes(s.id))
    if (tab === 'latest') return newestFirst(visible)
    if (tab === 'following') return newestFirst(visible.filter((s) => s.cats.some((c) => follows.includes(c))))
    // Liking a story nudges its desk up the feed.
    const likedDesks = STORIES.filter((s) => liked.includes(s.id)).map((s) => s.cats[0])
    return rank(visible, follows, readAtRank.current, likedDesks, country.code)
  }, [tab, follows.join(), hidden.join(), country.code])

  useEffect(() => setShown(PAGE), [tab])

  // Endless scroll: when the sentinel nears the viewport, load the next page.
  const more = shown < list.length
  useEffect(() => {
    const el = sentinel.current
    if (!el || !more || loading || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLoading(true), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, loading, shown])

  useEffect(() => {
    if (!loading) return
    const t = window.setTimeout(() => {
      setShown((n) => n + PAGE)
      setLoading(false)
    }, PAGE_LOAD_MS)
    return () => window.clearTimeout(t)
  }, [loading])

  const unread = list.filter((s) => !read.includes(s.id)).length

  return (
    <section aria-label="Your feed" className="min-w-0">
      <div role="tablist" aria-label="Feed" className="sticky top-[96px] z-[6] -mx-[18px] grid grid-cols-3 px-[18px] sm:mx-0 sm:px-0 border-b border-rule bg-white/95 backdrop-blur lg:top-[68px]">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="relative py-3.5 text-[15.5px] font-semibold text-muted transition-colors duration-150 hover:bg-paper/60 hover:text-ink aria-selected:text-ink"
          >
            {label}
            {id === 'following' && follows.length > 0 && <span className="ml-1.5 text-[13px] font-normal tabular-nums">{follows.length}</span>}
            {tab === id && <motion.span layoutId="feed-tab" className="absolute inset-x-[22%] bottom-0 h-[3px] rounded-full bg-signal" />}
          </button>
        ))}
      </div>

      <NewUpdates />

      {tab === 'following' && follows.length === 0 ? (
        <div className="border-b border-rule py-10">
          <h3 className="text-[26px]">Follow a desk to build this feed</h3>
          <p className="mt-2 max-w-[52ch] text-muted">Pick the subjects you care about. Their stories gather here, and they lead For you as well.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleFollow(c.id)}
                className="rounded-full border border-ink px-4 py-2 text-[15px] font-semibold transition-colors duration-150 hover:bg-ink hover:text-white"
              >
                + {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="border-b border-rule py-3 text-[13.5px] text-muted" aria-live="polite">
            {tab === 'for-you' && (follows.length ? 'Unread stories from the desks you follow come first' : 'Editors’ picks come first')}
            {tab === 'for-you' && (country.code === 'INT' ? '.' : `, then ${country.name} and your region.`)}
            {tab === 'following' && `${list.length} stories from the ${follows.length} ${follows.length > 1 ? 'desks' : 'desk'} you follow.`}
            {tab === 'latest' && 'Every story, newest first.'}{' '}
            <b className="font-semibold text-ink">{unread} unread.</b>
          </p>
          {list.slice(0, shown).map((s, i) => (
            <React.Fragment key={s.id}>
              <FeedCard story={s} />
              {(i + 1) % AD_EVERY === 0 && i + 1 < list.length && (
                <div className="border-b border-rule py-5">
                  <AdSlot format="infeed" slot={Math.floor(i / AD_EVERY)} placement="your feed on the front page, between stories" />
                </div>
              )}
            </React.Fragment>
          ))}
          {more ? (
            <div ref={sentinel} role="status" aria-label="Loading more stories">
              <FeedCardSkeleton />
              <FeedCardSkeleton />
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="font-serif text-[30px] leading-tight">You are all caught up.</p>
              <p className="mx-auto mt-2 max-w-[44ch] text-muted">That is every story in this feed. The wire keeps moving, and The Brief takes two minutes.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <ButtonLink to="/live" size="sm">Watch the wire</ButtonLink>
                <ButtonLink to="/brief" size="sm" variant="line">Read The Brief</ButtonLink>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Wire updates that arrived since the page opened wait behind a "Show new updates" button,
 * so the feed never moves under the reader. Pressing it drops them in at the top.
 */
function NewUpdates() {
  const { items, status } = useWire({ max: 40 })
  const baseline = useRef<number | null>(null)
  const [revealedTo, setRevealedTo] = useState<number | null>(null)

  if (status === 'live' && baseline.current === null && items[0]) baseline.current = items[0].id
  const base = baseline.current
  if (base === null) return null

  const fresh = items.filter((w) => w.id > base)
  const waiting = fresh.filter((w) => w.id > (revealedTo ?? base))
  const revealed = fresh.filter((w) => w.id <= (revealedTo ?? base)).slice(0, 5)

  return (
    <>
      <AnimatePresence>
        {waiting.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-rule"
          >
            <button
              type="button"
              onClick={() => setRevealedTo(waiting[0].id)}
              className="flex w-full items-center justify-center gap-2.5 py-3 text-[14.5px] font-semibold text-signal transition-colors duration-150 hover:bg-paper/60"
            >
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-signal opacity-60 motion-safe:animate-ping" />
                <span className="relative size-2 rounded-full bg-signal" />
              </span>
              Show {waiting.length} new {waiting.length > 1 ? 'updates' : 'update'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {revealed.length > 0 && (
        <ol aria-label="New on the wire" className="border-b border-rule bg-paper/50">
          {revealed.map((w) => (
            <motion.li key={w.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="border-b border-rule last:border-b-0">
              <Link to={w.storyId ? storyPath(w.storyId) : '/live'} className="group grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 py-3">
                <span className="pt-0.5 text-center font-mono text-xs tabular-nums text-muted">{w.time}</span>
                <span>
                  <span className={`text-[12.5px] font-semibold ${w.kind === 'confirmed' ? 'text-signal' : 'text-muted'}`}>{w.desk} · {WIRE_KIND_LABEL[w.kind]}</span>
                  <span className="block text-[15px] leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline">{w.text}</span>
                </span>
              </Link>
            </motion.li>
          ))}
        </ol>
      )}
    </>
  )
}
