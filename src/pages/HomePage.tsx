import React from 'react'
import { Link } from 'react-router-dom'

import { AdSlot } from '@/components/ads/AdSlot'
import { Feed } from '@/components/feed/Feed'
import { NearYou } from '@/components/feed/NearYou'
import { DeskStrip, HappeningRail, YourRail } from '@/components/feed/Rails'
import { LiveWire, MarketTicker } from '@/components/live/LiveFeed'
import { LiveHub } from '@/components/live/LiveHub'
import { StoryImage } from '@/components/story/StoryImage'
import { Kicker, Ledger } from '@/components/story/StoryParts'
import { Container, DeskHeading, Hl, MonoDate, TextLink } from '@/components/ui'
import { useSiteActions } from '@/lib/actions'
import { useEdition } from '@/lib/edition'
import { CATEGORIES, EDITION_DATE, STORIES, Story, getStory, sectionPath, storiesIn, storyPath } from '@/data'

const LEAD = 's-cop31'
const RAIL = ['s-agoa', 's-nz']
const story = (id: string) => getStory(id) as Story

/** Sticky side column that scrolls on its own if it is taller than the screen. */
const railClass = 'no-scrollbar sticky top-[92px] max-h-[calc(100vh-108px)] overflow-y-auto'

export function HomePage() {
  const lead = story(LEAD)
  const [country] = useEdition()
  const { openEdition } = useSiteActions()
  const totals = STORIES.reduce((t, s) => ({ ok: t.ok + s.ok.length, open: t.open + s.un.length }), { ok: 0, open: 0 })

  return (
    <>
      {/* Stage: the lead story split down the mirror axis */}
      <section className="bg-ink text-white">
        <Container className="pt-6 lg:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3 border-b border-rule-dark pb-5 lg:gap-y-5 lg:pb-8">
            <p className="font-serif text-[clamp(46px,10.5vw,160px)] leading-[0.88] tracking-[-0.03em]">
              Today, <em className="text-mirror">reflected</em>
              <span className="text-signal">.</span>
            </p>
            <p className="text-[14px] text-mirror-light lg:max-w-[26ch] lg:pb-2 lg:text-[15px]">
              <b className="font-semibold text-white">{STORIES.length} stories</b> tracked, with{' '}
              <b className="font-semibold text-white">{totals.ok} facts confirmed</b> and{' '}
              <b className="font-semibold text-signal">{totals.open} still open</b>. {EDITION_DATE}.{' '}
              <button type="button" onClick={openEdition} className="whitespace-nowrap font-semibold text-white underline decoration-signal decoration-2 underline-offset-4">
                {country.name} edition
              </button>
            </p>
          </div>
        </Container>
        <Container className="grid gap-y-7 pb-8 pt-6 lg:grid-cols-12 lg:gap-x-8 lg:pb-14 lg:pt-10">
          <div className="min-w-0 lg:col-span-5">
            <Kicker story={lead} dark className="text-sm" />
            <h1 className="mb-4 mt-3 text-[clamp(32px,3.9vw,60px)] leading-none tracking-[-0.035em] lg:my-[18px] lg:mb-[22px]">
              <Link to={storyPath(lead.id)} className="decoration-signal decoration-[3px] underline-offset-8 hover:underline">
                {lead.h}
              </Link>
            </h1>
            <p className="max-w-[34em] font-serif text-[20px] leading-[1.25] text-mirror-light sm:text-[25px]">{lead.st}</p>
            <Link to={storyPath(lead.id)} className="group mt-5 block lg:mt-8">
              <StoryImage story={lead} eager linkCredit={false} className="[&_figcaption]:text-mirror" />
            </Link>
          </div>
          {/* Phones get the count and a link; the full ledger is one tap away on the story. */}
          <Link to={storyPath(lead.id)} className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-rule-dark py-3 text-[14px] lg:hidden">
            <span className="flex items-center gap-1.5"><i aria-hidden="true" className="inline-block size-2.5 bg-white" />{lead.ok.length} confirmed</span>
            <span className="flex items-center gap-1.5 text-mirror"><i aria-hidden="true" className="hatch inline-block size-2.5" />{lead.un.length} still open</span>
            <span className="ml-auto font-semibold text-signal">See both sides →</span>
          </Link>
          <div className="hidden min-w-0 lg:col-span-4 lg:block lg:border-l lg:border-rule-dark lg:pl-8">
            <Ledger confirmed={lead.ok.slice(0, 3)} open={lead.un} dark stacked />
          </div>
          <aside aria-label="Also leading" className="min-w-0 lg:col-span-3 lg:border-l lg:border-rule-dark lg:pl-8">
            <p className="mb-1.5 text-sm text-mirror">Also leading today</p>
            {RAIL.map(story).map((s, i) => (
              <Link key={s.id} to={storyPath(s.id)} className={`group grid grid-cols-[116px_minmax(0,1fr)] items-start gap-x-3.5 py-4 lg:block lg:py-5 ${i === 0 ? 'pt-2.5' : 'border-t border-rule-dark'}`}>
                <StoryImage story={s} caption={false} ratio="aspect-[4/3] lg:aspect-[2/1]" className="lg:mb-3.5" />
                <div>
                  <Kicker story={s} dark />
                  <h3 className="mt-1.5 text-[18px] leading-[1.16] lg:mt-2 lg:text-[21px]"><Hl>{s.h}</Hl></h3>
                </div>
              </Link>
            ))}
            <LiveWire dark max={3} className="hidden border-t border-rule-dark pt-5 lg:block" />
          </aside>
        </Container>
        <div className="border-t border-rule-dark">
          <Container>
            <MarketTicker />
          </Container>
        </div>
      </section>

      <Container className="pt-5 lg:pt-8">
        <AdSlot format="leaderboard" slot={0} placement="the front page, under the lead story" />
      </Container>

      {/* The feed: your corner on the left, the stories in the middle, what is happening on the right */}
      <Container className="grid gap-x-10 pb-14 pt-5 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside aria-label="Your edition" className="hidden xl:block">
          <div className={railClass}><YourRail /></div>
        </aside>
        <div className="min-w-0">
          <NearYou />
          <div className="xl:hidden"><DeskStrip /></div>
          <Feed />
        </div>
        <aside aria-label="Happening now" className="mt-10 lg:mt-0">
          <div className="no-scrollbar lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-108px)] lg:overflow-y-auto"><HappeningRail /></div>
        </aside>
      </Container>

      <section className="bg-paper py-[52px] lg:py-[72px]">
        <Container>
          <DeskHeading title="Live data" to="/live" linkLabel="Open live data" />
          <LiveHub />
        </Container>
      </section>

      <section className="py-[52px] lg:py-[72px]">
        <Container>
          <DeskHeading title="Every desk" />
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c) => {
              const list = storiesIn(c.id)
              return (
                <li key={c.id} className="flex min-w-0 flex-col">
                  <Link to={storyPath(list[0].id)} className="group block">
                    <StoryImage story={list.find((s) => s.cats[0] === c.id) ?? list[0]} caption={false} ratio="aspect-[3/2]" />
                  </Link>
                  <Link to={sectionPath(c.id)} className="group mt-4 border-t border-ink pt-3">
                    <span className="text-[40px] font-extrabold leading-[0.95] tracking-[-0.04em] transition-colors duration-150 group-hover:text-signal">{c.name}</span>
                  </Link>
                  <p className="mb-4 mt-2 text-[15px] text-muted">{c.blurb}</p>
                  <Link to={storyPath(list[0].id)} className="group mt-auto border-t border-rule pt-3.5">
                    <MonoDate className="text-muted">Latest, {list.length} stories</MonoDate>
                    <span className="mt-1.5 block text-[17px] font-semibold leading-[1.25] tracking-[-0.01em]"><Hl>{list[0].h}</Hl></span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Container>
      </section>

      <section className="bg-paper py-[52px] lg:py-[72px]">
        <Container className="grid gap-10 lg:grid-cols-12 lg:gap-x-8">
          <h2 className="font-serif text-[clamp(34px,3.8vw,52px)] font-normal leading-[1.05] tracking-[-0.015em] lg:col-span-6">
            Every story shows what is confirmed, what is still open, and where it came from.
          </h2>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3 lg:col-span-6 lg:grid-cols-1 xl:grid-cols-3">
            {[
              ['Sources you can open', 'Up to three per story, each labelled with the part it plays.'],
              ['Editors decide sensitive stories', 'Elections, conflict, health and money claims need a named editor.'],
              ['Corrections stay visible', 'Stories keep their version history. Nothing is quietly rewritten.'],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="border-t border-ink pt-3.5 text-lg font-semibold">{t}</dt>
                <dd className="mt-1 text-muted">{d}</dd>
              </div>
            ))}
            <p className="sm:col-span-3 lg:col-span-1 xl:col-span-3"><TextLink to="/how-we-work">How we work</TextLink></p>
          </dl>
        </Container>
      </section>
    </>
  )
}
