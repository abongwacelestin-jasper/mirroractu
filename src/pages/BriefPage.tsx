import React from 'react'
import { CountUp } from '@/components/ui/CountUp'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AdSlot } from '@/components/ads/AdSlot'
import { LiveWire } from '@/components/live/LiveFeed'
import { StoryImage } from '@/components/story/StoryImage'
import { Kicker } from '@/components/story/StoryParts'
import { ButtonLink, Container, Hl, PageHeader } from '@/components/ui'
import { BRIEF_IDS, EDITION_DATE, Story, getStory, storyPath } from '@/data'
import { useReadStories } from '@/lib/store'

export function BriefPage() {
  const stories = BRIEF_IDS.map(getStory).filter(Boolean) as Story[]
  const [read] = useReadStories()
  const done = stories.filter((s) => read.includes(s.id)).length
  const next = stories.find((s) => !read.includes(s.id))

  return (
    <>
      <PageHeader
        title="The Brief"
        intro={`Eight stories in about two minutes. ${EDITION_DATE}.`}
        aside={
          <div className="w-full lg:w-[300px]">
            <p className="text-[13px] text-mirror">Your progress</p>
            <p className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums"><CountUp value={done} /> of {stories.length} read</p>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={stories.length} aria-valuenow={done} aria-label="Brief stories read" className="mt-2 flex gap-1">
              {stories.map((s) => <i key={s.id} className={twMerge('block h-1.5 flex-1', read.includes(s.id) ? 'bg-signal' : 'bg-mirror/30')} />)}
            </div>
          </div>
        }
      />
      <Container className="grid gap-x-10 gap-y-10 pb-[88px] pt-6 lg:grid-cols-12">
        <ol className="min-w-0 lg:col-span-8">
          {stories.map((s, i) => {
            const isRead = read.includes(s.id)
            return (
              <React.Fragment key={s.id}>
                {i === 4 && <li className="border-t border-rule py-6"><AdSlot format="infeed" slot={2} placement="The Brief, between stories four and five" /></li>}
                <li data-reveal className="border-t border-rule first:border-t-0">
                  <Link to={storyPath(s.id)} className="group grid grid-cols-[34px_minmax(0,1fr)] gap-x-4 py-7 sm:grid-cols-[44px_minmax(0,1fr)_220px] sm:gap-x-6">
                    <span className={twMerge('font-mono text-[13px] tabular-nums', isRead ? 'text-muted' : 'text-signal')}>{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <Kicker story={s} />
                        {isRead && <span className="rounded-full bg-paper px-2 py-px text-[12px] font-semibold text-muted">Read</span>}
                      </div>
                      <h3 className={twMerge('mb-2 mt-2.5 text-[26px] leading-[1.12]', isRead && 'text-muted')}><Hl>{s.h}</Hl></h3>
                      <p className="font-serif text-[21px] leading-[1.3] text-muted">{s.why}</p>
                    </div>
                    <StoryImage story={s} caption={false} ratio="aspect-[3/2]" className="col-start-2 mt-4 sm:col-start-3 sm:mt-0" />
                  </Link>
                </li>
              </React.Fragment>
            )
          })}
          <li className="border-t-2 border-ink pt-6">
            {next ? (
              <ButtonLink to={storyPath(next.id)} className="max-w-full whitespace-normal text-left">{done ? 'Continue: ' : 'Start: '}{next.h.length > 48 ? next.h.slice(0, 46) + '…' : next.h}</ButtonLink>
            ) : (
              <p className="font-serif text-[28px] leading-tight">All eight read. You are up to date. <Link to="/" className="underline decoration-signal decoration-2 underline-offset-4">Back to your feed</Link></p>
            )}
          </li>
        </ol>
        <aside className="min-w-0 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          <div className="space-y-8 lg:sticky lg:top-[92px]">
            <div className="border-t-2 border-ink pt-3"><LiveWire max={4} /></div>
            <AdSlot format="mpu" slot={1} placement="The Brief, right-hand column" />
          </div>
        </aside>
      </Container>
    </>
  )
}
