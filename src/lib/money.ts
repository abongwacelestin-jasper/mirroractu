/**
 * Prices in the reader's own currency. Advertisers quote in US dollars; the reader's edition
 * (their country) decides which currency to show, and the API supplies today's exchange rates.
 * A converted price is always marked as approximate and shown with the dollar price it came from.
 */
import { useEffect, useState } from 'react'

import { CURRENCY_NAMES, FALLBACK_RATES, currencyOf } from '@/data/currency'
import { api, apiOnline } from '@/lib/api'
import { useEdition } from '@/lib/edition'

type Rates = { asOf: string | null; source: 'live' | 'built-in'; rates: Record<string, number> }
let current: Rates = { asOf: null, source: 'built-in', rates: FALLBACK_RATES }
let asked = false
const listeners = new Set<(r: Rates) => void>()

function load() {
  if (asked || !apiOnline) return
  asked = true
  api<Rates>('/rates')
    .then((r) => {
      if (!r?.rates) return
      current = { asOf: r.asOf, source: r.source, rates: { ...FALLBACK_RATES, ...r.rates } }
      listeners.forEach((l) => l(current))
    })
    .catch(() => {})
}

/** Round to a figure people quote: 274,050 becomes 274,000; 143.6 becomes 144. */
const tidy = (n: number) => {
  if (n < 1000) return Math.round(n)
  const step = Math.pow(10, Math.floor(Math.log10(n)) - 2)
  return Math.round(n / step) * step
}
const USD = /\$\s?([\d,]+(?:\.\d+)?)/g

export function useMoney() {
  const [country] = useEdition()
  const [rates, setRates] = useState(current)
  useEffect(() => {
    listeners.add(setRates)
    load()
    setRates(current)
    return () => void listeners.delete(setRates)
  }, [])

  const currency = currencyOf(country.code)
  const rate = rates.rates[currency] ?? 1
  const local = currency !== 'USD' && rate > 0
  const fmt = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

  return {
    currency,
    currencyName: CURRENCY_NAMES[currency] ?? currency,
    country,
    /** True when prices are being converted from dollars. */
    local,
    rate,
    source: rates.source,
    asOf: rates.asOf,
    /** "$189" becomes "RWF 274,000". Text without a dollar amount ("Free", "Variable rate") is left alone. */
    price: (text: string) => (local ? text.replace(USD, (_m, n: string) => fmt(tidy(Number(n.replace(/,/g, '')) * rate))) : text),
    /** The dollar price a converted one came from, e.g. "about, from $189". Empty when nothing was converted. */
    from: (text: string) => (local && text.match(USD) ? `about, from ${text.match(USD)!.join(' and ')}` : ''),
    /** One dollar in the reader's currency, e.g. "RWF 1,452". */
    perDollar: () => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: rate < 20 ? 2 : 0 }).format(rate),
  }
}
