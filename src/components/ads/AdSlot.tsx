import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { ADVERTISERS, Advertiser, offersPath } from '@/data/offers'
import { AdInfo, useSiteActions } from '@/lib/actions'
import { ADSENSE_CLIENT, ADSENSE_SLOTS, loadAdSense, requestAdSenseFill } from '@/lib/google'
import { useStoredValue } from '@/lib/store'
import { Bone } from '@/components/loading/Loading'
import { Modal } from '@/components/overlays/Modal'
import { Button, TextLink } from '@/components/ui'

/**
 * Advertising. The handbook requires adverts to be labelled and kept apart from reporting, so:
 *
 *  - every slot sits in its own frame under a solid "Advertisement" tag that names who paid;
 *  - native in-feed slots are tagged "Sponsored" instead and still name the sponsor;
 *  - each slot has an "About this advert" button (who paid, why you see it, how to hide it);
 *  - the space is reserved before the creative loads, so the page never jumps.
 *
 * The creatives come from data/offers.ts (placeholder advertisers) and link to that
 * advertiser's offers page. To go live, replace the body of `Creative` with the ad-server
 * render for `format` and keep the frame around it.
 */
export type AdFormat = 'leaderboard' | 'mpu' | 'infeed' | 'halfpage'

export const AD_FORMATS: Record<AdFormat, { name: string; size: string; minH: string; where: string; tag: string }> = {
  leaderboard: { name: 'Leaderboard', size: '728 × 90', minH: 'min-h-[90px]', where: 'Between sections on the front page, and at the foot of list pages', tag: 'Advertisement' },
  mpu: { name: 'Rectangle', size: '300 × 250', minH: 'min-h-[250px]', where: 'In the right-hand column of section, story and live pages', tag: 'Advertisement' },
  halfpage: { name: 'Half page', size: '300 × 600', minH: 'min-h-[600px]', where: 'Right-hand column of story pages, wide screens only', tag: 'Advertisement' },
  infeed: { name: 'In-feed', size: 'Native', minH: 'min-h-[96px]', where: 'Inside story lists, and after "Why it matters" on a story', tag: 'Sponsored' },
}

type CreativeData = Advertiser

const CREATIVES = ADVERTISERS

const MotionLink = motion.create(Link)

/** Stand-in for ad-server latency once a slot scrolls into view. */
const AD_LOAD_MS = 650

/** The solid tag that marks every advert. */
export function AdTag({ children = 'Advertisement', className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={twMerge('inline-block bg-ink px-1.5 py-[3px] font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.14em] text-white', className)}>
      {children}
    </span>
  )
}

/** True once the element has been within 200px of the viewport. Adverts load lazily on this. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  return [ref, near] as const
}

export function AdSlot({
  format,
  slot = 0,
  placement = 'this page',
  className,
}: {
  format: AdFormat
  slot?: number
  /** Where the slot sits, in words, for the "About this advert" modal. */
  placement?: string
  className?: string
}) {
  const ad = CREATIVES[slot % CREATIVES.length]
  const spec = AD_FORMATS[format]
  const { openAdInfo } = useSiteActions()
  const [ref, near] = useNearViewport<HTMLElement>()
  const [loaded, setLoaded] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [consent] = useStoredValue('ma-consent', '')
  // Google fills this slot when AdSense is configured and the reader has made a cookie choice.
  const google = !!ADSENSE_CLIENT && !!ADSENSE_SLOTS[format] && !!consent

  useEffect(() => {
    if (!near) return
    const t = window.setTimeout(() => setLoaded(true), AD_LOAD_MS)
    return () => window.clearTimeout(t)
  }, [near])

  if (hidden) {
    return (
      <aside aria-label="Advertisement, hidden" className={twMerge('w-full border border-dashed border-rule px-4 py-3 text-[13px] text-muted', className)}>
        <AdTag className="mr-2.5 bg-muted" /> Advert hidden for this visit.{' '}
        <button type="button" onClick={() => setHidden(false)} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-4">
          Show it again
        </button>
      </aside>
    )
  }

  return (
    <aside data-reveal="zoom" ref={ref} aria-label={`${spec.tag}: ${ad.name}`} className={twMerge('w-full border border-rule bg-paper/60 p-2.5', className)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <AdTag>{spec.tag}</AdTag>
        <span className="text-[12.5px] text-muted">
          {google ? <>Ads by <b className="font-semibold text-ink">Google</b></> : <>Paid for by <b className="font-semibold text-ink">{ad.name}</b></>}
        </span>
        <button
          type="button"
          onClick={() => openAdInfo({ sponsor: google ? 'An advertiser chosen by Google' : ad.name, format: spec.name, size: spec.size, placement, onHide: () => setHidden(true) })}
          className="ml-auto flex flex-none items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-muted transition-colors duration-150 hover:text-ink"
        >
          <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border border-current font-serif text-[11px] italic leading-none">i</span>
          About this advert
        </button>
      </div>

      {loaded && google ? (
        <GoogleAd format={format} personalised={consent === 'all'} fallback={<Creative ad={ad} format={format} />} />
      ) : loaded ? (
        <Creative ad={ad} format={format} />
      ) : (
        <div role="status" aria-label="Advert loading" className={twMerge('relative w-full', spec.minH)}>
          <Bone className="absolute inset-0" />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
            {spec.tag} · {spec.size}
          </span>
        </div>
      )}

      <p className="mt-2 text-[11.5px] leading-snug text-muted">
        Sponsors do not influence MirrorActu reporting.{' '}
        <Link to="/how-we-work#advertising" className="underline underline-offset-2 hover:text-ink">Our advertising rules</Link>
      </p>
    </aside>
  )
}

/** A Google AdSense unit. Falls back to the house creative if Google's script is blocked. */
function GoogleAd({ format, personalised, fallback }: { format: AdFormat; personalised: boolean; fallback: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false)
  const pushed = useRef(false)
  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    loadAdSense()
      .then(() => requestAdSenseFill(personalised))
      .catch(() => setBlocked(true))
  }, [personalised])
  if (blocked) return <>{fallback}</>
  return (
    <div className={twMerge('w-full overflow-hidden', AD_FORMATS[format].minH)}>
      <ins
        className="adsbygoogle block"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOTS[format]}
        data-ad-format={format === 'infeed' ? 'fluid' : 'auto'}
        data-full-width-responsive="true"
      />
    </div>
  )
}

function Creative({ ad, format }: { ad: CreativeData; format: AdFormat }) {
  const row = format === 'leaderboard' || format === 'infeed'
  return (
    <MotionLink
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      to={`${offersPath(ad.category)}#${ad.id}`}
      className={twMerge('group flex w-full p-5', row ? 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:py-4' : 'flex-col justify-between gap-6', AD_FORMATS[format].minH)}
      style={{ background: ad.bg, color: ad.fg }}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-semibold opacity-80">{ad.name}</p>
        <p className={twMerge('mt-1 font-semibold leading-tight tracking-[-0.015em]', format === 'halfpage' ? 'text-[30px]' : format === 'mpu' ? 'text-[22px]' : 'text-lg')}>
          {ad.line}
        </p>
      </div>
      <span
        className="flex-none self-start whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-transform duration-150 group-hover:translate-x-0.5"
        style={{ borderColor: ad.accent, color: ad.accent }}
      >
        {ad.cta} →
      </span>
    </MotionLink>
  )
}

/** "About this advert": who paid, why it is here, and what the reader can do about it. */
export function AdInfoModal({ ad, onClose }: { ad: AdInfo | null; onClose: () => void }) {
  const { openCookieSettings } = useSiteActions()
  const [consent] = useStoredValue('ma-consent', '')
  // Keep the last advert on screen while the modal animates out.
  const last = useRef<AdInfo | null>(null)
  if (ad) last.current = ad
  const info = ad ?? last.current
  const personalised = consent === 'all'

  return (
    <Modal open={!!ad} onClose={onClose} title="About this advert">
      {info && (
        <>
          <AdTag />
          <h2 className="mt-3 pr-8 text-[28px] font-extrabold tracking-[-0.03em]">About this advert</h2>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 text-[15px]">
            {[
              ['Paid for by', info.sponsor],
              ['Format', `${info.format}, ${info.size}`],
              ['Shown on', info.placement],
              [
                'Why you see it',
                personalised
                  ? 'It was booked for this part of the site. You allowed advertising cookies, so our ad partner may also choose adverts for you.'
                  : 'It was booked for this part of the site. It is not based on you: advertising cookies are off.',
              ],
              ['Status', 'Placeholder advertiser. The ad server is not connected in this preview.'],
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="border-t border-rule py-2.5 text-muted">{k}</dt>
                <dd className="border-t border-rule py-2.5">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="mt-4 text-[14.5px] text-muted">
            Adverts are sold separately from the newsroom. Sponsors cannot buy coverage, see stories before they publish, or change what is reported.{' '}
            <TextLink to="/how-we-work#advertising" onClick={onClose} className="text-ink">Our advertising rules</TextLink>
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {info.onHide && (
              <Button
                size="sm"
                onClick={() => {
                  info.onHide?.()
                  onClose()
                }}
              >
                Hide this advert
              </Button>
            )}
            <Button
              size="sm"
              variant="line"
              onClick={() => {
                onClose()
                openCookieSettings()
              }}
            >
              Cookie settings
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

/**
 * Anchored advert for phones and tablets: slides up from the bottom edge once the reader has
 * scrolled a screen, and stays closed for the visit once dismissed.
 */
export function AnchorAd({ enabled }: { enabled: boolean }) {
  const ad = CREATIVES[1]
  const { openAdInfo } = useSiteActions()
  const [closed, setClosed] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 1.5)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {enabled && scrolled && !closed && (
        <motion.aside
          aria-label={`Advertisement: ${ad.name}`}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-[52] flex items-stretch border-t border-rule shadow-[0_-12px_32px_-16px_rgba(14,20,36,.4)] lg:hidden"
          style={{ background: ad.bg, color: ad.fg }}
        >
          <Link to={`${offersPath(ad.category)}#${ad.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <AdTag className="bg-white/15 text-[9.5px]">Ad</AdTag>
                <span className="truncate text-[11.5px] opacity-80">Paid for by {ad.name}</span>
              </span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold">{ad.line}</span>
            </span>
            <span className="flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold" style={{ borderColor: ad.accent, color: ad.accent }}>
              {ad.cta}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => openAdInfo({ sponsor: ad.name, format: 'Anchor', size: '320 × 50', placement: 'the bottom edge of the screen, phones and tablets', onHide: () => setClosed(true) })}
            aria-label="About this advert"
            className="flex w-9 flex-none items-center justify-center font-serif text-[15px] italic opacity-80 hover:opacity-100"
          >
            i
          </button>
          <button type="button" onClick={() => setClosed(true)} aria-label="Close advert" className="flex w-10 flex-none items-center justify-center text-xl opacity-80 hover:opacity-100">
            ×
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
