import React from 'react'
import { Link } from 'react-router-dom'

import { StoryMedia } from '@/components/story/StoryImage'
import { ImageCard, Kicker } from '@/components/story/StoryParts'
import { Container, Hl, PageHeader } from '@/components/ui'
import { BRIEF_IDS, Story, getStory, storyPath } from '@/data'
import { useSavedStories } from '@/lib/store'

export function SavedPage() {
  const [saved] = useSavedStories()
  const stories = saved.map(getStory).filter(Boolean) as Story[]
  return (
    <>
      <PageHeader title="Saved" intro="Stories you keep are stored in this browser only." />
      <Container className="pb-[72px] pt-6">
      {stories.length ? (
        <ul>
          {stories.map((s) => (
            <li key={s.id} className="border-t border-rule">
              <Link to={storyPath(s.id)} className="group grid items-start gap-5 py-8 lg:grid-cols-12 lg:gap-x-8">
                <div className="lg:col-span-7">
                  <Kicker story={s} />
                  <h3 className="my-2.5 text-[30px] leading-[1.1]"><Hl>{s.h}</Hl></h3>
                  <p className="max-w-[56ch] text-muted">{s.st}</p>
                </div>
                <div className="lg:col-span-5 lg:col-start-8"><StoryMedia story={s} /></div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-t border-rule py-14 text-lg text-muted">
          <b className="mb-1.5 block text-2xl text-ink">Nothing saved yet</b>
          Open any story and choose Save to keep it here. A few to start with:
          <div className="mt-8 grid gap-x-6 gap-y-8 text-base text-ink sm:grid-cols-2 lg:grid-cols-4">
            {(BRIEF_IDS.slice(0, 4).map(getStory).filter(Boolean) as Story[]).map((s) => <ImageCard key={s.id} story={s} />)}
          </div>
        </div>
      )}
      </Container>
    </>
  )
}
