import React from 'react'

import { ImageCard } from '@/components/story/StoryParts'
import { ButtonLink, Container, PageHeader } from '@/components/ui'
import { STORIES, newestFirst } from '@/data'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Not found" intro="There is no page at this address. It may have moved, or the link may be mistyped." aside={<ButtonLink to="/">Go to the front page</ButtonLink>} />
      <Container className="py-12">
        <h2 className="mb-6 border-t-2 border-ink pt-3 text-[22px]">Latest stories</h2>
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {newestFirst(STORIES).slice(0, 4).map((s) => <ImageCard key={s.id} story={s} />)}
        </div>
      </Container>
    </>
  )
}
