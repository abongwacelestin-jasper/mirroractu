import React from 'react'
import { CountUp } from '@/components/ui/CountUp'
import { Bookmark, EyeOff, Heart, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { Bone } from '@/components/loading/Loading'
import { useToast } from '@/components/overlays/Toast'
import { StoryMedia } from '@/components/story/StoryImage'
import { MonoDate } from '@/components/ui'
import { Story, VIZ, categoryName, sectionPath, storyDate, storyPath } from '@/data'
import { storyMedia } from '@/data/media'
import { useShare } from '@/lib/share'
import { useFollowedSections, useHiddenStories, useLikedStories, useReadStories, useSavedStories } from '@/lib/store'

/** Round badge with the desk's first letter: the "who is speaking" mark of a feed card. */
export function DeskBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={twMerge('flex size-9 flex-none items-center justify-center rounded-full bg-ink text-[16px] font-extrabold text-white', className)}>
      {name[0]}
    </span>
  )
}

/**
 * The actions under a story: like, save, share and (in the feed) hide. Likes and saves are the
 * reader's own and live in this browser, so no public count is shown.
 */
export function StoryActions({
  story,
  canHide = false,
  onShare,
  className,
}: {
  story: Story
  canHide?: boolean
  /** Open a share dialog instead of the device share sheet. */
  onShare?: () => void
  className?: string
}) {
  const [saved, toggleSaved] = useSavedStories()
  const [liked, toggleLiked] = useLikedStories()
  const [, toggleHidden] = useHiddenStories()
  const toast = useToast()
  const share = useShare()
  const isSaved = saved.includes(story.id)
  const isLiked = liked.includes(story.id)

  return (
    <div className={twMerge('flex items-center justify-between gap-1 sm:justify-start sm:gap-2', className)}>
      <Action
        label={isLiked ? 'Liked' : 'Like'}
        pressed={isLiked}
        tone="signal"
        onClick={() => {
          toggleLiked(story.id)
          if (!isLiked) toast('Liked. We will show you more like this.')
        }}
      >
        <span className="relative flex">
          {isLiked && <span key="burst" aria-hidden="true" className="burst absolute inset-0 rounded-full border-2 border-signal" />}
          <Heart key={String(isLiked)} className={twMerge('size-[18px]', isLiked && 'pop')} fill={isLiked ? 'currentColor' : 'none'} />
        </span>
      </Action>
      <Action
        label={isSaved ? 'Saved' : 'Save'}
        pressed={isSaved}
        onClick={() => {
          toggleSaved(story.id)
          toast(isSaved ? 'Removed from saved stories' : 'Story saved. Find it under Saved.')
        }}
      >
        <Bookmark key={String(isSaved)} className={twMerge('size-[18px]', isSaved && 'pop')} fill={isSaved ? 'currentColor' : 'none'} />
      </Action>
      <Action label="Share" onClick={() => (onShare ? onShare() : share(story.h, storyPath(story.id)))}>
        <Share2 className="size-[18px]" />
      </Action>
      {canHide && (
        <Action
          label="Hide"
          onClick={() => {
            toggleHidden(story.id)
            toast('Hidden from your feed', { label: 'Undo', onClick: () => toggleHidden(story.id) })
          }}
        >
          <EyeOff className="size-[18px]" />
        </Action>
      )}
    </div>
  )
}

function Action({ label, pressed, tone, children, ...rest }: { label: string; pressed?: boolean; tone?: 'signal' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={twMerge(
        'flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-[13.5px] font-semibold text-muted transition-colors duration-150 hover:bg-paper hover:text-ink sm:px-3',
        pressed && (tone === 'signal' ? 'text-signal hover:text-signal' : 'text-ink')
      )}
      {...rest}
    >
      {children}
      <span className="max-[350px]:sr-only">{label}</span>
    </button>
  )
}

/**
 * One story in the feed: who filed it, the headline, its picture edge to edge, how settled it
 * is (confirmed against still open), and the actions.
 */
export function FeedCard({ story }: { story: Story }) {
  const [follows, toggleFollow] = useFollowedSections()
  const [read] = useReadStories()
  const toast = useToast()

  const desk = story.cats[0]
  const deskName = categoryName(desk)
  const isRead = read.includes(story.id)
  const following = follows.includes(desk)
  const hasMedia = !!storyMedia(story.id) || (!!VIZ[story.id] && VIZ[story.id].k !== 'fig')

  return (
    <article data-reveal className="border-b border-rule py-5">
      <div className="flex items-center gap-2.5">
        <Link to={sectionPath(desk)} aria-label={`${deskName} desk`}><DeskBadge name={deskName} /></Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link to={sectionPath(desk)} className="text-[14.5px] font-semibold hover:underline">{deskName} desk</Link>
          <div className="flex items-center gap-2 truncate text-muted">
            <MonoDate>{storyDate(story)}</MonoDate>
            <span className="truncate text-[13px]">· {story.sub}</span>
          </div>
        </div>
        {isRead && <span className="rounded-full bg-paper px-2 py-0.5 text-[12px] font-semibold text-muted">Read</span>}
        {!following && (
          <button
            type="button"
            onClick={() => {
              toggleFollow(desk)
              toast(`Following ${deskName}. It now leads your feed.`)
            }}
            className="rounded-full border border-ink px-3 py-1 text-[13px] font-semibold transition-colors duration-150 hover:bg-ink hover:text-white"
          >
            Follow
          </button>
        )}
      </div>

      <Link to={storyPath(story.id)} className="group mt-3 block">
        <h3 className={twMerge('text-[22px] leading-[1.14] decoration-signal decoration-2 underline-offset-[5px] group-hover:underline sm:text-[26px]', isRead && 'text-muted')}>
          {story.h}
        </h3>
        <p className="mt-1.5 text-[15.5px] text-muted">{story.st}</p>
        {hasMedia && <StoryMedia story={story} className="mt-3.5" />}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="inline-block size-2.5 bg-ink" /><CountUp value={story.ok.length} /> confirmed</span>
        <span className="flex items-center gap-1.5 text-ink"><i aria-hidden="true" className="hatch inline-block size-2.5" /><CountUp value={story.un.length} /> still open</span>
        <span>{story.src.length} {story.src.length > 1 ? 'sources' : 'source'}</span>
      </div>
      <StoryActions story={story} canHide className="-mx-2.5 mt-1.5 sm:-mx-3" />
    </article>
  )
}

/** Placeholder card shown while the next page of the feed loads. */
export function FeedCardSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3 border-b border-rule py-5">
      <div className="flex items-center gap-2.5"><Bone className="size-9 rounded-full" /><Bone className="h-3.5 w-36" /></div>
      <Bone className="h-7 w-11/12" />
      <Bone className="h-4 w-2/3" />
      <Bone className="aspect-[16/9] w-full" />
    </div>
  )
}
