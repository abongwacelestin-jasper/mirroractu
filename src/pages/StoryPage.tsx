import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AdSlot } from '@/components/ads/AdSlot'
import { CorrectionForm } from '@/components/overlays/CorrectionForm'
import { LiveWire } from '@/components/live/LiveFeed'
import { Modal } from '@/components/overlays/Modal'
import { useToast } from '@/components/overlays/Toast'
import { StoryActions } from '@/components/feed/FeedCard'
import { StoryImage, StoryVideo } from '@/components/story/StoryImage'
import { ImageCard, Ledger } from '@/components/story/StoryParts'
import { Button, Container, Hl, TextLink, buttonClass } from '@/components/ui'
import { Viz } from '@/components/story/Viz'
import { STORIES, TIERS, VIZ, categoryName, formatDate, getStory, newestFirst, sectionPath, storyPath } from '@/data'
import { useWire } from '@/live/feed'
import { useReadStories, useSavedStories, useTextSize } from '@/lib/store'
import { SideBlock } from '@/pages/SectionPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function StoryPage() {
  const { storyId } = useParams()
  const story = getStory(storyId)
  const [saved, toggleSaved] = useSavedStories()
  const [size, setSize] = useTextSize()
  const [shareOpen, setShareOpen] = useState(false)
  const toast = useToast()
  const [progress, setProgress] = useState(0)
  const [read, markRead] = useReadStories()

  // Opening a story marks it read: the feed and The Brief use this.
  useEffect(() => {
    if (story) markRead(story.id)
  }, [story?.id])
  const liveUpdates = useWire({ storyId, max: 1 }).items.length > 0

  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement
      const max = d.scrollHeight - d.clientHeight
      setProgress(max > 0 ? Math.min(1, d.scrollTop / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [storyId])

  if (!story) return <NotFoundPage />

  const section = story.cats[0]
  const sectionName = categoryName(section)
  const isSaved = saved.includes(story.id)
  const [tierName, tierRule] = TIERS[story.tier]
  // Keep reading: related stories, unread ones first.
  const related = newestFirst(STORIES.filter((s) => s.id !== story.id && s.cats.some((c) => story.cats.includes(c))))
  const upNext = [...related.filter((s) => !read.includes(s.id)), ...related.filter((s) => read.includes(s.id))].slice(0, 4)
  const siblings = newestFirst(STORIES.filter((s) => s.cats[0] === section))
  const i = siblings.indexOf(story)
  const newer = siblings[i - 1]
  const older = siblings[i + 1]
  const words = [story.what, story.why, ...story.ok, ...story.un].join(' ').split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / 200))
  const large = size === 'l'

  return (
    <article>
      <div aria-hidden="true" className="fixed left-0 top-0 z-40 h-[3px] bg-signal" style={{ width: `${progress * 100}%` }} />
      <Container className="pb-16 pt-7 lg:pb-24 lg:pt-14">
        <header className="max-w-[1100px]">
          <TextLink to={sectionPath(section)} className="text-sm">{sectionName}</TextLink>
          <h1 className="mb-4 mt-3 text-[clamp(31px,4.8vw,64px)] leading-[1.02] tracking-[-0.035em] lg:mb-[22px] lg:mt-[18px]">{story.h}</h1>
          <p className="max-w-[34em] font-serif text-[20px] leading-[1.25] text-muted sm:text-[28px]">{story.st}</p>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-b-rule border-t-ink py-3 text-[13.5px] lg:mt-7 lg:gap-x-7 lg:py-4 lg:text-[14.5px]">
          <span className="font-semibold">{story.desk.split(' · ')[0]}</span>
          <span>{story.dl ? `Reported ${story.dl}` : `Source date ${formatDate(story.d, true)}`}</span>
          <span>{minutes} min read</span>
          <span>Compiled 15 Nov 2026 from {story.src.length} {story.src.length > 1 ? 'sources' : 'source'}</span>
          <span className="flex w-full items-center justify-between gap-2 lg:ml-auto lg:w-auto">
            <span role="group" aria-label="Text size" className="inline-flex overflow-hidden rounded-full border border-ink">
              {(['m', 'l'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={size === s}
                  aria-label={s === 'm' ? 'Standard text' : 'Larger text'}
                  onClick={() => setSize(s)}
                  className={twMerge('px-[13px] py-1.5 font-semibold', s === 'l' ? 'border-l border-ink text-[17px]' : 'text-sm', size === s && 'bg-ink text-white')}
                >
                  A
                </button>
              ))}
            </span>
            <StoryActions story={story} onShare={() => setShareOpen(true)} className="-mr-2.5 gap-0 sm:gap-1" />
          </span>
        </div>

        <div className="mt-6 grid gap-10 lg:mt-11 lg:grid-cols-12 lg:gap-x-8">
          <div className="min-w-0 lg:col-span-8">
            <StoryImage story={story} eager className="-mx-[18px] mb-6 sm:mx-0 lg:mb-9 [&_figcaption]:px-[18px] sm:[&_figcaption]:px-0" />
            <p className={twMerge('max-w-[34em] leading-[1.5]', large ? 'text-[23px] sm:text-[26px]' : 'text-[19px] sm:text-[22px]')}>{story.what}</p>

            {VIZ[story.id] && VIZ[story.id].k !== 'fig' && <Viz story={story} className="mt-9 max-w-[620px]" />}

            <div className="mt-11 border-t-2 border-ink pt-[26px]">
              <Ledger confirmed={story.ok} open={story.un} textSize={size} />
            </div>

            <StoryVideo storyId={story.id} className="mt-12" />

            <div className="mt-12 border-l-[3px] border-signal pl-[26px]">
              <h2 className="mb-2 text-[15px] tracking-normal">Why it matters</h2>
              <p className={twMerge('max-w-[26em] font-serif leading-[1.22]', large ? 'text-[30px] sm:text-[35px]' : 'text-[25px] sm:text-[30px]')}>{story.why}</p>
            </div>

            <AdSlot format="infeed" slot={0} placement={`the ${sectionName} story page, after “Why it matters”`} className="mt-12" />

            <div className="mt-[52px]">
              <h2 className="mb-2 text-[22px]">Sources</h2>
              <ol>
                {story.src.map(([role, label, url], n) => (
                  <li key={label} className="grid grid-cols-[28px_1fr] border-t border-rule py-3.5 text-[16.5px]">
                    <span className="pt-[3px] font-mono text-xs text-muted">{n + 1}</span>
                    <div>
                      <small className="block text-[13.5px] text-muted">{role}</small>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-signal decoration-2 underline-offset-4">
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {upNext.length > 0 && (
              <section aria-label="Keep reading" className="mt-16 border-t-2 border-ink pt-4">
                <div className="mb-6 flex items-baseline justify-between gap-4">
                  <h2 className="text-[28px] font-extrabold tracking-[-0.03em]">Keep reading</h2>
                  <TextLink to={sectionPath(section)} className="text-[14.5px]">All {sectionName}</TextLink>
                </div>
                <Link to={storyPath(upNext[0].id)} className="group grid gap-6 sm:grid-cols-2">
                  <StoryImage story={upNext[0]} caption={false} ratio="aspect-[3/2]" />
                  <div>
                    <p className="text-[13px] font-semibold text-signal">Up next</p>
                    <h3 className="mt-2 text-[28px] leading-[1.1]"><Hl>{upNext[0].h}</Hl></h3>
                    <p className="mt-3 text-muted">{upNext[0].st}</p>
                    <p className="mt-4 text-[13.5px] text-muted">{upNext[0].ok.length} confirmed · {upNext[0].un.length} still open</p>
                  </div>
                </Link>
                {upNext.length > 1 && (
                  <div className="mt-9 grid gap-x-6 gap-y-8 border-t border-rule pt-7 sm:grid-cols-3">
                    {upNext.slice(1).map((s) => <ImageCard key={s.id} story={s} />)}
                  </div>
                )}
              </section>
            )}

            <nav aria-label={`More in ${sectionName}`} className="mt-12 grid border-t border-rule sm:grid-cols-2 sm:gap-8">
              {newer ? (
                <Link to={storyPath(newer.id)} className="group block py-5">
                  <small className="mb-1.5 block text-[13.5px] text-muted">Newer in {sectionName}</small>
                  <strong className="text-[19px] font-semibold leading-tight tracking-[-0.01em]"><Hl>{newer.h}</Hl></strong>
                </Link>
              ) : <span />}
              {older ? (
                <Link to={storyPath(older.id)} className="group block border-t border-rule py-5 sm:border-t-0 sm:text-right">
                  <small className="mb-1.5 block text-[13.5px] text-muted">Older in {sectionName}</small>
                  <strong className="text-[19px] font-semibold leading-tight tracking-[-0.01em]"><Hl>{older.h}</Hl></strong>
                </Link>
              ) : <span />}
            </nav>
          </div>

          <aside className="min-w-0 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
            <SideBlock title="Editorial record">
              <dl className="grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-[9px] pt-2 text-[14.5px]">
                <dt className="text-muted">Topic</dt><dd>{story.sub}</dd>
                <dt className="text-muted">Risk tier</dt><dd><b className="font-semibold">{tierName}</b>. {tierRule}</dd>
                <dt className="text-muted">Version</dt><dd>1, with no corrections</dd>
                <dt className="text-muted">Sign-off</dt><dd>None yet. This is a preview edition.</dd>
              </dl>
            </SideBlock>
            {liveUpdates && (
              <div className="mb-10 border-t-2 border-ink pt-3">
                <LiveWire storyId={story.id} max={3} title="Live on this story" />
              </div>
            )}
            <AdSlot format="mpu" slot={2} placement={`the ${sectionName} story page, right-hand column`} className="mb-10" />
            <SideBlock title="Spotted a mistake?">
              <CorrectionToggle key={story.id} />
            </SideBlock>
            <div className="hidden lg:sticky lg:top-24 lg:block">
              <AdSlot format="halfpage" slot={3} placement={`the ${sectionName} story page, right-hand column`} />
            </div>
          </aside>
        </div>
      </Container>
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} title={story.h} path={storyPath(story.id)} onCopied={(m) => toast(m)} />
    </article>
  )
}

function CorrectionToggle() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="pt-2 font-semibold">
        Report a correction <span className="text-signal">{open ? '–' : '+'}</span>
      </button>
      {open && <CorrectionForm />}
    </div>
  )
}

function ShareModal({ open, onClose, title, path, onCopied }: { open: boolean; onClose: () => void; title: string; path: string; onCopied: (m: string) => void }) {
  const url = `https://mirroractu.net${path}`
  const enc = encodeURIComponent
  const targets: [string, string][] = [
    ['WhatsApp', `https://wa.me/?text=${enc(title + ' ' + url)}`],
    ['X', `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
    ['Email', `mailto:?subject=${enc(title)}&body=${enc(url)}`],
  ]
  return (
    <Modal open={open} onClose={onClose} title="Share this story">
      <h2 className="pr-8 text-[26px] font-extrabold tracking-[-0.03em]">Share this story</h2>
      <p className="mt-2 font-serif text-xl leading-[1.25] text-muted">{title}</p>
      <div className="mt-6 flex items-center gap-2 border border-rule p-1.5 pl-3.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted">{url}</span>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              onCopied('Link copied')
            } catch {
              onCopied('Copying is blocked here. Select the link instead.')
            }
          }}
        >
          Copy link
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {targets.map(([name, href]) => (
          <a key={name} href={href} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'line', size: 'sm' })}>
            {name}
          </a>
        ))}
      </div>
      <p className="mt-5 text-[13px] text-muted">Shared links open the full story, with its sources, for free.</p>
    </Modal>
  )
}
