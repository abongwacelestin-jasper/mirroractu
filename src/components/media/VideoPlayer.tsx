import React, { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

import { AdTag } from '@/components/ads/AdSlot'
import type { Video } from '@/data/media'
import { IMA_AD_TAG, playPreroll, preloadIma } from '@/lib/google'
import { useConsent } from '@/lib/consent'

type Phase = 'poster' | 'ad-loading' | 'ad' | 'content'

/**
 * Video player with an optional Google pre-roll advert.
 *
 * It shows the poster and a play button. On play, if a Google ad tag is configured and the
 * reader allowed advertising by Google, one advert runs first, clearly labelled, and the video
 * follows. With no tag, a blocked SDK or any advert error, the video simply plays.
 *
 * `autoStart` plays as soon as the player mounts (used when a reader picks from a playlist,
 * which is itself a tap).
 */
export function VideoPlayer({
  video,
  preroll = true,
  autoStart = false,
  dark = false,
  className,
}: {
  video: Video
  preroll?: boolean
  autoStart?: boolean
  dark?: boolean
  className?: string
}) {
  const [phase, setPhase] = useState<Phase>('poster')
  const { allows } = useConsent()
  const videoRef = useRef<HTMLVideoElement>(null)
  const adRef = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const cancelAd = useRef<() => void>(() => {})
  // Google's advert runs only for readers who allowed advertising by Google.
  const withAd = preroll && !!IMA_AD_TAG && allows('ads')

  // Fetch Google's SDK when the player comes near the screen, so the advert can start on the tap.
  useEffect(() => {
    if (!withAd || !box.current || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        preloadIma()
        io.disconnect()
      }
    }, { rootMargin: '300px' })
    io.observe(box.current)
    return () => io.disconnect()
  }, [withAd])

  useEffect(() => () => cancelAd.current(), [])

  const playContent = () => {
    setPhase('content')
    const v = videoRef.current
    if (!v) return
    v.controls = true
    v.play().catch(() => {
      /* the browser wants another tap: the native controls are showing */
    })
  }

  const start = async () => {
    const v = videoRef.current
    if (!v || phase !== 'poster') return
    if (!withAd || !adRef.current) return playContent()
    setPhase('ad-loading')
    await preloadIma()
    cancelAd.current = playPreroll({
      video: v,
      adContainer: adRef.current,
      personalised: true,
      onAdStart: () => setPhase('ad'),
      onDone: playContent,
    })
  }

  useEffect(() => {
    if (autoStart) start()
  }, [])

  const inAd = phase === 'ad' || phase === 'ad-loading'

  return (
    <figure className={className}>
      <div ref={box} className="relative aspect-video w-full overflow-hidden bg-ink">
        <video
          ref={videoRef}
          src={video.src}
          poster={video.poster}
          playsInline
          preload="none"
          aria-label={video.alt}
          className="absolute inset-0 size-full object-contain"
        />
        {/* Google draws the advert in here. */}
        <div ref={adRef} className={twMerge('absolute inset-0', inAd ? 'block' : 'hidden')} />

        {inAd && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-ink/85 to-transparent p-3">
            <span className="flex items-center gap-2 text-[12.5px] text-white">
              <AdTag className="bg-dew text-ink">Advertisement</AdTag>
              {phase === 'ad-loading' ? 'Loading advert…' : 'Video advert served by Google. Your video follows.'}
            </span>
          </div>
        )}

        {phase === 'poster' && (
          <button type="button" onClick={start} aria-label={`Play video: ${video.title}`} className="group absolute inset-0 flex items-center justify-center">
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-signal text-ink shadow-[0_12px_30px_-8px_rgba(255,90,54,.8)] transition-transform duration-200 ease-out group-hover:scale-110 sm:size-20">
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-signal opacity-50 motion-safe:animate-ping" />
              <Play className="relative ml-1 size-7 sm:size-8" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      <figcaption className={twMerge('mt-2 text-[11.5px] leading-snug', dark ? 'text-mirror' : 'text-muted')}>
        {video.alt}.{' '}
        <a href={video.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{video.credit}, {video.licence}</a>
      </figcaption>
    </figure>
  )
}
