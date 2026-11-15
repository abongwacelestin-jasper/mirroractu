/**
 * The engine that keeps "Trending on the web" fresh without ever leaning on a source too hard.
 *
 * Every list (one per source and country) has its own next-fetch time. A few times a minute
 * the engine looks at what is due and makes at most one request per source. How it decides:
 *
 *   Demand     Lists that readers are looking at, or for countries with measured readers, are
 *              refreshed at the source's normal pace. Lists nobody has asked for drift to a
 *              third of that. A country asked for the first time jumps the queue.
 *   Change     A list that came back the same is checked a little less often each time; one
 *              that changed goes back to the normal pace.
 *   Spacing    Requests to one source are never closer together than its gap.
 *   Budget     Each source has a daily allowance. If the day's use is running ahead of the
 *              clock, every list for that source slows down; if it is spent, fetching stops
 *              until tomorrow.
 *   Slow down  When a source says "too many requests", the whole source is paused, the pause
 *              doubles if it happens again, and the gap between requests is widened. It
 *              narrows again only after a run of clean answers.
 *   Failure    A list that errors is retried later and later (doubling), on its own.
 *   Never out  A failed or paused fetch never removes anything: the last good list keeps
 *              being served, marked with its age, until it is replaced or too old to trust.
 *
 * Only one API instance runs the engine at a time (a database lock decides which), so adding
 * instances does not multiply the requests. Everything it knows is in the database, so a
 * restart carries on where it left off.
 */
import type pg from 'pg'

import { COUNTRIES, getCountry } from '../../../src/data/geo'
import { bump, cached } from '../cache'
import { config } from '../config'
import { one, pool, q } from '../db'
import { RateLimited, SOURCES, Source, WebTrend, clusterArticles, sourceById } from './sources'

const TICK_MS = 3000
const LOCK_KEY = 778201
const enabledSources = () => SOURCES.filter((s) => config.webTrendsSources.includes(s.id))
const lastRequest = new Map<string, number>()
let leader: pg.PoolClient | null = null

/* ---------- Words that must never appear ---------- */

const ALWAYS_BLOCKED = /\b(porn\w*|xxx|xnxx|xvideos|xhamster|sex\s?(tape|video)s?|nude[s]?|onlyfans|escort[s]?|hentai|casino|betting tips|bet of the day)\b/i
/** Betting companies' own sites often appear as the "related headline" for football searches. The search term stays; their link does not. */
const GAMBLING = /sportpesa|betfred|betika|betway|1xbet|bet365|betking|sportybet|odibets|mozzart|paddypower|williamhill|ladbrokes|draftkings|fanduel|\bbet\w*\.(com|co|ke|ng|za)/i
let blockedCache: { at: number; list: string[] } = { at: 0, list: [] }
async function blockedTerms() {
  if (Date.now() - blockedCache.at > 30000) blockedCache = { at: Date.now(), list: (((await one<{ data: string[] }>("SELECT data FROM content WHERE key = 'webTrendsBlocked'"))?.data ?? []) as string[]).map((t) => t.toLowerCase()) }
  return blockedCache.list
}
const clean = (items: WebTrend[], blocked: string[]) =>
  items
    .filter((i) => !ALWAYS_BLOCKED.test(i.title) && !blocked.some((b) => i.title.toLowerCase().includes(b)))
    .map((i) => (i.headline && (ALWAYS_BLOCKED.test(i.headline.title) || ALWAYS_BLOCKED.test(i.headline.url) || GAMBLING.test(`${i.headline.url} ${i.headline.publisher}`) || blocked.some((b) => i.headline!.title.toLowerCase().includes(b))) ? { ...i, headline: undefined } : i))

/* ---------- Start-up ---------- */

async function ensureRows() {
  for (const s of SOURCES) {
    await q('INSERT INTO web_trend_sources (source) VALUES ($1) ON CONFLICT DO NOTHING', [s.id])
    // Spread first fetches out, so a fresh start does not ask for everything at once.
    await q(
      `INSERT INTO web_trend_feeds (source, country, next_at)
       SELECT $1, c, now() + (row_number() OVER () * $3::int) * interval '1 second' FROM unnest($2::text[]) AS c
       ON CONFLICT DO NOTHING`,
      [s.id, s.countries, Math.ceil(s.gapMs / 1000) + 1]
    )
  }
}

/** Become the one instance that fetches, if nobody else is. Holds a database lock while it runs. */
async function tryLead() {
  if (leader) return true
  const client = await pool.connect()
  try {
    const r = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY])
    if (r.rows[0].ok) {
      leader = client
      client.on('error', () => {
        leader = null
      })
      console.log('Web trends: this instance is fetching')
      return true
    }
  } catch {
    /* fall through */
  }
  client.release()
  return false
}

/* ---------- One fetch ---------- */

type Feed = { source: string; country: string; items: WebTrend[]; status: string; mode: string | null; interval_s: number; fails: number; wanted_recently: boolean; has_readers: boolean }

const jitter = (seconds: number) => Math.round(seconds * (0.9 + Math.random() * 0.2))

/** How much to slow a source down because of today's allowance. Infinity: stop until tomorrow. */
async function budgetFactor(source: Source) {
  const used = Number((await one<{ requests: number }>('SELECT requests FROM web_trend_usage WHERE source = $1 AND day = current_date', [source.id]))?.requests ?? 0)
  const budget = config.webTrendsBudget[source.id] ?? 1000
  if (used >= budget) return Infinity
  const now = new Date()
  const dayPart = Math.max(0.05, (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400)
  // Ahead of an even spend by more than a tenth of the budget: slow down in proportion.
  const ahead = used / budget - dayPart
  return ahead > 0.1 ? 1 + ahead * 6 : 1
}

async function count(source: string, column: 'requests' | 'errors' | 'limited') {
  await q(`INSERT INTO web_trend_usage (source, ${column}) VALUES ($1, 1) ON CONFLICT (source, day) DO UPDATE SET ${column} = web_trend_usage.${column} + 1`, [source])
}

async function runOne(source: Source, feed: Feed, slow: number) {
  lastRequest.set(source.id, Date.now())
  await count(source.id, 'requests')
  const demand = feed.wanted_recently || feed.has_readers || feed.country === '' ? 1 : 3
  try {
    const got = await source.fetch(feed.country, feed.mode)
    const items = clean(got.items, await blockedTerms())
    if (got.status === 'unsupported') {
      await q("UPDATE web_trend_feeds SET status = 'unsupported', fails = 0, last_error = NULL, next_at = now() + interval '3 days', interval_s = 259200 WHERE source = $1 AND country = $2", [source.id, feed.country])
      return
    }
    const same = JSON.stringify(items.map((i) => i.title)) === JSON.stringify((feed.items ?? []).map((i) => i.title))
    // Unchanged: check a little less often. Changed: back to the normal pace.
    const pace = same && feed.interval_s > 0 ? Math.min(source.maxS, feed.interval_s * 1.4) : source.baseS
    const interval = jitter(Math.min(source.maxS, Math.max(source.baseS * demand, pace) * slow))
    // An empty answer does not wipe a good list: the old one stays until it is too old to show.
    const keep = items.length === 0 && (feed.items ?? []).length > 0
    await q(
      `UPDATE web_trend_feeds SET items = CASE WHEN $3 THEN items ELSE $4::jsonb END, status = $5, mode = coalesce($6, mode), fails = 0, last_error = NULL,
         fetched_at = CASE WHEN $3 THEN fetched_at ELSE now() END, changed_at = CASE WHEN $7 THEN changed_at ELSE now() END,
         interval_s = $8::int, next_at = now() + make_interval(secs => $8::int)
       WHERE source = $1 AND country = $2`,
      [source.id, feed.country, keep, JSON.stringify(items), items.length ? 'ok' : 'empty', got.mode ?? null, same || keep, interval]
    )
    // A run of clean answers earns back a narrower gap, a tenth at a time.
    await q('UPDATE web_trend_sources SET cooldown_s = 0, gap_ms = CASE WHEN gap_ms > $2 THEN greatest($2, (gap_ms * 0.9)::int) ELSE gap_ms END WHERE source = $1', [source.id, source.gapMs])
    if (!same && !keep) await bump('webtrends')
  } catch (e: any) {
    if (e instanceof RateLimited) {
      await count(source.id, 'limited')
      const row = await one<{ cooldown_s: number; gap_ms: number }>('SELECT cooldown_s, gap_ms FROM web_trend_sources WHERE source = $1', [source.id])
      const pause = Math.min(6 * 3600, Math.max(e.retryAfterS ?? 0, row?.cooldown_s ? row.cooldown_s * 2 : 300))
      const gap = Math.min(120000, Math.max(source.gapMs, row?.gap_ms ?? 0) * 2)
      await q('UPDATE web_trend_sources SET cooldown_s = $2::int, cooldown_until = now() + make_interval(secs => $2::int), gap_ms = $3 WHERE source = $1', [source.id, pause, gap])
      // This feed simply waits its turn again once the pause is over.
      await q('UPDATE web_trend_feeds SET last_error = $3, next_at = now() + make_interval(secs => $4::int) WHERE source = $1 AND country = $2', [source.id, feed.country, `Asked to slow down (${e.message})`, pause + Math.round(Math.random() * 120)])
      console.warn(`Web trends: ${source.id} asked us to slow down. Pausing ${Math.round(pause / 60)} min, gap now ${Math.round(gap / 1000)}s`)
      return
    }
    await count(source.id, 'errors')
    if (config.logLevel === 'debug') console.warn(`Web trends: ${source.id} ${feed.country || 'world'} failed:`, e?.cause?.message ?? e?.message ?? e)
    const fails = feed.fails + 1
    // Ten minutes, then twenty, forty… up to six hours. Most failures are a passing network fault.
    const wait = jitter(Math.min(6 * 3600, 600 * 2 ** Math.min(fails - 1, 6)))
    await q("UPDATE web_trend_feeds SET status = CASE WHEN jsonb_array_length(items) > 0 THEN status ELSE 'error' END, fails = $3, last_error = $4, next_at = now() + make_interval(secs => $5::int) WHERE source = $1 AND country = $2", [source.id, feed.country, fails, String(e?.cause?.message ? `${e.message}: ${e.cause.message}` : (e?.message ?? e)).slice(0, 300), wait])
  }
}

async function tick() {
  if (!config.webTrends || !(await tryLead())) return
  const state = new Map((await q<{ source: string; enabled: boolean; cooling: boolean; gap_ms: number }>('SELECT source, enabled, coalesce(cooldown_until > now(), false) AS cooling, gap_ms FROM web_trend_sources')).map((r) => [r.source, r]))
  await Promise.all(
    enabledSources().map(async (source) => {
      const s = state.get(source.id)
      if (!s?.enabled || s.cooling) return
      if (Date.now() - (lastRequest.get(source.id) ?? 0) < Math.max(source.gapMs, s.gap_ms)) return
      const slow = await budgetFactor(source)
      if (slow === Infinity) return
      // The most wanted list that is due: asked for by a reader first, then the longest overdue.
      const feed = await one<Feed>(
        `SELECT f.source, f.country, f.items, f.status, f.mode, f.interval_s, f.fails,
                coalesce(f.wanted_at > now() - interval '24 hours', false) AS wanted_recently,
                EXISTS (SELECT 1 FROM events e WHERE e.country = f.country AND e.at > now() - interval '7 days') AS has_readers
         FROM web_trend_feeds f WHERE f.source = $1 AND f.next_at <= now() AND f.country = ANY($2)
         ORDER BY (f.wanted_at > now() - interval '24 hours') DESC NULLS LAST, f.next_at LIMIT 1`,
        [source.id, source.countries]
      )
      if (feed) await runOne(source, feed, slow)
    })
  )
}

export async function startWebTrends() {
  if (!config.webTrends) {
    console.log('Web trends: off (WEB_TRENDS=off)')
    return
  }
  await ensureRows()
  let busy = false
  setInterval(() => {
    if (busy) return
    busy = true
    tick()
      .catch((e) => console.warn('Web trends: tick failed', e?.message ?? e))
      .finally(() => {
        busy = false
      })
  }, TICK_MS).unref()
  console.log(`Web trends: engine started (${enabledSources().map((s) => s.id).join(', ')})`)
}

/* ---------- Demand ---------- */

const wantedAt = new Map<string, number>()
/** A reader asked for this country's lists. Refresh them ahead of ones nobody is looking at. */
export function want(country: string | null) {
  if (!country || Date.now() - (wantedAt.get(country) ?? 0) < 10 * 60000) return
  wantedAt.set(country, Date.now())
  // Never fetched, or drifting slowly because nobody wanted it: bring the next fetch forward.
  q("UPDATE web_trend_feeds SET wanted_at = now(), next_at = CASE WHEN status = 'new' OR (status IN ('ok', 'empty') AND interval_s > 7200) THEN least(next_at, now()) ELSE next_at END WHERE country = $1", [country]).catch(() => {})
}

/* ---------- Reading ---------- */

export type WebList = { source: string; label: string; about: string; credit: { name: string; url: string }; fetchedAt: string | null; items: (WebTrend & { places?: string[] })[] }
export type WebLevel = { level: 'country' | 'region' | 'global'; name: string; lists: WebList[] }
type Row = { source: string; country: string; items: WebTrend[]; fetched_at: Date | null }

const key = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Combine several countries' lists into one: what appears in the most places comes first. */
function combine(source: Source, rows: Row[], least: number): WebList['items'] {
  if (source.id === 'gdelt') {
    // The same story reported in several countries is one story: group again across them.
    const again = clusterArticles(rows.flatMap((r) => r.items.map((i) => ({ title: i.title, url: i.url, domain: `${r.country}:${new URL(i.url).hostname}` }))))
    return again.slice(0, 10).map((i) => ({ ...i, note: i.note.includes('outlets') ? i.note : new URL(i.url).hostname.replace(/^www\./, '') }))
  }
  const merged = new Map<string, { item: WebTrend; places: Set<string>; weight: number }>()
  for (const r of rows)
    for (const i of r.items) {
      const k = key(i.title)
      const m = merged.get(k) ?? { item: i, places: new Set<string>(), weight: 0 }
      m.places.add(r.country)
      m.weight += i.weight
      if (i.weight > m.item.weight) m.item = i
      merged.set(k, m)
    }
  const all = [...merged.values()].sort((a, b) => b.places.size - a.places.size || b.weight - a.weight)
  const shared = all.filter((m) => m.places.size >= least)
  return (shared.length >= 5 ? shared : all).slice(0, 10).map((m) => {
    const places = [...m.places].map((c) => getCountry(c).name)
    return { ...m.item, weight: m.weight, places, note: m.places.size > 1 ? `In ${places.slice(0, 3).join(', ')}${places.length > 3 ? ` and ${places.length - 3} more` : ''}` : `${m.item.note} · ${places[0]}` }
  })
}

/** Country, region and worldwide lists from every source that is switched on. */
export async function webTrends(code: string | undefined): Promise<{ country: string | null; levels: WebLevel[] }> {
  const country = code ? COUNTRIES.find((c) => c.code === code.toUpperCase() && c.code !== 'INT') : undefined
  want(country?.code ?? null)
  return cached('webtrends', `levels:${country?.code ?? 'none'}`, 60, async () => {
    const on = new Set((await q<{ source: string }>('SELECT source FROM web_trend_sources WHERE enabled')).map((r) => r.source))
    const sources = enabledSources().filter((s) => on.has(s.id))
    const blocked = await blockedTerms()
    const rows = (await q<Row & { age_s: number }>("SELECT source, country, items, fetched_at, extract(epoch FROM now() - fetched_at)::int AS age_s FROM web_trend_feeds WHERE fetched_at IS NOT NULL AND jsonb_array_length(items) > 0"))
      .filter((r) => r.age_s < (sourceById(r.source)?.keepS ?? 0))
      .map((r) => ({ ...r, items: clean(r.items, blocked) }))
    const newest = (rs: Row[]) => rs.reduce<string | null>((a, r) => (r.fetched_at && (!a || new Date(r.fetched_at) > new Date(a)) ? new Date(r.fetched_at).toISOString() : a), null)
    const list = (s: Source, items: WebList['items'], fetchedAt: string | null): WebList => ({ source: s.id, label: s.label, about: s.about, credit: s.credit, fetchedAt, items })
    const level = (lvl: WebLevel['level'], name: string, build: (s: Source) => WebList | null): WebLevel => ({ level: lvl, name, lists: sources.map(build).filter((l): l is WebList => !!l && l.items.length > 0) })

    const levels: WebLevel[] = []
    if (country) {
      levels.push(level('country', country.name, (s) => {
        const r = rows.find((x) => x.source === s.id && x.country === country.code)
        return r ? list(s, r.items.slice(0, 10), newest([r])) : null
      }))
      if (country.region) {
        const members = new Set(COUNTRIES.filter((c) => c.region === country.region).map((c) => c.code))
        levels.push(level('region', country.region, (s) => {
          const rs = rows.filter((x) => x.source === s.id && members.has(x.country))
          return rs.length ? list(s, combine(s, rs, 2), newest(rs)) : null
        }))
      }
    }
    levels.push(level('global', 'Global', (s) => {
      const own = rows.find((x) => x.source === s.id && x.country === '')
      if (own) return list(s, own.items.slice(0, 10), newest([own]))
      const rs = rows.filter((x) => x.source === s.id && x.country !== '')
      return rs.length ? list(s, combine(s, rs, 3), newest(rs)) : null
    }))
    return { country: country?.code ?? null, levels: levels.filter((l) => l.lists.length > 0) }
  })
}

/* ---------- For the dashboard ---------- */

export async function engineStatus() {
  const usage = await q<{ source: string; requests: number; errors: number; limited: number }>('SELECT source, requests, errors, limited FROM web_trend_usage WHERE day = current_date')
  const state = await q<{ source: string; enabled: boolean; cooldown_until: Date | null; gap_ms: number }>('SELECT source, enabled, cooldown_until, gap_ms FROM web_trend_sources')
  const feeds = await q<{ source: string; country: string; status: string; n: number; fetched_at: Date | null; next_at: Date; interval_s: number; fails: number; last_error: string | null; mode: string | null; wanted: boolean }>(
    "SELECT source, country, status, jsonb_array_length(items) AS n, fetched_at, next_at, interval_s, fails, last_error, mode, coalesce(wanted_at > now() - interval '24 hours', false) AS wanted FROM web_trend_feeds ORDER BY source, country"
  )
  return {
    running: config.webTrends,
    sources: SOURCES.map((s) => {
      const st = state.find((x) => x.source === s.id)
      const u = usage.find((x) => x.source === s.id)
      const mine = feeds.filter((f) => f.source === s.id)
      return {
        id: s.id,
        label: s.label,
        credit: s.credit,
        configured: config.webTrendsSources.includes(s.id),
        enabled: st?.enabled ?? true,
        pausedUntil: st?.cooldown_until && new Date(st.cooldown_until) > new Date() ? st.cooldown_until : null,
        gapS: Math.round(Math.max(s.gapMs, st?.gap_ms ?? 0) / 1000),
        normalGapS: Math.round(s.gapMs / 1000),
        budget: config.webTrendsBudget[s.id] ?? 0,
        requestsToday: u?.requests ?? 0,
        errorsToday: u?.errors ?? 0,
        slowDownsToday: u?.limited ?? 0,
        lists: { total: mine.length, ok: mine.filter((f) => f.n > 0).length, waiting: mine.filter((f) => f.status === 'new').length, unsupported: mine.filter((f) => f.status === 'unsupported').length, failing: mine.filter((f) => f.fails > 0).length },
      }
    }),
    feeds: feeds.map((f) => ({ ...f, name: f.country ? getCountry(f.country).name : 'Worldwide' })),
    blocked: (((await one<{ data: string[] }>("SELECT data FROM content WHERE key = 'webTrendsBlocked'"))?.data ?? []) as string[]),
  }
}

export async function setSourceEnabled(source: string, enabled: boolean) {
  await q('UPDATE web_trend_sources SET enabled = $2 WHERE source = $1', [source, enabled])
  await bump('webtrends')
}
export async function setBlocked(terms: string[]) {
  await q("INSERT INTO content (key, data) VALUES ('webTrendsBlocked', $1::jsonb) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", [JSON.stringify(terms)])
  blockedCache = { at: 0, list: [] }
  await bump('webtrends')
}
/**
 * Queue every list of a source (or of all sources) for fetching. Nothing is fetched at once:
 * the engine works through the queue at each source's own pace, inside its allowance.
 * With `reset`, the saved lists are emptied first, so everything on the site is rebuilt from
 * fresh answers; until each one arrives, that list is simply absent.
 */
export async function syncAll(source: string | null, reset: boolean) {
  const rows = await q<{ source: string }>(
    `UPDATE web_trend_feeds SET next_at = now(), fails = 0, last_error = NULL${reset ? ", items = '[]', status = 'new', fetched_at = NULL, changed_at = NULL, interval_s = 0, mode = NULL" : ", status = CASE WHEN status = 'unsupported' THEN 'new' ELSE status END"}
     WHERE ($1::text IS NULL OR source = $1) RETURNING source`,
    [source]
  )
  if (reset) await bump('webtrends')
  // Roughly how long the queue will take, at each source's gap.
  const minutes = Math.max(...SOURCES.map((s) => Math.ceil((rows.filter((r) => r.source === s.id).length * s.gapMs) / 60000)), 0)
  return { queued: rows.length, minutes }
}

/** Lift a pause early. The source is asked again at its normal gap; if it still objects, it pauses again. */
export async function resumeSource(source: string) {
  await q('UPDATE web_trend_sources SET cooldown_until = NULL, cooldown_s = 0, gap_ms = 0 WHERE source = $1', [source])
}

/** Ask for one list now. It still waits for the source's gap, pause and allowance. */
export async function refreshNow(source: string, country: string) {
  await q('UPDATE web_trend_feeds SET next_at = now(), wanted_at = now() WHERE source = $1 AND country = $2', [source, country])
}
