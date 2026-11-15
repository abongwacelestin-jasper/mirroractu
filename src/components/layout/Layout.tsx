import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'

import { AdInfo, SiteActions, SiteActionsContext } from '@/lib/actions'
import { dismissBoot, hasBootSplash } from '@/lib/boot'
import { usePageMeta } from '@/lib/meta'
import { useEngagement } from '@/lib/track'
import { startPwa } from '@/lib/pwa'
import { initReveal } from '@/lib/reveal'
import { useConsent } from '@/lib/consent'
import { alternateLinks, applyLocale } from '@/lib/translate'
import { usePreviewState } from '@/lib/preview'
import { useStoredValue } from '@/lib/store'
import { AdInfoModal, AnchorAd } from '@/components/ads/AdSlot'
import { Footer } from '@/components/layout/Footer'
import { LiveAlert, LiveBar } from '@/components/live/LiveFeed'
import { BrandSplash, PageSkeleton, SkeletonKind } from '@/components/loading/Loading'
import { Masthead } from '@/components/layout/Masthead'
import { TabBar } from '@/components/layout/TabBar'
import { ConsentModal } from '@/components/overlays/ConsentModal'
import { CorrectionModal, NewsletterModal, WelcomeModal } from '@/components/overlays/Popups'
import { EditionModal, LanguageOffer, TranslationBar } from '@/components/overlays/EditionModal'
import { PartnerPromo } from '@/components/overlays/PartnerPromo'
import { AppStatusBars, InstallPrompt } from '@/components/overlays/AppPrompts'
import { HousePromo } from '@/components/overlays/HousePromo'
import { TrendsModal } from '@/components/overlays/TrendsModal'
import { SearchDialog } from '@/components/layout/SearchDialog'
import { ToastProvider } from '@/components/overlays/Toast'

/**
 * SPLASH_MS: how long the React splash stays up where index.html has not already drawn one.
 * ROUTE_MS: minimum time a route skeleton shows, so a fast load does not flash.
 */
const SPLASH_MS = 900
const ROUTE_MS = 420
const WELCOME_AFTER_MS = 1500
/** Today's trends offers itself once a day, a little after arrival. */
const TRENDS_AFTER_MS = 12000
const DAY_MS = 24 * 60 * 60 * 1000

/** Pages that carry no advertising: the standards and legal pages. */
const AD_FREE = ['/how-we-work', '/legal']
const isAdFree = (path: string) => AD_FREE.includes(path) || path.startsWith('/offers') || path.startsWith('/newsletter')

/**
 * Shell for every route: splash, masthead, live bar, search, the page (or its skeleton), footer,
 * and every modal and popup. Components open those through `useSiteActions()`.
 */
export function Layout() {
  const preview = usePreviewState()
  usePageMeta()
  const { pathname } = useLocation()
  const [search, setSearch] = useState<{ open: boolean; query: string }>({ open: false, query: '' })
  const [booting, setBooting] = useState(() => !hasBootSplash())
  const [routeLoading, setRouteLoading] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [welcome, setWelcome] = useState(false)
  const [edition, setEdition] = useState(false)
  const [trends, setTrends] = useState(false)
  const [trendsSeen, setTrendsSeen] = useStoredValue('ma-trends-seen', '0')
  const [welcomeSeen, setWelcomeSeen] = useStoredValue('ma-welcome-seen', '')
  const [cookieSettings, setCookieSettings] = useState(false)
  const [adInfo, setAdInfo] = useState<AdInfo | null>(null)
  const [correction, setCorrection] = useState<{ open: boolean; storyTitle?: string }>({ open: false })
  const [nlSeen, setNlSeen] = useStoredValue('ma-nl-seen', '')
  const { decided: consent, allows } = useConsent()
  const translationAllowed = allows('translation')
  const first = useRef(true)

  const actions = useMemo<SiteActions>(
    () => ({
      openSearch: (query = '') => setSearch({ open: true, query }),
      openNewsletter: () => setNewsletter(true),
      openWelcome: () => setWelcome(true),
      openEdition: () => setEdition(true),
      openTrends: () => setTrends(true),
      openCookieSettings: () => setCookieSettings(true),
      openAdInfo: setAdInfo,
      openCorrection: (storyTitle) => setCorrection({ open: true, storyTitle }),
    }),
    []
  )

  useEffect(() => {
    dismissBoot()
    initReveal()
    startPwa()
    const t = window.setTimeout(() => setBooting(false), SPLASH_MS)
    return () => window.clearTimeout(t)
  }, [])

  // The page follows the language in its address, once the reader has allowed translation.
  useEffect(() => applyLocale(translationAllowed), [translationAllowed])
  useEffect(() => alternateLinks(), [pathname])
  // Pages and clicks are counted only once the reader has allowed measurement.
  useEngagement(preview === 'live' && allows('measurement'))

  // Each navigation shows the skeleton for the incoming page while it loads.
  useEffect(() => {
    window.scrollTo(0, 0)
    setSearch((s) => ({ ...s, open: false }))
    if (first.current) {
      first.current = false
      return
    }
    setRouteLoading(true)
    const t = window.setTimeout(() => setRouteLoading(false), ROUTE_MS)
    return () => window.clearTimeout(t)
  }, [pathname])

  // The morning-email modal offers itself once per reader, and only after the cookie choice
  // is made, so two popups never stack.
  // Popups queue: cookie choice first, then the welcome, then (much later) our own promo.
  useEffect(() => {
    if (welcomeSeen || !consent || preview !== 'live') return
    const t = window.setTimeout(() => setWelcome(true), WELCOME_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [welcomeSeen, consent, preview])

  useEffect(() => {
    const rested = Date.now() - Number(trendsSeen) > DAY_MS
    if (!welcomeSeen || welcome || !consent || !rested || preview !== 'live' || pathname === '/trends') return
    const t = window.setTimeout(() => setTrends(true), TRENDS_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [welcomeSeen, welcome, consent, trendsSeen, preview, pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        actions.openSearch()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [actions])

  const footerForm = useRef<HTMLFormElement>(null)
  const showSplash = preview === 'splash' || (preview === 'live' && booting)
  const showSkeleton = preview === 'skeleton' || (preview === 'live' && routeLoading)
  const skeleton = <PageSkeleton kind={skeletonFor(pathname)} />
  const popupsAllowed = preview === 'live' && consent

  return (
    <ToastProvider>
      <SiteActionsContext.Provider value={actions}>
        <div className="min-h-[100dvh] bg-white pb-[calc(60px+env(safe-area-inset-bottom))] pt-[var(--safe-top)] font-display text-base text-ink lg:pb-0">
          {/* Fills the notch and status-bar area, so the page never shows through behind it as it scrolls. */}
          <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[57] h-[var(--safe-top)] bg-ink" />
          {showSplash && <BrandSplash />}
          <a href="#content" className="absolute -left-[999px] top-0 z-[99] bg-signal px-3.5 py-2.5 text-ink focus:left-2 focus:top-2">
            Skip to content
          </a>
          <Masthead onSearch={() => actions.openSearch()} onSubscribe={actions.openNewsletter} />
          <AppStatusBars />
          <LiveBar />
          <TranslationBar />
          <SearchDialog
            open={search.open}
            query={search.query}
            onQueryChange={(query) => setSearch((s) => ({ ...s, query }))}
            onClose={() => setSearch((s) => ({ ...s, open: false }))}
          />
          <main id="content" tabIndex={-1} className="min-h-[60vh] outline-none" aria-busy={showSkeleton}>
            {/* Pages are code-split: Suspense shows the same skeleton while a page's code downloads. */}
            {showSkeleton ? (
              skeleton
            ) : (
              <Suspense fallback={skeleton}>
                {/* Opacity only: a transform here would break fixed children such as the reading bar. */}
                <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}>
                  <Outlet />
                </motion.div>
              </Suspense>
            )}
          </main>
          <Footer formRef={footerForm} onSearch={actions.openSearch} onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

          <NewsletterModal
            open={newsletter || preview === 'newsletter'}
            onClose={() => {
              setNewsletter(false)
              setNlSeen('1')
            }}
          />
          <WelcomeModal
            open={welcome}
            onClose={() => {
              setWelcome(false)
              setWelcomeSeen('1')
            }}
          />
          <TrendsModal
            open={trends}
            onClose={() => {
              setTrends(false)
              setTrendsSeen(String(Date.now()))
            }}
          />
          <EditionModal open={edition} onClose={() => setEdition(false)} />
          <AdInfoModal ad={adInfo} onClose={() => setAdInfo(null)} />
          <CorrectionModal open={correction.open} storyTitle={correction.storyTitle} onClose={() => setCorrection((c) => ({ ...c, open: false }))} />
          {preview === 'live' && <ConsentModal settingsOpen={cookieSettings} onSettings={setCookieSettings} />}
          <AnchorAd enabled={popupsAllowed && !isAdFree(pathname)} />
          <LiveAlert enabled={popupsAllowed} />
          <HousePromo enabled={popupsAllowed && !!welcomeSeen && !welcome && !newsletter && !edition && !trends} />
          <LanguageOffer enabled={popupsAllowed && !!welcomeSeen && !welcome && !newsletter && !edition && !trends} />
          <PartnerPromo enabled={popupsAllowed && !!welcomeSeen && !welcome && !newsletter && !edition && !trends && !isAdFree(pathname)} />
          <InstallPrompt enabled={popupsAllowed && !!welcomeSeen && !welcome && !newsletter && !edition && !trends} />
          <TabBar />
        </div>
      </SiteActionsContext.Provider>
    </ToastProvider>
  )
}

function skeletonFor(path: string): SkeletonKind {
  if (path === '/') return 'home'
  if (path.startsWith('/story/')) return 'story'
  if (['/brief', '/coming-up', '/live', '/saved', '/how-we-work', '/legal', '/trends', '/search'].includes(path) || path.startsWith('/offers')) return 'page'
  return 'section'
}
