import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AdSlot } from '@/components/ads/AdSlot'
import { LiveWire } from '@/components/live/LiveFeed'
import { SportHub } from '@/components/sport/SportHub'
import { useToast } from '@/components/overlays/Toast'
import { Commodities, Freshness, LeagueTable } from '@/components/live/LiveHub'
import { StoryCard } from '@/components/story/StoryParts'
import { CountUp } from '@/components/ui/CountUp'
import { Button, Container, Hl, MonoDate, PageHeader, Pill, TextLink } from '@/components/ui'
import { AGENDA, EPL_TABLE, KEY_FIGURES, Tier, getCategory, storiesIn, storyDate, storyPath } from '@/data'
import { useFollowedSections } from '@/lib/store'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function SectionPage() {
  const { sectionId } = useParams()
  const cat = getCategory(sectionId)
  // Reset the topic filter when moving between sections.
  return cat ? <SectionView key={cat.id} id={cat.id} /> : <NotFoundPage />
}

function SectionView({ id }: { id: NonNullable<ReturnType<typeof getCategory>>['id'] }) {
  const cat = getCategory(id)!
  const [topic, setTopic] = useState('All')
  const [order, setOrder] = useState<'new' | 'old'>('new')
  const [follows, toggleFollow] = useFollowedSections()
  const following = follows.includes(id)
  const toast = useToast()

  const all = storiesIn(id)
  const topics = ['All', ...new Set(all.map((s) => s.sub))]
  let list = topic === 'All' ? all : all.filter((s) => s.sub === topic)
  if (order === 'old') list = [...list].reverse()

  // Lead with stories this desk owns, then cross-filed ones.
  const featured = [...list.filter((s) => s.cats[0] === id), ...list.filter((s) => s.cats[0] !== id)].slice(0, 3)
  const [lead, ...second] = featured
  const more = list.filter((s) => !featured.includes(s))

  const agenda = AGENDA.filter((a) => a[3].includes(id))
  const sources = [...new Set(all.flatMap((s) => s.src.map((x) => x[1].split(',')[0])))]
  const mix = (['high', 'medium', 'low'] as Tier[]).map((t) => [t, all.filter((s) => s.tier === t).length] as const).filter(([, n]) => n)

  const confirmed = all.reduce((n, s) => n + s.ok.length, 0)
  const unresolved = all.reduce((n, s) => n + s.un.length, 0)

  return (
    <>
      <PageHeader
        title={cat.name}
        intro={cat.blurb}
        aside={
          <div className="flex w-full flex-col gap-4 lg:w-auto lg:items-end lg:gap-5">
            <dl className="grid grid-cols-4 border-y border-rule-dark py-3 lg:flex lg:gap-x-9 lg:border-0 lg:py-0">
              {[
                ['Stories', all.length],
                ['Confirmed', confirmed],
                ['Still open', unresolved],
                ['Latest', all[0] ? storyDate(all[0]) : '—'],
              ].map(([t, v]) => (
                <div key={t}>
                  <dt className="text-[12px] text-mirror sm:text-[13px]">{t}</dt>
                  <dd className="whitespace-nowrap text-[20px] font-semibold tracking-[-0.02em] tabular-nums sm:text-[26px]">{typeof v === 'number' ? <CountUp value={v} /> : v}</dd>
                </div>
              ))}
            </dl>
            <Button
              variant={following ? 'solid' : 'line'}
              aria-pressed={following}
              className="w-full text-white aria-pressed:border-signal aria-pressed:bg-signal aria-pressed:text-ink hover:bg-white/10 lg:w-auto"
              onClick={() => {
                toggleFollow(id)
                toast(following ? `Stopped following ${cat.name}` : `Following ${cat.name}. It now leads your front page.`)
              }}>
              {following ? `Following ${cat.name}` : `Follow ${cat.name}`}
            </Button>
          </div>
        }
      />
      <Container>

      <div className="grid grid-cols-2 gap-x-4 border-b border-b-rule sm:grid-cols-4">
        {KEY_FIGURES[id].map(([value, caption, storyId]) => (
          <Link
            key={value + caption}
            to={storyPath(storyId)}
            className="group block border-b border-rule pb-4 pt-4 sm:border-b-0 lg:mr-6 lg:border-r lg:pb-6 lg:pr-6 lg:pt-[22px] lg:last:mr-0 lg:last:border-r-0"
          >
            <b className="block text-[28px] font-extrabold leading-none tracking-[-0.04em] tabular-nums transition-colors duration-150 group-hover:text-signal lg:text-[40px]">
              <CountUp value={value} />
            </b>
            <span className="mt-2 block max-w-[26ch] text-sm text-muted">{caption}</span>
          </Link>
        ))}
      </div>

      {id === 'sport' && <SportHub />}

      <div className="sticky top-[96px] z-[5] -mx-[18px] flex items-center justify-between gap-3 border-b border-rule bg-white px-[18px] py-2.5 sm:-mx-6 sm:px-6 lg:top-[68px] lg:mx-0 lg:flex-wrap lg:gap-5 lg:px-0 lg:py-[22px]">
        <div role="tablist" aria-label={`Topics in ${cat.name}`} className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto lg:flex-wrap">
          {topics.map((t) => (
            <Pill key={t} role="tab" selected={topic === t} onClick={() => setTopic(t)}>
              {t}
              {t !== 'All' && <span className="ml-1 opacity-70">{all.filter((s) => s.sub === t).length}</span>}
            </Pill>
          ))}
        </div>
        <label className="flex flex-none items-center gap-2.5 text-sm text-muted">
          <span className="hidden sm:inline">Order</span>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as 'new' | 'old')}
            className="rounded-full border border-rule bg-white px-3.5 py-[7px] text-sm text-ink"
          >
            <option value="new">Newest first</option>
            <option value="old">Oldest first</option>
          </select>
        </label>
      </div>

      <div className="grid gap-10 pb-12 pt-7 lg:grid-cols-12 lg:gap-x-8 lg:pt-11">
        <div className="min-w-0 lg:col-span-8">
          {lead && <StoryCard story={lead} size="xl" withViz />}
          {second.length > 0 && (
            <div className="mt-10 grid gap-8 border-t border-rule pt-9 sm:grid-cols-2">
              {second.map((s) => <div key={s.id} className="min-w-0"><StoryCard story={s} withViz /></div>)}
            </div>
          )}
          {more.length > 0 && (
            <>
              <h2 className="mt-[52px] border-b-2 border-ink pb-3.5 text-[22px]">More in {topic === 'All' ? cat.name : topic}</h2>
              <ul>
                {more.map((s, i) => (
                  <React.Fragment key={s.id}>
                  {i === 3 && <li className="border-b border-rule py-6"><AdSlot format="infeed" slot={3} placement={`the ${cat.name} story list`} /></li>}
                  <li data-reveal className="border-b border-rule">
                    <Link to={storyPath(s.id)} className="group grid items-baseline gap-1.5 py-[22px] sm:grid-cols-[86px_1fr_auto] sm:gap-5">
                      <MonoDate className="text-muted">{storyDate(s)}</MonoDate>
                      <div>
                        <h3 className="text-[21px] leading-[1.2]"><Hl>{s.h}</Hl></h3>
                        <p className="mt-1.5 max-w-[60ch] text-[15.5px] text-muted">{s.st}</p>
                      </div>
                      <Chip>{s.sub}</Chip>
                    </Link>
                  </li>
                  </React.Fragment>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="min-w-0 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          {agenda.length > 0 && (
            <SideBlock title={`Coming up in ${cat.name}`}>
              <ul>
                {agenda.map(([, label, title, , storyId]) => (
                  <li key={title} className="border-b border-rule">
                    <Link to={storyPath(storyId)} className="group grid grid-cols-[78px_1fr] items-baseline gap-3.5 py-[13px] text-[15.5px] leading-[1.35]">
                      <MonoDate className="font-medium text-ink">{label}</MonoDate>
                      <Hl>{title}</Hl>
                    </Link>
                  </li>
                ))}
              </ul>
            </SideBlock>
          )}

          {id === 'business' && (
            <SideBlock title="Commodities">
              <div className="mb-3.5 mt-2.5"><Freshness state="stale">Stale: last updated 6 November</Freshness></div>
              <Commodities compact />
              <p className="mt-3.5"><TextLink to="/live">All live data</TextLink></p>
            </SideBlock>
          )}
          {id === 'climate' && (
            <SideBlock title="Global temperature">
              <div className="mt-2.5 text-[60px] font-extrabold leading-[0.95] tracking-[-0.045em]"><CountUp value={'+1.75°C'} /></div>
              <p className="mt-1.5 text-[14.5px] text-muted">October 2026 against the pre-industrial estimate. Copernicus, via RMetS.</p>
            </SideBlock>
          )}

          {id !== 'sport' && (
            <div className="mb-10 border-t-2 border-ink pt-3">
              <LiveWire cat={id} max={4} title={`${cat.name} wire`} />
            </div>
          )}

          <AdSlot format="mpu" slot={1} placement={`the ${cat.name} section, right-hand column`} className="mb-10" />

          <SideBlock title="How this desk publishes">
            <div role="img" aria-label="Share of stories by risk tier" className="mb-2.5 mt-3.5 flex h-2.5 gap-0.5 text-ink">
              {mix.map(([t, n]) => (
                <i
                  key={t}
                  style={{ flex: n }}
                  className={twMerge('block', t === 'high' && 'bg-ink', t === 'medium' && 'hatch-x', t === 'low' && 'ring-1 ring-inset ring-ink')}
                />
              ))}
            </div>
            <p className="text-sm text-muted">
              {mix.map(([t, n]) => `${n} ${t} risk`).join(', ')}. High-risk stories need a named editor before they publish.
            </p>
          </SideBlock>

          <SideBlock title="Sources used here">
            <ul className="pt-2 text-[14.5px] text-muted">
              {sources.map((s) => <li key={s} className="py-1">{s}</li>)}
            </ul>
          </SideBlock>
        </aside>
      </div>
      <AdSlot format="leaderboard" slot={2} placement={`the foot of the ${cat.name} section`} className="mb-[72px]" />
      </Container>
    </>
  )
}

export function SideBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div data-reveal className="mb-10">
      <h2 className="mb-1.5 border-t-2 border-ink pt-3 text-base tracking-normal">{title}</h2>
      {children}
    </div>
  )
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="justify-self-start whitespace-nowrap rounded-full border border-rule px-2.5 py-[3px] text-[12.5px] text-muted">{children}</span>
}
