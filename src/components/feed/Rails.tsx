import React from 'react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AdSlot } from '@/components/ads/AdSlot'
import { useToast } from '@/components/overlays/Toast'
import { Hl, MonoDate, TextLink } from '@/components/ui'
import { AGENDA, BRIEF_IDS, CATEGORIES, SEARCH_TOPICS, searchStories, sectionPath, storiesIn, storyPath } from '@/data'
import { useSiteActions } from '@/lib/actions'
import { useFollowedSections, useReadStories, useSavedStories } from '@/lib/store'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function RailBlock({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={twMerge('border-t-2 border-ink pt-3', className)}>
      <h2 className="mb-2 text-base tracking-normal">{title}</h2>
      {children}
    </section>
  )
}

/** Follow / unfollow a desk. Used in both rails and the welcome modal. */
export function FollowButton({ id, name, small = false }: { id: string; name: string; small?: boolean }) {
  const [follows, toggle] = useFollowedSections()
  const toast = useToast()
  const on = follows.includes(id)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Following ${name}. Stop following` : `Follow ${name}`}
      onClick={() => {
        toggle(id)
        toast(on ? `Stopped following ${name}` : `Following ${name}. It now leads your feed.`)
      }}
      className={twMerge(
        'flex-none rounded-full border border-ink font-semibold transition-colors duration-150 hover:bg-ink hover:text-white aria-pressed:bg-ink aria-pressed:text-white',
        small ? 'px-2.5 py-0.5 text-[12.5px]' : 'px-3.5 py-1 text-[13.5px]'
      )}
    >
      {on ? 'Following' : 'Follow'}
    </button>
  )
}

/** Left rail: the reader's own corner. What they follow, saved and read, and their Brief progress. */
export function YourRail() {
  const [follows] = useFollowedSections()
  const [saved] = useSavedStories()
  const [read] = useReadStories()
  const { openWelcome } = useSiteActions()
  const briefRead = BRIEF_IDS.filter((id) => read.includes(id)).length
  const briefDone = briefRead === BRIEF_IDS.length

  return (
    <div className="space-y-8">
      <section className="bg-ink p-5 text-white">
        <p className="font-serif text-[28px] leading-none">{greeting()}.</p>
        <p className="mt-2 text-[14px] text-mirror-light">
          {follows.length ? 'This is your edition, built around the desks you follow.' : 'Follow a few desks and this becomes your edition.'}
        </p>
        <dl className="mt-4 grid grid-cols-3 border-t border-rule-dark pt-3 text-center">
          {[
            ['Following', follows.length, '#desks'],
            ['Saved', saved.length, '/saved'],
            ['Read', read.length, null],
          ].map(([label, n, to]) => (
            <div key={label as string}>
              <dd className="text-[24px] font-extrabold tabular-nums leading-none">{n}</dd>
              <dt className="mt-1 text-[12px] text-mirror">
                {to && (to as string).startsWith('/') ? <Link to={to as string} className="underline underline-offset-2 hover:text-white">{label}</Link> : label}
              </dt>
            </div>
          ))}
        </dl>
        <button type="button" onClick={openWelcome} className="mt-4 w-full rounded-full border border-rule-dark py-1.5 text-[13.5px] font-semibold transition-colors duration-150 hover:border-white">
          {follows.length ? 'Edit your desks' : 'Pick your desks'}
        </button>
      </section>

      <RailBlock title="Today’s Brief">
        <div role="progressbar" aria-valuemin={0} aria-valuemax={BRIEF_IDS.length} aria-valuenow={briefRead} aria-label="Brief stories read" className="flex gap-1">
          {BRIEF_IDS.map((id) => (
            <i key={id} className={twMerge('block h-1.5 flex-1', read.includes(id) ? 'bg-signal' : 'bg-paper-2')} />
          ))}
        </div>
        <p className="mt-2 text-[14px] text-muted">
          {briefDone ? 'All eight read. You are up to date.' : briefRead ? `${briefRead} of ${BRIEF_IDS.length} read. ${BRIEF_IDS.length - briefRead} to go.` : 'Eight stories, about two minutes.'}
        </p>
        <p className="mt-2"><TextLink to="/brief" className="text-[14.5px]">{briefRead && !briefDone ? 'Finish The Brief' : 'Read The Brief'}</TextLink></p>
      </RailBlock>

      <RailBlock title="Desks">
        <ul id="desks">
          {CATEGORIES.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 border-b border-rule py-2">
              <Link to={sectionPath(c.id)} className="group min-w-0">
                <span className="block text-[15.5px] font-semibold"><Hl>{c.name}</Hl></span>
                <span className="block text-[12.5px] text-muted">{storiesIn(c.id).length} stories</span>
              </Link>
              <FollowButton id={c.id} name={c.name} small />
            </li>
          ))}
        </ul>
      </RailBlock>
    </div>
  )
}

const TOPICS: [string, string][] = [...SEARCH_TOPICS, ['Elections', 'election'], ['AI', 'ai'], ['Box office', 'box office'], ['African football', 'caf']]

/** Right rail: what is being followed most closely now, what is coming, and one advert. */
export function HappeningRail() {
  const { openSearch, openTrends } = useSiteActions()
  const topics = TOPICS.map(([label, q]) => [label, q, searchStories(q, 'all').length] as const)
    .filter(([, , n]) => n > 0)
    .slice(0, 7)

  return (
    <div className="space-y-8">
      <RailBlock title="Happening now">
        <ul>
          {topics.map(([label, q, n], i) => (
            <li key={q} className="border-b border-rule">
              <button type="button" onClick={() => openSearch(q)} className="group grid w-full grid-cols-[22px_1fr_auto] items-baseline gap-2 py-2.5 text-left">
                <span className="font-mono text-[11px] tabular-nums text-muted">{i + 1}</span>
                <span className="text-[16px] font-semibold"><Hl>{label}</Hl></span>
                <span className="text-[12.5px] tabular-nums text-muted">{n} {n > 1 ? 'stories' : 'story'}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex gap-5 text-[14.5px]">
          <TextLink to="/trends">All trends</TextLink>
          <button type="button" onClick={openTrends} className="font-semibold text-muted hover:text-ink">Quick look</button>
        </p>
      </RailBlock>

      <AdSlot format="mpu" slot={1} placement="the front page, right-hand column" />

      <RailBlock title="Coming up">
        <ul>
          {AGENDA.slice(0, 5).map(([, label, title, , id]) => (
            <li key={title} className="border-b border-rule">
              <Link to={storyPath(id)} className="group grid grid-cols-[62px_1fr] items-baseline gap-3 py-2.5 text-[14.5px] leading-snug">
                <MonoDate className="font-medium text-ink">{label}</MonoDate>
                <Hl>{title}</Hl>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3"><TextLink to="/coming-up" className="text-[14.5px]">Full calendar</TextLink></p>
      </RailBlock>

      <section className="bg-paper p-5">
        <h2 className="font-serif text-[30px] font-normal leading-none tracking-[-0.01em]">Get it at 7am</h2>
        <p className="mt-2 text-[14.5px] text-muted">The morning email: what happened, what is confirmed, what is still open.</p>
        <SubscribeButton />
      </section>
    </div>
  )
}

function SubscribeButton() {
  const { openNewsletter } = useSiteActions()
  return (
    <button type="button" onClick={openNewsletter} className="mt-4 rounded-full border border-signal bg-signal px-4 py-1.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-signal-hover">
      Subscribe free
    </button>
  )
}

/** The desks as a scrolling strip, for screens too narrow for the left rail. */
export function DeskStrip() {
  const [follows, toggle] = useFollowedSections()
  return (
    <div className="no-scrollbar -mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-4 sm:-mx-6 sm:px-6" aria-label="Follow desks">
      {CATEGORIES.map((c) => {
        const on = follows.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(c.id)}
            className="flex-none whitespace-nowrap rounded-full border border-ink px-3.5 py-1.5 text-sm font-semibold aria-pressed:bg-ink aria-pressed:text-white"
          >
            {on ? '✓ ' : '+ '}
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

