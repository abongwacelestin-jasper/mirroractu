import React from 'react'
import { motion } from 'framer-motion'
import { Play, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Modal } from '@/components/overlays/Modal'
import { ButtonLink } from '@/components/ui'
import { EDITION_DATE, storyPath } from '@/data'
import { TREND_VIDEOS, formatSeconds } from '@/data/trends'
import { useTrends } from '@/live/trends'

/** Centred popup with today's top five trends and the leading video. */
export function TrendsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trends = useTrends().slice(0, 5)
  const video = TREND_VIDEOS[0]
  return (
    <Modal open={open} onClose={onClose} title="Today’s trends" center className="sm:max-w-[560px]">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-signal"><TrendingUp className="size-4" /> {EDITION_DATE}</p>
      <h2 className="mt-1 pr-8 text-[32px] font-extrabold leading-none tracking-[-0.035em]">Today’s trends</h2>
      <ol className="mt-4">
        {trends.map((t, i) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.12 + i * 0.07, ease: [0.23, 1, 0.32, 1] }}
            className="border-t border-rule"
          >
            <Link to={storyPath(t.stories[0].id)} onClick={onClose} className="group grid grid-cols-[30px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 py-2.5">
              <span className="text-[24px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{t.rank}</span>
              <span className="min-w-0">
                <span className="block text-[16.5px] font-semibold leading-tight decoration-signal decoration-2 underline-offset-4 group-hover:underline">{t.label}</span>
                <span className="mt-0.5 block truncate text-[13.5px] text-muted">{t.stories[0].h}</span>
              </span>
              {t.activeNow ? (
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-signal"><span className="size-1.5 rounded-full bg-signal motion-safe:animate-pulse" />Active</span>
              ) : (
                <span className="whitespace-nowrap text-[12px] text-muted tabular-nums">{t.stories.length} stories</span>
              )}
            </Link>
          </motion.li>
        ))}
      </ol>

      <Link to="/trends#video" onClick={onClose} className="group mt-2 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-3.5 bg-ink p-2.5 text-white">
        <span className="relative block aspect-video overflow-hidden">
          <img src={video.poster} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-9 items-center justify-center rounded-full bg-signal text-ink"><Play className="ml-0.5 size-4" fill="currentColor" /></span></span>
          <span className="absolute bottom-1 right-1 bg-ink/85 px-1 font-mono text-[10.5px] tabular-nums">{formatSeconds(video.seconds)}</span>
        </span>
        <span className="min-w-0 pr-2">
          <span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-mirror">Trending video</span>
          <span className="mt-0.5 block text-[15px] font-semibold leading-snug">{video.title}</span>
        </span>
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <ButtonLink to="/trends" onClick={onClose}>See all trends</ButtonLink>
        <button type="button" onClick={onClose} className="text-[14px] text-muted hover:text-ink">Not now</button>
      </div>
    </Modal>
  )
}
