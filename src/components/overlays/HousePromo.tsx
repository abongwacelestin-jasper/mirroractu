import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

import { AnimatedLogo } from '@/components/brand/AnimatedLogo'
import { Button } from '@/components/ui'
import { BRIEF_IDS } from '@/data'
import { useSiteActions } from '@/lib/actions'
import { useFollowedSections, useReadStories, useStoredValue } from '@/lib/store'

const EASE = [0.23, 1, 0.32, 1] as const
/** How long a reader is on the site before the promo appears, and how long before it may return. */
const SHOW_AFTER_MS = 35000
const REST_MS = 24 * 60 * 60 * 1000

/**
 * MirrorActu's own advert for itself. After a reader has been on the site a while, a panel
 * rises from the bottom, the logo assembles as it does on the loading screen, and it offers the
 * one thing this reader has not done yet: pick desks, read The Brief, or get the morning email.
 * It is labelled as ours, not a paid advert, and rests for a day once closed.
 */
export function HousePromo({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useStoredValue('ma-promo-seen', '0')
  const [follows] = useFollowedSections()
  const [read] = useReadStories()
  const [newsletterSeen] = useStoredValue('ma-nl-seen', '')
  const { openWelcome, openNewsletter } = useSiteActions()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const rested = Date.now() - Number(lastSeen) > REST_MS
  useEffect(() => {
    if (!enabled || !rested) return
    const t = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [enabled, rested])

  const close = () => {
    setOpen(false)
    setLastSeen(String(Date.now()))
  }

  const briefLeft = BRIEF_IDS.filter((id) => !read.includes(id)).length
  const promo =
    follows.length === 0
      ? { kicker: 'Make it yours', title: 'Follow the desks you care about.', body: 'Pick a few and your front page rebuilds around them. No account needed.', cta: 'Pick your desks', act: openWelcome }
      : briefLeft > 0 && newsletterSeen
        ? { kicker: 'Two minutes', title: `${briefLeft} Brief ${briefLeft > 1 ? 'stories' : 'story'} left today.`, body: 'Eight stories, each in two lines: what happened and why it matters.', cta: 'Open The Brief', act: () => navigate('/brief') }
        : { kicker: 'Every morning at 7', title: 'Today, reflected. In your inbox.', body: 'What happened, what is confirmed and what is still open. One email a day, free.', cta: 'Get the morning email', act: openNewsletter }

  const item = (i: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { duration: 0.3, delay: 0.5 + i * 0.09, ease: EASE },
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label="From MirrorActu"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: reduce ? 0 : 0.42, ease: EASE }}
          className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-[56] overflow-hidden bg-ink text-white shadow-[0_-24px_60px_-20px_rgba(14,20,36,.7)] sm:inset-x-auto sm:left-5 sm:w-[400px] sm:border sm:border-mirror/30 lg:bottom-5"
        >
          {/* The signal axis sweeps across the top as the panel lands. */}
          <motion.div
            aria-hidden="true"
            className="axis-x h-0.5 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: reduce ? 0 : 0.7, delay: 0.25, ease: EASE }}
          />
          <div className="p-5 pr-12 sm:p-6 sm:pr-12">
            <div className="flex items-center gap-3">
              <AnimatedLogo className="size-11" delay={0.3} />
              <motion.span {...item(0)} className="whitespace-nowrap text-[26px] font-extrabold leading-[0.9] tracking-[-0.035em]">
                <span translate="no">Mirror<b className="font-extrabold text-signal">Actu</b></span>
              </motion.span>
            </div>
            <motion.p {...item(1)} className="mt-4 text-[12.5px] font-semibold text-signal">{promo.kicker}</motion.p>
            <motion.h2 {...item(2)} className="mt-1 font-serif text-[30px] font-normal leading-[1.05]">{promo.title}</motion.h2>
            <motion.p {...item(3)} className="mt-2 text-[14.5px] text-mirror-light">{promo.body}</motion.p>
            <motion.div {...item(4)} className="mt-4 flex items-center gap-4">
              <Button
                size="sm"
                onClick={() => {
                  close()
                  promo.act()
                }}
              >
                {promo.cta}
              </Button>
              <button type="button" onClick={close} className="text-[13.5px] text-mirror hover:text-white">Not now</button>
            </motion.div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">From MirrorActu · not a paid advert</p>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="absolute right-2 top-3 flex size-9 items-center justify-center rounded-full text-xl text-mirror hover:bg-white/10 hover:text-white">
            ×
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
