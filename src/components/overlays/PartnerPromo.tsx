import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Sprout } from 'lucide-react'

import { AdTag } from '@/components/ads/AdSlot'
import { PARTNER } from '@/data/partner'
import { useStoredValue } from '@/lib/store'

const EASE = [0.23, 1, 0.32, 1] as const
/** It appears at a random moment in this window after a page opens, on roughly two visits in three. */
const EARLIEST_MS = 50000
const LATEST_MS = 150000
const CHANCE = 0.66
/** Once shown, it stays away this long, whether the reader closed it or followed the link. */
const REST_MS = 8 * 60 * 60 * 1000

/**
 * A promotion for Renewberry. It rises from the corner at an unpredictable moment, says what it
 * is (a promotion, with the address it leads to), and carries the publisher's line. It never
 * covers another popup, never appears on advert-free pages, and rests for hours once seen.
 */
export function PartnerPromo({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useStoredValue('ma-partner-seen', '0')
  const reduce = useReducedMotion()
  // Decided once per page load, so re-renders do not roll the dice again.
  const plan = useRef({ show: Math.random() < CHANCE, delay: EARLIEST_MS + Math.random() * (LATEST_MS - EARLIEST_MS) })

  const rested = Date.now() - Number(lastSeen) > REST_MS
  useEffect(() => {
    if (!enabled || !rested || !plan.current.show) return
    let retry = 0
    const attempt = () => {
      // Another question or promotion is on screen: wait and try again, a few times.
      if (document.querySelector('[data-popup], [role="dialog"]')) {
        if (retry++ < 4) timer = window.setTimeout(attempt, 20000)
        return
      }
      setOpen(true)
      setLastSeen(String(Date.now()))
    }
    let timer = window.setTimeout(attempt, plan.current.delay)
    return () => window.clearTimeout(timer)
  }, [enabled, rested])

  // Leave when the page behind it is no longer one that takes promotions.
  useEffect(() => {
    if (!enabled) setOpen(false)
  }, [enabled])

  const close = () => setOpen(false)
  const item = (i: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { duration: 0.32, delay: 0.3 + i * 0.08, ease: EASE },
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label={`Promotion: ${PARTNER.name}`}
          data-popup
          initial={{ y: '110%', opacity: reduce ? 0 : 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '110%', opacity: reduce ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
          className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-[56] overflow-hidden bg-white text-ink shadow-[0_-24px_60px_-20px_rgba(14,20,36,.6)] sm:inset-x-auto sm:right-5 sm:w-[400px] sm:border sm:border-rule lg:bottom-5"
        >
          {/* A band of dew and signal draws across the top as the panel lands. */}
          <motion.div aria-hidden="true" className="h-1 origin-left bg-gradient-to-r from-dew via-signal to-ink" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduce ? 0 : 0.8, delay: 0.2, ease: EASE }} />
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 pr-9">
              <motion.span
                aria-hidden="true"
                initial={{ scale: reduce ? 1 : 0.4, rotate: reduce ? 0 : -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}
                className="flex size-11 flex-none items-center justify-center rounded-full bg-ink text-dew"
              >
                <Sprout className="size-[22px]" />
              </motion.span>
              <motion.div {...item(0)} className="min-w-0">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-muted"><AdTag className="text-[9px]">Promotion</AdTag>{PARTNER.kicker}</p>
                <p className="truncate text-[24px] font-extrabold leading-tight tracking-[-0.035em]" translate="no">{PARTNER.name}</p>
              </motion.div>
            </div>
            <motion.h2 {...item(1)} className="mt-4 font-serif text-[30px] font-normal leading-[1.05]">{PARTNER.title}</motion.h2>
            <motion.p {...item(2)} className="mt-2 text-[15px] text-muted">{PARTNER.body}</motion.p>
            <motion.div {...item(3)} className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                href={PARTNER.url}
                target="_blank"
                rel="noopener noreferrer"
                data-track="promo:renewberry"
                onClick={close}
                className="group inline-flex items-center gap-1.5 rounded-full border border-signal bg-signal px-5 py-2.5 text-[15px] font-semibold text-ink transition-[background-color,translate,box-shadow] duration-150 hover:bg-signal-hover hover:shadow-[0_8px_18px_-8px_rgba(255,90,54,.75)] motion-safe:hover:-translate-y-px"
              >
                {PARTNER.cta} <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <button type="button" onClick={close} className="text-[13.5px] font-semibold text-muted hover:text-ink">Not now</button>
            </motion.div>
            <motion.p {...item(4)} className="mt-2.5 text-[12.5px] text-muted">
              Opens <a href={PARTNER.url} target="_blank" rel="noopener noreferrer" onClick={close} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-[3px]" translate="no">{PARTNER.displayUrl}</a> in a new tab.
            </motion.p>
            <motion.p {...item(5)} className="mt-4 border-t border-rule pt-3 text-[14.5px] font-extrabold tracking-[-0.01em]" translate="no">{PARTNER.poweredBy}</motion.p>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="absolute right-2 top-3 flex size-9 items-center justify-center rounded-full text-xl text-muted hover:bg-ink/5 hover:text-ink">×</button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
