import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Story } from '@/data'
import { VIDEOS, storyMedia } from '@/data/media'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { Viz, VizTone } from './Viz'

/**
 * A story's file photo with its credit. Photos are illustrative, so the caption always says
 * "File photo" and names the author and licence. Renders nothing if the story has no photo.
 * Set `linkCredit={false}` when the image sits inside a link (links cannot nest).
 */
export function StoryImage({
  story,
  ratio = 'aspect-[16/9]',
  caption = true,
  linkCredit = true,
  eager = false,
  className,
}: {
  story: Story
  ratio?: string
  caption?: boolean
  linkCredit?: boolean
  eager?: boolean
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const m = storyMedia(story.id)
  if (!m) return null
  const credit = `${m.credit}, ${m.licence}`
  return (
    <figure className={className}>
      <div className={twMerge('overflow-hidden bg-paper-2', !loaded && 'shimmer', ratio)}>
        <img
          src={m.src}
          alt={m.alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          ref={(el) => {
            // Cached images can finish before React attaches onLoad.
            if (el?.complete && !loaded) setLoaded(true)
          }}
          className={twMerge(
            'size-full object-cover transition-[opacity,scale,filter] duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none',
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
          )}
        />
      </div>
      {caption && (
        <figcaption className="mt-1.5 text-[11.5px] leading-snug text-muted">
          File photo: {m.alt}.{' '}
          {linkCredit ? (
            <a href={m.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{credit}</a>
          ) : (
            credit
          )}
        </figcaption>
      )}
    </figure>
  )
}

/** The picture slot of a card: the file photo if there is one, otherwise the data graphic. */
export function StoryMedia({ story, vizTone = 'paper', ratio, className }: { story: Story; vizTone?: VizTone; ratio?: string; className?: string }) {
  return storyMedia(story.id) ? (
    <StoryImage story={story} ratio={ratio} linkCredit={false} className={className} />
  ) : (
    <Viz story={story} tone={vizTone} className={className} />
  )
}

export const hasPhoto = (story: Story) => !!storyMedia(story.id)

/** A story's video, with its title, description and credit. Never autoplays. */
export function StoryVideo({ storyId, dark = false, className }: { storyId: string; dark?: boolean; className?: string }) {
  const v = VIDEOS[storyId]
  if (!v) return null
  return (
    <figure className={className}>
      <p className={twMerge('mb-2 flex items-center gap-2 text-[13px] font-semibold', dark ? 'text-white' : 'text-ink')}>
        <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-signal text-[9px] text-ink">▶</span>
        Video · {v.title}
      </p>
      <VideoPlayer video={v} dark={dark} />
    </figure>
  )
}
