/**
 * Engagement: which pages are opened, what is pressed, where readers arrive from and what they
 * search for. It runs only for readers who allowed "Readership measurement", never when the
 * browser sends Global Privacy Control, and what is sent is deliberately small:
 *   page    the path (nothing after "?"), and on the first page of a visit the *site* the
 *           reader came from (a host name such as "google.com", never the full address)
 *   click   a short label: "out:example.com" for a link leaving the site, "offer:…" for an
 *           advertiser offer, or the name an element gives itself with data-track="…"
 *   search  the words searched for (up to 60 characters) and how many results came back
 *   time    how many seconds a page was actually on screen, sent once when the reader leaves it
 * With each of those go two things about the visit, not the person:
 *   device  three broad words, such as "phone · Android · Chrome". No versions, no model.
 *   visit   a random code made here for this one visit. It links the pages of the visit to
 *           each other so a journey can be read. It is not built from an IP address, it is
 *           gone when the tab closes, and the next visit gets a new one.
 * No IP address is stored and no profile of a reader is built (see POST /events in the API).
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { api, apiOnline } from '@/lib/api'
import { hasGlobalPrivacyControl, readConsent } from '@/lib/consent'
import { detectCountry } from '@/lib/edition'

const allowed = () => apiOnline && !hasGlobalPrivacyControl() && readConsent()?.measurement === true

const country = () => {
  try {
    const code = localStorage.getItem('ma-country') || localStorage.getItem('ma-country-geo') || detectCountry()
    return /^[A-Z]{2}$/.test(code) ? code : undefined
  } catch {
    return undefined
  }
}

/** Broad categories only: enough to know whether the site works on phones, not to tell readers apart. */
function device() {
  const ua = navigator.userAgent
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const tablet = iPad || /Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
  const phone = !tablet && ((navigator as { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true || /Mobi|iPhone|iPod|Android.*Mobile/.test(ua))
  const os = /Android/.test(ua) ? 'Android' : iPad || /iPhone|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other'
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Other'
  return { device: tablet ? 'tablet' : phone ? 'phone' : 'desktop', os, browser }
}

/** This visit's code: random, kept only until the tab closes. */
function visit(): string | undefined {
  try {
    let id = sessionStorage.getItem('ma-visit')
    if (!id || !/^[a-z0-9]{10,24}$/.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => (b % 36).toString(36)).join('')
      sessionStorage.setItem('ma-visit', id)
    }
    return id
  } catch {
    return undefined
  }
}

/** What goes with every event: the edition's country, the language, the device words and the visit code. */
export const eventContext = () => ({ country: country(), lang: document.documentElement.lang || 'en', ...device(), visit: visit() })

export function track(type: 'page' | 'click' | 'search', data: { label?: string; ref?: string; value?: number } = {}) {
  if (!allowed()) return
  api('/events', { body: { type, path: location.pathname, ...eventContext(), ...data } }).catch(() => {})
}

/** The site a reader arrived from, as a bare host name. Empty for direct visits and our own pages. */
function arrivedFrom(): string | undefined {
  try {
    const tagged = new URLSearchParams(location.search).get('utm_source')
    if (tagged && /^[a-z0-9.-]{1,80}$/i.test(tagged)) return tagged.toLowerCase()
    if (!document.referrer) return undefined
    const host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, '')
    return host && host !== location.hostname.replace(/^www\./, '') && /^[a-z0-9.-]{1,80}$/.test(host) ? host : undefined
  } catch {
    return undefined
  }
}

/** What a click was on, or nothing if it is not worth counting. */
function labelFor(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined
  const named = target.closest<HTMLElement>('[data-track]')
  if (named?.dataset.track) return named.dataset.track.slice(0, 80)
  const link = target.closest<HTMLAnchorElement>('a[href]')
  if (!link) return undefined
  const href = link.getAttribute('href') ?? ''
  if (href.startsWith('mailto:')) return 'mailto'
  let url: URL
  try {
    url = new URL(link.href)
  } catch {
    return undefined
  }
  if (url.origin !== location.origin) return `out:${url.hostname.replace(/^www\./, '')}`.slice(0, 80)
  const offer = url.pathname.match(/\/offers\/(.+)$/)
  // Other links inside the site are counted as the page they open.
  return offer ? `offer:${offer[1]}`.slice(0, 80) : undefined
}

let firstPage = true

/** Call once, in the site layout: counts each page opened and the clicks worth knowing about. */
export function useEngagement(enabled: boolean) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!enabled) return
    track('page', firstPage ? { ref: arrivedFrom() } : {})
    firstPage = false
  }, [pathname, enabled])

  // Time on page: only the seconds the page was really on screen (a tab in the background does
  // not count), reported once, when the reader moves on or closes it. Capped at an hour.
  useEffect(() => {
    if (!enabled) return
    const path = pathname
    let since = document.visibilityState === 'visible' ? performance.now() : 0
    let total = 0
    let sent = false
    const pause = () => {
      if (since) total += performance.now() - since
      since = 0
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? (since = since || performance.now()) : pause())
    const report = () => {
      pause()
      const seconds = Math.min(3600, Math.round(total / 1000))
      if (sent || seconds < 2 || !allowed()) return
      sent = true
      const body = JSON.stringify({ type: 'time', path, ...eventContext(), value: seconds })
      // sendBeacon still goes out while a page is closing; fetch is the fallback.
      const queued = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/v1/events', new Blob([body], { type: 'application/json' }))
      if (!queued) fetch('/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', report)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', report)
      report()
    }
  }, [pathname, enabled])

  useEffect(() => {
    if (!enabled) return
    const onClick = (e: MouseEvent) => {
      const label = labelFor(e.target)
      if (label) track('click', { label })
    }
    document.addEventListener('click', onClick, { capture: true, passive: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [enabled])
}

/** A search, reported once the reader has stopped typing. */
export function useSearchTracking(query: string, results: number) {
  useEffect(() => {
    const q = query.trim().toLowerCase().slice(0, 60)
    if (q.length < 2) return
    const t = window.setTimeout(() => track('search', { label: q, value: results }), 1800)
    return () => window.clearTimeout(t)
  }, [query, results])
}
