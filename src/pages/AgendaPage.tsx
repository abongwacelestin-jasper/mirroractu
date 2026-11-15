import React from 'react'
import { Link } from 'react-router-dom'

import { AdSlot } from '@/components/ads/AdSlot'
import { LiveWire } from '@/components/live/LiveFeed'
import { StoryImage } from '@/components/story/StoryImage'
import { Container, Hl, PageHeader } from '@/components/ui'
import { AGENDA, Story, categoryName, getStory, storyPath } from '@/data'
import { Chip } from '@/pages/SectionPage'

export function AgendaPage() {
  const [, nextLabel, nextTitle, , nextId] = AGENDA[0]
  const nextStory = getStory(nextId) as Story
  return (
    <>
      <PageHeader title="Coming up" intro="Dates worth knowing, taken from the stories we are following. Each links to the story behind it." />
      <Container className="grid gap-x-10 gap-y-10 pb-12 pt-6 lg:grid-cols-12">
        <ul className="min-w-0 lg:col-span-8">
          {AGENDA.map(([, label, title, cats, id]) => (
            <li key={title} className="border-t border-rule first:border-t-0">
              <Link to={storyPath(id)} className="group grid items-baseline gap-1 py-[22px] sm:grid-cols-[130px_1fr_auto] sm:gap-6">
                <b className="text-[26px] font-semibold tracking-[-0.02em]">{label}</b>
                <strong className="text-[19px] font-semibold tracking-[-0.01em]"><Hl>{title}</Hl></strong>
                <Chip>{categoryName(cats[0])}</Chip>
              </Link>
            </li>
          ))}
        </ul>
        <aside className="min-w-0 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          <div className="space-y-8 lg:sticky lg:top-[92px]">
            <Link to={storyPath(nextId)} className="group block bg-ink p-5 text-white">
              <p className="text-[13px] font-semibold text-signal">Next up · {nextLabel}</p>
              <h2 className="mt-2 text-[24px] leading-[1.12]"><Hl>{nextTitle}</Hl></h2>
              <StoryImage story={nextStory} caption={false} ratio="aspect-[2/1]" className="mt-4" />
              <p className="mt-3 text-[14.5px] text-mirror-light">{nextStory.st}</p>
            </Link>
            <div className="border-t-2 border-ink pt-3"><LiveWire max={3} /></div>
            <AdSlot format="mpu" slot={0} placement="the Coming up page, right-hand column" />
          </div>
        </aside>
      </Container>
      <Container className="pb-[72px]">
        <AdSlot format="leaderboard" slot={3} placement="the foot of the Coming up page" />
      </Container>
    </>
  )
}
