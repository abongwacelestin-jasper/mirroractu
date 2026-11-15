/**
 * The public site's real-time connection (GET /api/v1/live, a WebSocket). It carries the live
 * wire, and a nudge whenever the newsroom's trends, the outside trends or the edition change,
 * so open pages bring themselves up to date.
 *
 * The site only listens. It says one thing, once: which country edition it is showing, so the
 * newsroom can see where its readers are right now. That is sent only for readers who allowed
 * "Readership measurement"; everyone else is counted without a country.
 */
import { hasGlobalPrivacyControl, readConsent } from '@/lib/consent'
import { detectCountry } from '@/lib/edition'
import { LiveMessage, createSocket, useTopics } from '@/lib/socket'

const hello = () => {
  try {
    if (hasGlobalPrivacyControl() || readConsent()?.measurement !== true) return null
    const code = localStorage.getItem('ma-country') || localStorage.getItem('ma-country-geo') || detectCountry()
    return /^[A-Z]{2}$/.test(code) ? { t: 'hello', country: code } : null
  } catch {
    return null
  }
}

export const siteSocket = createSocket('/api/v1/live', hello)

/** Run `fn` when the API says one of these changed: 'trends', 'webtrends', 'content'. */
export const useSiteLive = (topics: string[], fn: (m: LiveMessage) => void, quietMs = 1200) => useTopics(siteSocket, topics, fn, quietMs)
