/**
 * Exchange rates against the US dollar, for showing prices in a reader's own currency.
 * Fetched from RATES_URL (open.er-api.com by default: free, no key, updated daily), kept for
 * twelve hours in the cache, and replaced by the built-in table if the source cannot be reached.
 * Nothing about any reader is sent: it is one plain request from the server.
 */
import { cached } from './cache'
import { config } from './config'
import { FALLBACK_RATES } from '../../src/data/currency'

export type Rates = { base: 'USD'; asOf: string | null; source: 'live' | 'built-in'; rates: Record<string, number> }

const builtIn = (): Rates => ({ base: 'USD', asOf: null, source: 'built-in', rates: FALLBACK_RATES })
let failedAt = 0

export async function rates(): Promise<Rates> {
  if (config.ratesUrl === 'off' || Date.now() - failedAt < 10 * 60000) return builtIn()
  try {
    return await cached('rates', 'usd', 12 * 3600, async () => {
      const res = await fetch(config.ratesUrl, { signal: AbortSignal.timeout(8000) })
      const data: any = await res.json()
      if (!res.ok || typeof data?.rates !== 'object') throw new Error(`rates source answered ${res.status}`)
      // Only the currencies the site uses, and only sane numbers. Anything missing keeps its built-in rate.
      const live = Object.fromEntries(Object.keys(FALLBACK_RATES).map((c) => [c, Number(data.rates[c]) > 0 ? Number(data.rates[c]) : FALLBACK_RATES[c]]))
      const at = data.time_last_update_unix ? new Date(data.time_last_update_unix * 1000) : new Date()
      return { base: 'USD', asOf: at.toISOString(), source: 'live', rates: live } satisfies Rates
    })
  } catch (e: any) {
    failedAt = Date.now()
    console.warn(`Exchange rates: using the built-in table (${e?.message ?? e})`)
    return builtIn()
  }
}
