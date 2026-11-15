/**
 * Which country edition the reader gets.
 *
 * Order of trust:
 *  1. The reader's own choice (the edition picker), stored in this browser.
 *  2. A location lookup: our own API (GET /api/v1/geo), which knows the country when a CDN or
 *     proxy in front of the site supplies it, then an optional geo endpoint (see below).
 *  3. The device's time zone (or, only if the device reports none, the region of its language).
 *  4. The international edition.
 *
 * Steps 3 and 4 need no network and reveal nothing to anyone. For IP-accurate detection in
 * production, either:
 *  - have the host inject the country (Vercel `x-vercel-ip-country`, Cloudflare `CF-IPCountry`)
 *    into the page as `<meta name="ma-country" content="RW">`, or
 *  - set VITE_GEO_ENDPOINT to a URL that returns JSON with a `country` or `country_code` field.
 */
import { useEffect } from 'react'

import { COUNTRIES, Country, TIMEZONE_COUNTRY, getCountry } from '@/data/countries'
import { api, apiOnline } from '@/lib/api'
import { useStoredValue } from '@/lib/store'

const known = (code: string | null | undefined) => (code && COUNTRIES.some((c) => c.code === code.toUpperCase()) ? code.toUpperCase() : null)

/** Best guess from the device alone. */
export function detectCountry(): string {
  try {
    const meta = known(document.querySelector<HTMLMetaElement>('meta[name="ma-country"]')?.content)
    if (meta) return meta
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (zone) {
      // A time zone we have no edition for means "international". The language setting is not
      // consulted here: "en-GB" is the phone default in many countries and would mislead.
      return known(TIMEZONE_COUNTRY[zone]) ?? 'INT'
    }
    for (const lang of navigator.languages ?? [navigator.language]) {
      const region = known(lang.split('-')[1])
      if (region) return region
    }
  } catch {
    /* fall through */
  }
  return 'INT'
}

const GEO_ENDPOINT = import.meta.env.VITE_GEO_ENDPOINT as string | undefined
let lookedUp = false

/**
 * The reader's edition. `chosen` is true when they picked it themselves.
 * Returns [country, setCountry, { chosen, reset }].
 */
export function useEdition(): [Country, (code: string) => void, { chosen: boolean; reset: () => void }] {
  const [choice, setChoice] = useStoredValue('ma-country', '')
  const [looked, setLooked] = useStoredValue('ma-country-geo', '')

  // Location lookup, once per visit, unless the reader has chosen an edition themselves. Our own
  // API answers first (it knows the country when a CDN or proxy in front of the site supplies
  // it); a separate geo endpoint is used only if one is configured.
  useEffect(() => {
    if (lookedUp || choice) return
    if (!apiOnline && !GEO_ENDPOINT) return
    lookedUp = true
    const ask = apiOnline ? api<{ country: string | null }>('/geo').catch(() => ({ country: null })) : Promise.resolve({ country: null })
    ask
      .then((own) => (own.country || !GEO_ENDPOINT ? own : fetch(GEO_ENDPOINT).then((r) => r.json())))
      .then((d) => {
        const code = known(d.country_code ?? d.country ?? d.countryCode)
        if (code) setLooked(code)
      })
      .catch(() => {})
  }, [choice])

  const code = known(choice) ?? known(looked) ?? detectCountry()
  return [getCountry(code), setChoice, { chosen: !!known(choice), reset: () => setChoice('') }]
}
