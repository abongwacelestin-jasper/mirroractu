import React from 'react'
import { Link } from 'react-router-dom'

import { AdSlot } from '@/components/ads/AdSlot'
import { LiveWire, MarketTicker } from '@/components/live/LiveFeed'
import { LiveHub } from '@/components/live/LiveHub'
import { Kicker, Ledger, StoryCard, StoryRows } from '@/components/story/StoryParts'
import { ButtonLink, Container, DeskHeading, Hl, MonoDate, TextLink } from '@/components/ui'
import { Viz } from '@/components/story/Viz'
import {
  AGENDA,
  EDITION_DATE,
  CATEGORIES,
  CategoryId,
  STORIES,
  Story,
  categoryName,
  getStory,
  newestFirst,
  sectionPath,
  storiesIn,
  storyPath,
} from '@/data'
import { useFollowedSections } from '@/lib/store'

const LEAD = 's-cop31'
const RAIL = ['s-agoa', 's-nz']
const USED = new Set([LEAD, ...RAIL, 's-safrica', 's-egypt', 's-sudan', 's-abyei', 's-tanzania', 's-oil', 's-fraud', 's-godzilla', 's-epl'])
const story = (id: string) => getStory(id) as Story
const unused = (c: CategoryId) => newestFirst(STORIES.filter((s) => s.cats[0] === c && !USED.has(s.id)))

export function HomePage() {
  const lead = story(LEAD)
  const [follows] = useFollowedSections()
  const totals = STORIES.reduce((t, s) => ({ ok: t.ok + s.ok.length, open: t.open + s.un.length }), { ok: 0, open: 0 })
  const followed = CATEGORIES.filter((c) => follows.includes(c.id)).slice(0, 3)

  return (
    <>
      {/* Stage: the lead story split down the mirror axis */}
      <section className="bg-ink text-white">
        <Container className="pt-10 lg:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-rule-dark pb-8">
            <p className="font-serif text-[clamp(52px,10.5vw,160px)] leading-[0.88] tracking-[-0.03em]">
              Today, <em className="text-mirror">reflected</em>
              <span className="text-signal">.</span>
            </p>
            <p className="max-w-[26ch] pb-2 text-[15px] text-mirror-light">
              <b className="font-semibold text-white">{STORIES.length} stories</b> tracked, with{' '}
              <b className="font-semibold text-white">{totals.ok} facts confirmed</b> and{' '}
              <b className="font-semibold text-signal">{totals.open} still open</b>. {EDITION_DATE}.
            </p>
          </div>
        </Container>
        <Container className="grid gap-y-11 pb-10 pt-10 lg:grid-cols-12 lg:gap-x-8 lg:pb-14">
          <div className="min-w-0 lg:col-span-8">
            <Kicker story={lead} dark className="text-sm" />
            <h1 className="my-[18px] mb-[22px] text-[clamp(40px,5.3vw,74px)] leading-none tracking-[-0.035em]">
              <Link to={storyPath(lead.id)} className="decoration-signal decoration-[3px] underline-offset-8 hover:underline">
                {lead.h}
              </Link>
            </h1>
            <p className="max-w-[34em] font-serif text-[22px] leading-[1.25] text-mirror-light sm:text-[27px]">{lead.st}</p>
            <div className="mt-11">
              <Ledger confirmed={lead.ok.slice(0, 3)} open={lead.un} dark />
            </div>
          </div>
          <aside aria-label="Also leading" className="min-w-0 border-t border-rule-dark pt-6 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="mb-1.5 text-sm text-mirror">Also leading today</p>
            {RAIL.map(story).map((s, i) => (
              <Link key={s.id} to={storyPath(s.id)} className={`group block py-5 ${i === 0 ? 'pt-2.5' : 'border-t border-rule-dark'}`}>
                <Kicker story={s} dark />
                <h3 className="mt-2 text-[22px] leading-[1.16]"><Hl>{s.h}</Hl></h3>
                <p className="mt-1.5 text-[15px] text-mirror">{s.st}</p>
              </Link>
            ))}
            <LiveWire dark max={4} className="mt-4 border-t border-rule-dark pt-5" />
          </aside>
        </Container>
        <div className="border-t border-rule-dark">
          <Container>
            <MarketTicker />
          </Container>
        </div>
      </section>

      <Container className="py-8">
        <AdSlot format="leaderboard" slot={0} placement="the front page, under the lead story" />
      </Container>

      {followed.length > 0 && (
        <section className="bg-paper py-[26px]">
          <Container className="grid items-start gap-8 lg:grid-cols-[200px_1fr]">
            <div>
              <h2 className="text-lg">Your sections</h2>
              <p className="mt-1 text-sm text-muted">You follow {followed.map((c) => c.name).join(', ')}.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3 md:gap-8">
              {followed.map((c) => (
                <div key={c.id} className="min-w-0">
                  <p className="mb-3 text-sm font-semibold text-muted"><TextLink to={sectionPath(c.id)}>{c.name}</TextLink></p>
                  <StoryRows stories={storiesIn(c.id).slice(0, 2)} />
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Africa and world lead stories, with the latest feed */}
      <section className="py-[52px] lg:py-[72px]">
        <Container className="grid gap-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="min-w-0 lg:col-span-5">
            <StoryCard story={story('s-safrica')} size="xl" withViz />
            <div className="mt-7 border-t border-rule pt-7"><StoryCard story={story('s-egypt')} size="lg" /></div>
          </div>
          <div className="min-w-0 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
            <StoryCard story={story('s-sudan')} size="lg" withViz />
            <div className="mt-7 border-t border-rule pt-7"><StoryCard story={story('s-abyei')} /></div>
            <div className="mt-7 border-t border-rule pt-7"><StoryCard story={story('s-tanzania')} /></div>
          </div>
          <div className="min-w-0 lg:col-span-3 lg:border-l lg:border-rule lg:pl-8">
            <p className="mb-3 text-sm font-semibold text-muted">Latest</p>
            <StoryRows stories={newestFirst(STORIES).slice(0, 7)} />
            <AdSlot format="mpu" slot={1} placement="the front page, beside Latest" className="mt-8" />
          </div>
        </Container>
      </section>

      <DeskPair tint left={['business', 's-oil']} right={['tech', 's-fraud']} />

      <section className="py-[52px] lg:py-[72px]">
        <Container className="grid gap-10 lg:grid-cols-3 lg:gap-x-8">
          {(['world', 'climate', 'health'] as CategoryId[]).map((c) => {
            const list = unused(c)
            return (
              <div key={c} className="min-w-0">
                <DeskHeading title={categoryName(c)} to={sectionPath(c)} linkLabel="All" />
                {list[0] && <StoryCard story={list[0]} />}
                <div className="mt-[22px]"><StoryRows stories={list.slice(1, 4)} /></div>
              </div>
            )
          })}
        </Container>
      </section>

      <Container className="pb-[52px] lg:pb-[72px]">
        <AdSlot format="leaderboard" slot={2} placement="the front page, between desks" />
      </Container>

      <DeskPair tint left={['culture', 's-godzilla']} right={['sport', 's-epl']} />

      <section className="py-[52px] lg:py-[72px]">
        <Container className="grid gap-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="min-w-0 lg:col-span-7">
            <DeskHeading title="Coming up" to="/coming-up" linkLabel="Full calendar" />
            <ul>
              {AGENDA.slice(0, 6).map(([, label, title, , id]) => (
                <li key={title} className="border-b border-rule">
                  <Link to={storyPath(id)} className="group grid grid-cols-[78px_1fr] items-baseline gap-3.5 py-[13px] text-[15.5px] leading-[1.35]">
                    <MonoDate className="font-medium text-ink">{label}</MonoDate>
                    <Hl>{title}</Hl>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 lg:col-span-5">
            <div className="flex h-full flex-col gap-3.5 bg-ink p-9 text-white">
              <h3 className="font-serif text-[40px] font-normal leading-none tracking-[-0.01em]">The Brief</h3>
              <p className="max-w-[34ch] text-mirror-light">Eight stories, each in two lines: what happened and why it matters. About two minutes.</p>
              <ButtonLink to="/brief" className="mt-auto self-start">Read The Brief</ButtonLink>
            </div>
          </div>
        </Container>
      </section>

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
                <li key={c.id} className="flex min-w-0 flex-col border-t border-ink pt-4">
                  <Link to={sectionPath(c.id)} className="group">
                    <span className="text-[44px] font-extrabold leading-[0.95] tracking-[-0.04em] transition-colors duration-150 group-hover:text-signal">{c.name}</span>
                  </Link>
                  <p className="mb-5 mt-2 text-[15px] text-muted">{c.blurb}</p>
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
          <h2 className="font-serif text-[clamp(34px,3.8vw,52px)] font-normal leading-[1.05] tracking-[-0.015em] lg:col-span-7">
            Every story shows what is confirmed, what is still open, and where it came from.
          </h2>
          <div className="lg:col-span-5">
            <dl>
              {[
                ['Sources you can open', 'Up to three per story, each labelled with the part it plays.'],
                ['Editors decide sensitive stories', 'Elections, conflict, health and money claims need a named editor.'],
                ['Corrections stay visible', 'Stories keep their version history. Nothing is quietly rewritten.'],
              ].map(([t, d], i) => (
                <div key={t} className={i ? 'mt-5' : ''}>
                  <dt className="border-t border-ink pt-3.5 text-lg font-semibold">{t}</dt>
                  <dd className="mt-1 text-muted">{d}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-[26px]"><TextLink to="/how-we-work">How we work</TextLink></p>
          </div>
        </Container>
      </section>
    </>
  )
}

/** Two section desks side by side, each with a lead story, its graphic and four more headlines. */
function DeskPair({ left, right, tint }: { left: [CategoryId, string]; right: [CategoryId, string]; tint?: boolean }) {
  return (
    <section className={`py-[52px] lg:py-[72px] ${tint ? 'bg-paper' : ''}`}>
      <Container className="grid gap-10 lg:grid-cols-2 lg:gap-x-8">
        {[left, right].map(([c, leadId]) => (
          <div key={c} className="min-w-0">
            <DeskHeading title={categoryName(c)} to={sectionPath(c)} linkLabel={`All ${categoryName(c)}`} />
            <StoryCard story={story(leadId)} size="lg" withViz vizTone={tint ? 'white' : 'paper'} />
            <div className="mt-7"><StoryRows stories={unused(c).slice(0, 4)} /></div>
          </div>
        ))}
      </Container>
    </section>
  )
}
