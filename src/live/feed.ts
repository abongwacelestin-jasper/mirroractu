/**
 * Live feeds: the wire and the market quotes.
 *
 * One shared connection feeds every component on the page, so the bar under the masthead, the
 * wire on the front page and the desk wire on a section page always show the same updates.
 *
 * In this build the provider is simulated: updates are drawn from a fixed pool on a timer and
 * market figures drift slightly. To go live, replace `connect()` with a websocket / SSE
 * subscription to the licensed providers and call `push()` and `setQuotes()` from its handlers.
 * Nothing else in the site needs to change.
 */
import { useMemo, useSyncExternalStore } from 'react'

import type { CategoryId } from '@/data'

export type WireKind = 'update' | 'confirmed' | 'result' | 'data'
export type WireItem = { id: number; time: string; desk: string; cat: CategoryId; text: string; storyId?: string; kind: WireKind }
export type Quote = { id: string; label: string; value: number; change: number; unit: string; digits: number; stale?: boolean; storyId?: string }
export type LiveStatus = 'connecting' | 'live'

type LiveState = { status: LiveStatus; items: WireItem[]; quotes: Quote[] }

const POOL: Omit<WireItem, 'id' | 'time'>[] = [
  { desk: 'Climate', cat: 'climate', text: 'COP31: finance working group resumes after overnight session in Antalya.', storyId: 's-cop31', kind: 'update' },
  { desk: 'Sport', cat: 'sport', text: 'CAF Women’s Champions League final kicks off in Suez.', storyId: 's-cafw', kind: 'update' },
  { desk: 'World', cat: 'world', text: 'New Zealand Electoral Commission confirms special-vote count is on schedule for 27 November.', storyId: 's-nz', kind: 'confirmed' },
  { desk: 'Business', cat: 'business', text: 'Brent crude feed still stale: last provider update 6 November.', storyId: 's-oil', kind: 'data' },
  { desk: 'Sport', cat: 'sport', text: 'AFCON 2027 qualifiers: 12 of 48 matchday-four fixtures completed.', storyId: 's-afcon', kind: 'result' },
  { desk: 'Health', cat: 'health', text: 'WHO situation report on DR Congo cholera due Tuesday.', storyId: 's-cholera', kind: 'update' },
  { desk: 'Tech', cat: 'tech', text: 'US court sets hearing date in AI impersonation fraud case.', storyId: 's-fraud', kind: 'update' },
  { desk: 'Culture', cat: 'culture', text: 'Godzilla Minus Zero holds the North American top spot on Saturday estimates.', storyId: 's-godzilla', kind: 'result' },
  { desk: 'Africa', cat: 'africa', text: 'South Africa: final local-election turnout confirmed at 52%.', storyId: 's-safrica', kind: 'confirmed' },
  { desk: 'Climate', cat: 'climate', text: 'Copernicus: November bulletin due 5 December.', storyId: 's-cop31', kind: 'data' },
  { desk: 'Sport', cat: 'sport', text: 'NBA: Phoenix v LA Lakers tips off at 23:00 Kigali time.', storyId: 's-nba', kind: 'update' },
  { desk: 'Sport', cat: 'sport', text: 'Premier League snapshot refreshed after ten matches: Arsenal lead on 27 points.', storyId: 's-epl', kind: 'data' },
  { desk: 'Africa', cat: 'africa', text: 'AGOA: access for Rwanda and South Africa still due to end on 1 January.', storyId: 's-agoa', kind: 'update' },
  { desk: 'Culture', cat: 'culture', text: 'Sunrise on the Reaping opens in cinemas on 20 November.', storyId: 's-hunger', kind: 'update' },
  { desk: 'Sport', cat: 'sport', text: 'CAF general assembly in Abuja confirmed for 21 November.', storyId: 's-caf', kind: 'confirmed' },
  { desk: 'World', cat: 'world', text: 'South Sudan’s general elections remain planned for December.', storyId: 's-abyei', kind: 'update' },
  { desk: 'Business', cat: 'business', text: 'Kospi and Nikkei quotes updating; weekly change shown beside each.', storyId: 's-asia', kind: 'data' },
  { desk: 'Tech', cat: 'tech', text: 'Blue Origin: next New Glenn launch now listed for 2027.', storyId: 's-space', kind: 'confirmed' },
  { desk: 'Africa', cat: 'africa', text: 'Sudan aid plan: funding tracker still shows less than half received.', storyId: 's-sudan', kind: 'data' },
  { desk: 'Health', cat: 'health', text: 'Generic HIV prevention drug: approved price stays at $40 a year.', storyId: 's-hiv', kind: 'confirmed' },
]

const BASE_QUOTES: Quote[] = [
  { id: 'brent', label: 'Brent crude', value: 97.83, change: -17, unit: '$', digits: 2, stale: true, storyId: 's-oil' },
  { id: 'gold', label: 'Gold, oz', value: 4074, change: 4.5, unit: '$', digits: 0, stale: true, storyId: 's-oil' },
  { id: 'kospi', label: 'Kospi', value: 2391.4, change: -8.7, unit: '', digits: 1, storyId: 's-asia' },
  { id: 'nikkei', label: 'Nikkei 225', value: 36210, change: -6.7, unit: '', digits: 0, storyId: 's-asia' },
  { id: 'temp', label: 'Global temp, Oct', value: 1.75, change: 0, unit: '+', digits: 2, storyId: 's-cop31' },
]

/** How long the simulated handshake takes, how often the wire files, how often quotes tick. */
const CONNECT_MS = 1300
const WIRE_MS = 9000
const QUOTE_MS = 4000
const KEEP = 40

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

let state: LiveState = { status: 'connecting', items: [], quotes: BASE_QUOTES }
const listeners = new Set<() => void>()
let timers: number[] = []
let next = 0

function set(patch: Partial<LiveState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

/** Add one update to the top of the wire. */
export function push(item: Omit<WireItem, 'id' | 'time'>, at = new Date()) {
  set({ items: [{ ...item, id: next++, time: clock(at) }, ...state.items].slice(0, KEEP) })
}

export function setQuotes(quotes: Quote[]) {
  set({ quotes })
}

function connect() {
  timers.push(
    window.setTimeout(() => {
      // Backfill: the whole pool, oldest first, spaced six minutes apart.
      const now = Date.now()
      const backfill = POOL.map((p, i) => ({ ...p, id: next++, time: clock(new Date(now - (POOL.length - i) * 6 * 60000)) })).reverse()
      set({ status: 'live', items: backfill })
      let n = 0
      timers.push(window.setInterval(() => push(POOL[n++ % POOL.length]), WIRE_MS))
      timers.push(
        window.setInterval(() => {
          setQuotes(
            state.quotes.map((q) => {
              if (q.stale || q.id === 'temp') return q
              const drift = (Math.random() - 0.5) * 0.004
              return { ...q, value: q.value * (1 + drift), change: +(q.change + drift * 100).toFixed(2) }
            })
          )
        }, QUOTE_MS)
      )
    }, CONNECT_MS)
  )
}

function disconnect() {
  timers.forEach((t) => {
    window.clearTimeout(t)
    window.clearInterval(t)
  })
  timers = []
  state = { status: 'connecting', items: [], quotes: BASE_QUOTES }
}

function subscribe(cb: () => void) {
  if (listeners.size === 0) connect()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) disconnect()
  }
}

const snapshot = () => state
const useLive = () => useSyncExternalStore(subscribe, snapshot, snapshot)

export const useLiveStatus = () => useLive().status

/** The wire, newest first. Narrow it to one desk or one story with `cat` / `storyId`. */
export function useWire({ max = 8, cat, storyId }: { max?: number; cat?: CategoryId; storyId?: string } = {}) {
  const { items, status } = useLive()
  const list = useMemo(
    () => items.filter((w) => (!cat || w.cat === cat) && (!storyId || w.storyId === storyId)).slice(0, max),
    [items, cat, storyId, max]
  )
  return { items: list, status }
}

/** Market quotes. Stale quotes stay still and say so. */
export const useMarkets = () => useLive().quotes

export const formatQuote = (q: Quote) =>
  q.id === 'temp' ? `+${q.value.toFixed(2)}°C` : `${q.unit}${q.value.toLocaleString('en-US', { minimumFractionDigits: q.digits, maximumFractionDigits: q.digits })}`

export const WIRE_KIND_LABEL: Record<WireKind, string> = { update: 'Update', confirmed: 'Confirmed', result: 'Result', data: 'Data' }
