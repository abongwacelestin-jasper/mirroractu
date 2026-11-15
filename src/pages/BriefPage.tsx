import React from 'react'
import { Link } from 'react-router-dom'

import { AdSlot } from '@/components/ads/AdSlot'
import { Kicker } from '@/components/story/StoryParts'
import { Container, Hl, PageHeader } from '@/components/ui'
import { BRIEF_IDS, EDITION_DATE, Story, getStory, storyPath } from '@/data'

export function BriefPage() {
  const stories = BRIEF_IDS.map(getStory).filter(Boolean) as Story[]
  return (
    <>
      <PageHeader title="The Brief" intro={`Eight stories in about two minutes. ${EDITION_DATE}.`} />
      <Container className="pb-[88px] pt-6">
      <ol className="max-w-[860px]">
        {stories.map((s, i) => (
          <React.Fragment key={s.id}>
          {i === 4 && <li className="border-t border-rule py-6"><AdSlot format="infeed" slot={2} placement="The Brief, between stories four and five" /></li>}
          <li className="border-t border-rule py-[30px]">
            <Link to={storyPath(s.id)} className="group block">
              <Kicker story={s} />
              <h3 className="mb-2 mt-2.5 text-[28px]"><Hl>{s.h}</Hl></h3>
              <p className="font-serif text-[23px] leading-[1.3] text-muted">{s.why}</p>
            </Link>
          </li>
          </React.Fragment>
        ))}
      </ol>
      </Container>
    </>
  )
}
