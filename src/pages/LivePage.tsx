import React from 'react'

import { AdSlot } from '@/components/ads/AdSlot'
import { LiveBadge, LiveWire } from '@/components/live/LiveFeed'
import { LiveHub } from '@/components/live/LiveHub'
import { StoryVideo } from '@/components/story/StoryImage'
import { Container, PageHeader, TextLink } from '@/components/ui'
import { storyPath } from '@/data'

export function LivePage() {
  return (
    <>
      <PageHeader title="Live data" intro="Every figure names its provider and says how old it is. Old data is flagged, never hidden." />
      <section className="bg-paper py-[52px] lg:py-[72px]">
        <Container>
          <div className="mb-10 grid gap-8 lg:grid-cols-12 lg:gap-x-8">
            <div className="bg-white px-7 py-[26px] lg:col-span-8">
              <LiveWire max={10} />
            </div>
            <div className="flex flex-col gap-6 lg:col-span-4">
              <div className="bg-ink p-7 text-white">
                <LiveBadge dark note={false} />
                <p className="mt-3 font-serif text-[26px] leading-[1.15]">Updates arrive here as desks file them.</p>
                <p className="mt-3 text-[14.5px] text-mirror-light">
                  This preview runs a simulated provider so you can see the live states. Production connects the licensed sports, markets and climate feeds.
                </p>
              </div>
              <AdSlot format="mpu" slot={2} placement="the live data page, beside the wire" />
            </div>
          </div>
          <LiveHub />
          <div className="mt-10 grid items-center gap-8 bg-ink p-7 text-white lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="font-serif text-[34px] font-normal leading-[1.05]">The long view</h2>
              <p className="mt-3 text-mirror-light">October 2026 was 1.75°C above the pre-industrial estimate. NASA’s map shows how the world got here, year by year since 1880.</p>
              <p className="mt-4"><TextLink to={storyPath('s-cop31')} className="text-white">Read the COP31 story</TextLink></p>
            </div>
            <StoryVideo storyId="s-cop31" dark className="lg:col-span-8" />
          </div>
          <p className="mt-6"><TextLink to="/how-we-work#live-data">How freshness labels work</TextLink></p>
          <AdSlot format="leaderboard" slot={1} placement="the foot of the live data page" className="mt-12" />
        </Container>
      </section>
    </>
  )
}
