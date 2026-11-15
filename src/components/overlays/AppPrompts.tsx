import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Download, RefreshCw, Share, WifiOff, Zap } from 'lucide-react'

import { AnimatedLogo } from '@/components/brand/AnimatedLogo'
import { Button } from '@/components/ui'
import { applyUpdate, installApp, usePwa } from '@/lib/pwa'
import { useStoredValue } from '@/lib/store'

const EASE = [0.23, 1, 0.32, 1] as const
/** Offer the app once the reader has had a look around, and not again for two weeks if they say no. */
const OFFER_AFTER_MS = 75000
const REST_MS = 14 * 24 * 60 * 60 * 1000

/**
 * "Install MirrorActu": our own invitation in place of the browser's bare dialog. On Android,
 * Chrome and Edge the button opens the real install dialog; on iPhone and iPad, which have no
 * such dialog, it shows the two taps to add the site to the home screen.
 */
export function InstallPrompt({ enabled }: { enabled: boolean }) {
  const { canInstall, iosInstallable, installed } = usePwa()
  const [open, setOpen] = useState(false)
  const [lastAsked, setLastAsked] = useStoredValue('ma-install-asked', '0')
  const reduce = useReducedMotion()
  const offerable = (canInstall || iosInstallable) && !installed
  const rested = Date.now() - Number(lastAsked) > REST_MS

  useEffect(() => {
    if (!enabled || !offerable || !rested) return
    const t = window.setTimeout(() => {
      // Never on top of our own promo panel: wait for the next chance instead.
      if (!document.querySelector('[aria-label="From MirrorActu"], [data-popup]')) setOpen(true)
    }, OFFER_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [enabled, offerable, rested])

  // "Install app" links elsewhere on the site open this panel too.
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('ma:install', show)
    return () => window.removeEventListener('ma:install', show)
  }, [])

  const close = () => {
    setOpen(false)
    setLastAsked(String(Date.now()))
  }
  const item = (i: number) => ({ initial: { opacity: 0, y: reduce ? 0 : 10 }, animate: { opacity: 1, y: 0 }, transition: reduce ? { duration: 0 } : { duration: 0.3, delay: 0.45 + i * 0.08, ease: EASE } })

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label="Install MirrorActu"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: reduce ? 0 : 0.42, ease: EASE }}
          className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-[57] overflow-hidden bg-ink text-white shadow-[0_-24px_60px_-20px_rgba(14,20,36,.7)] sm:inset-x-auto sm:right-5 sm:w-[410px] sm:border sm:border-mirror/30 lg:bottom-5"
        >
          <motion.div aria-hidden="true" className="axis-x h-0.5 origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduce ? 0 : 0.7, delay: 0.25, ease: EASE }} />
          <div className="p-5 pr-12 sm:p-6 sm:pr-12">
            <div className="flex items-center gap-4">
              {/* The app icon, as it will sit on the home screen. */}
              <span className="flex size-[60px] flex-none items-center justify-center rounded-[14px] bg-ink-2 ring-1 ring-mirror/30"><AnimatedLogo className="size-10" delay={0.3} /></span>
              <div>
                <motion.p {...item(0)} className="text-[12.5px] font-semibold text-signal">Get the app</motion.p>
                <motion.h2 {...item(1)} className="font-serif text-[29px] font-normal leading-[1.05]">MirrorActu on your home screen.</motion.h2>
              </div>
            </div>
            <motion.ul {...item(2)} className="mt-4 grid gap-1.5 text-[14.5px] text-mirror-light">
              <li className="flex items-center gap-2.5"><Zap className="size-4 flex-none text-signal" /> Opens in one tap, full screen.</li>
              <li className="flex items-center gap-2.5"><WifiOff className="size-4 flex-none text-signal" /> The last edition stays readable offline.</li>
              <li className="flex items-center gap-2.5"><Download className="size-4 flex-none text-signal" /> No app store, almost no storage.</li>
            </motion.ul>
            {canInstall ? (
              <motion.div {...item(3)} className="mt-5 flex items-center gap-4">
                <Button size="sm" onClick={async () => { await installApp(); close() }}>Install</Button>
                <button type="button" onClick={close} className="text-[13.5px] text-mirror hover:text-white">Not now</button>
              </motion.div>
            ) : (
              <motion.div {...item(3)} className="mt-5 border-t border-rule-dark pt-4 text-[14.5px]">
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">1. Tap <Share className="inline size-[18px] text-signal" aria-label="the Share button" /> in your browser’s toolbar.</p>
                <p className="mt-1">2. Choose <b className="font-semibold">Add to Home Screen</b>.</p>
                <button type="button" onClick={close} className="mt-3 text-[13.5px] text-mirror hover:text-white">Got it</button>
              </motion.div>
            )}
          </div>
          <button type="button" onClick={close} aria-label="Close" className="absolute right-2 top-3 flex size-9 items-center justify-center rounded-full text-xl text-mirror hover:bg-white/10 hover:text-white">×</button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

/** Strips under the masthead: you are offline, or a new version is ready. */
export function AppStatusBars() {
  const { online, updateReady } = usePwa()
  return (
    <>
      {!online && (
        <div role="status" className="border-b border-rule-dark bg-dew text-[13.5px] text-ink">
          <div className="mx-auto flex max-w-[1440px] items-center gap-2.5 px-[18px] py-2 sm:px-6 lg:px-10">
            <WifiOff className="size-4 flex-none" />
            <span><b className="font-semibold">You are offline.</b> This is the last edition saved on this device. The wire and forms resume when you reconnect.</span>
          </div>
        </div>
      )}
      {updateReady && (
        <div role="status" className="border-b border-rule bg-paper text-[13.5px]">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1.5 px-[18px] py-2 sm:px-6 lg:px-10">
            <span className="flex items-center gap-2.5"><RefreshCw className="size-4 flex-none text-signal" /> <b className="font-semibold">A new version of MirrorActu is ready.</b></span>
            <button type="button" onClick={applyUpdate} className="ml-auto font-semibold underline decoration-signal decoration-2 underline-offset-4">Refresh now</button>
          </div>
        </div>
      )}
    </>
  )
}
