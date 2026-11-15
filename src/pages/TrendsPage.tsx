import React, { useEffect, useState } from 'react'
import { CountUp } from '@/components/ui/CountUp'
import { ArrowDown, ArrowUp, Globe, Map, MapPin, Minus, Play } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AdSlot } from '@/components/ads/AdSlot'
import { NearYou } from '@/components/feed/NearYou'
import { LiveBadge } from '@/components/live/LiveFeed'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { StoryImage } from '@/components/story/StoryImage'
import { Container, Hl, PageHeader, TextLink } from '@/components/ui'
import { EDITION_DATE, categoryName, getStory, storyPath } from '@/data'
import { TREND_VIDEOS, formatSeconds } from '@/data/trends'
import { useSiteActions } from '@/lib/actions'
import { useEdition } from '@/lib/edition'
import { Trend, TrendLevel, levelTitle, useTrendLevels } from '@/live/trends'

export function TrendsPage() {
  const levels = useTrendLevels()
  const [country] = useEdition()
  const { openEdition } = useSiteActions()
  const { hash } = useLocation()
  // Start at the nearest level; the reader can widen it to the region or the world.
  const [picked, setPicked] = useState<TrendLevel['level'] | null>(null)
  const level = levels.find((l) => l.level === picked) ?? levels[0]
  const trends = level.trends
  const [top, ...rest] = trends

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  return (
    <>
      <PageHeader
        title="Trends"
        intro={`What matters where you are, then wider. ${EDITION_DATE}.`}
        aside={
          <div className="max-w-[34ch] border-l-2 border-signal pl-4 text-[14px] text-mirror-light">
            <LiveBadge dark note={false} />
            <p className="mt-2">Three lists: your country, your region, the world. Each is ranked by stories about that place, the wire, and what measured readers there open.</p>
          </div>
        }
      />

      {/* The ladder: your country, your region, the world */}
      <div className="sticky top-[calc(96px+var(--safe-top))] z-[5] border-b border-rule bg-white lg:top-[calc(68px+var(--safe-top))]">
        <Container className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-2.5">
          <div role="tablist" aria-label="Where" className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
            {levels.map((l) => (
              <button
                key={l.level}
                role="tab"
                type="button"
                aria-selected={l.level === level.level}
                onClick={() => setPicked(l.level)}
                className="flex flex-none items-center gap-2 whitespace-nowrap rounded-full border border-rule px-4 py-2 text-[14.5px] font-semibold transition-colors duration-150 hover:border-ink aria-selected:border-ink aria-selected:bg-ink aria-selected:text-white"
              >
                {l.level === 'country' ? <MapPin className="size-4" /> : l.level === 'region' ? <Map className="size-4" /> : <Globe className="size-4" />}
                {l.level === 'global' ? 'Global' : l.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={openEdition} className="whitespace-nowrap text-[13.5px] font-semibold underline decoration-signal decoration-2 underline-offset-4">
            {country.code === 'INT' ? 'Choose your country' : `Not in ${country.name}? Change`}
          </button>
        </Container>
      </div>

      <Container className="grid gap-x-10 gap-y-10 pb-12 pt-7 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <div className="mb-5">
            <h2 className="text-[30px] font-extrabold tracking-[-0.035em]">{levelTitle(level)}</h2>
            <p className="mt-1 text-[14.5px] text-muted">
              {level.level === 'country' && `Led by stories about ${level.name} and what readers there are opening. `}
              {level.level === 'region' && `Led by stories from ${level.name} and what readers across it are opening. `}
              {level.level === 'global' && 'Every reader, every desk. '}
              {level.measuredReaders > 0
                ? `Based on ${level.measuredReaders} measured ${level.measuredReaders === 1 ? 'reader' : 'readers'} in the last 24 hours, plus our coverage.`
                : 'No measured readers here yet, so this is ranked by our coverage and the wire.'}
            </p>
          </div>
          {top && <TopTrend key={level.level} trend={top} place={level.level === 'global' ? undefined : level.name} />}
          <ol className="mt-8 border-t-2 border-ink">
            {rest.map((t) => <TrendRow key={`${level.level}-${t.id}`} trend={t} place={level.level === 'global' ? undefined : level.name} />)}
          </ol>
        </div>
        <aside className="min-w-0 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          <div className="space-y-8 lg:sticky lg:top-[92px]">
            <div className="border-t-2 border-ink pt-3">
              <h2 className="mb-2 text-base tracking-normal">Active on the wire now</h2>
              <ul>
                {trends.filter((t) => t.activeNow).slice(0, 4).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 border-b border-rule py-2.5 text-[15px]">
                    <a href={`#trend-${t.id}`} className="font-semibold decoration-signal decoration-2 underline-offset-4 hover:underline">{t.label}</a>
                    <span className="text-[12.5px] text-muted tabular-nums"><CountUp value={t.wireCount} /> updates</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3"><TextLink to="/live" className="text-[14.5px]">Open the wire</TextLink></p>
            </div>
            <AdSlot format="mpu" slot={1} placement="the Trends page, right-hand column" />
          </div>
        </aside>
      </Container>

      <VideoTrends />

      <Container className="py-12">
        <NearYou />
        <AdSlot format="leaderboard" slot={2} placement="the foot of the Trends page" className="mt-8" />
      </Container>
    </>
  )
}

function Moved({ n }: { n: number }) {
  if (n > 0) return <span className="flex items-center gap-0.5 text-[12.5px] font-semibold text-signal"><ArrowUp className="size-3.5" strokeWidth={3} />{n}<span className="sr-only"> places up</span></span>
  if (n < 0) return <span className="flex items-center gap-0.5 text-[12.5px] font-semibold text-muted"><ArrowDown className="size-3.5" strokeWidth={3} />{-n}<span className="sr-only"> places down</span></span>
  return <span className="text-muted"><Minus className="size-3.5" /><span className="sr-only">No change</span></span>
}

function TrendMeta({ trend, dark = false, place }: { trend: Trend; dark?: boolean; place?: string }) {
  return (
    <p className={twMerge('flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]', dark ? 'text-mirror' : 'text-muted')}>
      {place && trend.basis === 'local' && <span className={twMerge('flex items-center gap-1 font-semibold', dark ? 'text-white' : 'text-ink')}><MapPin className="size-3.5 text-signal" />About {place}</span>}
      {place && trend.basis === 'read-here' && <span className={twMerge('font-semibold', dark ? 'text-white' : 'text-ink')}>Read in {place}</span>}
      <span>{categoryName(trend.cat)}</span>
      <span><CountUp value={trend.stories.length} /> {trend.stories.length > 1 ? 'stories' : 'story'}</span>
      {trend.activeNow && (
        <span className="flex items-center gap-1.5 font-semibold text-signal">
          <span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-signal opacity-60 motion-safe:animate-ping" /><span className="relative size-2 rounded-full bg-signal" /></span>
          Active now
        </span>
      )}
    </p>
  )
}

function TopTrend({ trend, place }: { trend: Trend; place?: string }) {
  const { openSearch } = useSiteActions()
  const lead = trend.stories[0]
  return (
    <section id={`trend-${trend.id}`} aria-label={`Number 1: ${trend.label}`} className="scroll-mt-28 bg-ink text-white">
      <div className="grid sm:grid-cols-2">
        <Link to={storyPath(lead.id)} className="group block"><StoryImage story={lead} caption={false} ratio="aspect-[3/2] sm:aspect-auto sm:h-full" className="h-full [&>div]:h-full" eager /></Link>
        <div className="p-5 sm:p-7">
          <p className="flex items-center gap-3">
            <span className="text-[64px] font-extrabold leading-[0.8] tracking-[-0.05em] text-signal">1</span>
            <Moved n={trend.moved} />
          </p>
          <h2 className="mt-3 text-[34px] font-extrabold leading-none tracking-[-0.035em] sm:text-[42px]">{trend.label}</h2>
          <div className="mt-2"><TrendMeta trend={trend} dark place={place} /></div>
          <ul className="mt-4">
            {trend.stories.slice(0, 3).map((s) => (
              <li key={s.id} className="border-t border-rule-dark">
                <Link to={storyPath(s.id)} className="group block py-2.5 text-[15.5px] font-semibold leading-snug"><Hl>{s.h}</Hl></Link>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => openSearch(trend.query)} className="mt-3 border-b-2 border-signal pb-px text-[14.5px] font-semibold">
            All stories on {trend.label}
          </button>
        </div>
      </div>
    </section>
  )
}

function TrendRow({ trend, place }: { trend: Trend; place?: string }) {
  const { openSearch } = useSiteActions()
  const lead = trend.stories[0]
  return (
    <li id={`trend-${trend.id}`} data-reveal className="grid scroll-mt-28 grid-cols-[44px_minmax(0,1fr)_96px] items-start gap-x-3 border-b border-rule py-4 sm:grid-cols-[64px_minmax(0,1fr)_150px] sm:gap-x-5">
      <div>
        <span className="block text-[38px] font-extrabold leading-[0.85] tracking-[-0.05em] tabular-nums sm:text-[50px]">{trend.rank}</span>
        <span className="mt-1.5 block"><Moved n={trend.moved} /></span>
      </div>
      <div className="min-w-0">
        <h2 className="text-[22px] leading-tight sm:text-[26px]">
          <button type="button" onClick={() => openSearch(trend.query)} className="text-left decoration-signal decoration-2 underline-offset-[5px] hover:underline">{trend.label}</button>
        </h2>
        <div className="mt-1"><TrendMeta trend={trend} place={place} /></div>
        <Link to={storyPath(lead.id)} className="group mt-2 block text-[15.5px] leading-snug text-muted"><span className="text-ink"><Hl>{lead.h}</Hl></span></Link>
      </div>
      <Link to={storyPath(lead.id)} className="group block" aria-label={lead.h}><StoryImage story={lead} caption={false} ratio="aspect-[4/3]" /></Link>
    </li>
  )
}

/** The video band: one large player and a playlist. Picking from the playlist plays it. */
export function VideoTrends() {
  // /trends?v=new-glenn-launch#video opens on that video.
  const [params] = useSearchParams()
  const wanted = TREND_VIDEOS.findIndex((v) => v.id === params.get('v'))
  const [current, setCurrent] = useState(Math.max(0, wanted))
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (wanted >= 0) setCurrent(wanted)
  }, [wanted])
  const video = TREND_VIDEOS[current]
  const story = getStory(video.storyId)

  return (
    <section id="video" aria-label="Video trends" className="scroll-mt-24 bg-ink py-12 text-white lg:py-16">
      <Container>
        <div className="mb-7 flex items-end justify-between gap-5 border-t-2 border-white pt-4">
          <h2 className="text-[34px] font-extrabold tracking-[-0.035em]">Video trends</h2>
          <p className="hidden text-[13.5px] text-mirror sm:block">{TREND_VIDEOS.length} videos · public domain and Creative Commons footage</p>
        </div>
        <div className="grid gap-x-8 gap-y-8 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            {/* The key remounts the player for each video, so the pre-roll and poster reset. */}
            <VideoPlayer key={video.id} video={video} autoStart={started} dark />
            <h3 className="mt-4 text-[26px] leading-tight sm:text-[30px]">{video.title}</h3>
            {story && (
              <p className="mt-2 text-mirror-light">
                From the story: <Link to={storyPath(story.id)} className="border-b-2 border-signal pb-px font-semibold text-white">{story.h}</Link>
              </p>
            )}
          </div>
          <ol className="min-w-0 lg:col-span-4">
            {TREND_VIDEOS.map((v, i) => (
              <li key={v.id} className="border-t border-rule-dark first:border-t-0 lg:first:border-t">
                <button
                  type="button"
                  aria-current={i === current ? 'true' : undefined}
                  onClick={() => {
                    setCurrent(i)
                    setStarted(true)
                  }}
                  className="group grid w-full grid-cols-[120px_minmax(0,1fr)] items-center gap-3.5 py-3 text-left transition-colors duration-150 hover:bg-white/5 aria-[current]:bg-white/10 sm:grid-cols-[140px_minmax(0,1fr)]"
                >
                  <span className="relative block aspect-video overflow-hidden bg-ink-2">
                    <img src={v.poster} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute bottom-1 right-1 bg-ink/85 px-1 font-mono text-[10.5px] tabular-nums">{formatSeconds(v.seconds)}</span>
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className={twMerge('flex size-8 items-center justify-center rounded-full', i === current ? 'bg-signal text-ink' : 'bg-ink/70 text-white')}><Play className="ml-0.5 size-3.5" fill="currentColor" /></span>
                    </span>
                  </span>
                  <span className="min-w-0 pr-2">
                    <span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-mirror">{i === current ? 'Now showing' : `Video ${i + 1}`}</span>
                    <span className="mt-0.5 block text-[15px] font-semibold leading-snug">{v.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  )
}

