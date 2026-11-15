/**
 * Engagement: which pages are opened, what is pressed, where readers arrive from and what they
 * search for. It runs only for readers who allowed "Readership measurement", never when the
 * browser sends Global Privacy Control, and what is sent is deliberately small:
 *   page    the path (nothing after "?"), and on the first page of a visit the *site* the
 *           reader came from (a host name such as "google.com", never the full address)
 *   click   a short label: "out:example.com" for a link leaving the site, "offer:…" for an
 *           advertiser offer, or the name an element gives itself with data-track="…"
 *   search  the words searched for (up to 60 characters) and how many results came back
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

export function track(type: 'page' | 'click' | 'search', data: { label?: string; ref?: string; value?: number } = {}) {
  if (!allowed()) return
  api('/events', { body: { type, path: location.pathname, country: country(), lang: document.documentElement.lang || 'en', ...data } }).catch(() => {})
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
