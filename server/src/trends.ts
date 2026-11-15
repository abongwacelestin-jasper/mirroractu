/**
 * Today's trends, at three levels that widen from the reader outwards:
 *
 *   country   what matters where the reader is
 *   region    their part of the world
 *   global    everyone
 *
 * A subject scores on four things: stories filed about this place, stories filed at all,
 * activity on the wire in the last 24 hours, and how many measured readers from this place
 * read it in the last 24 hours. The narrower the level, the more weight the place carries, so
 * a country's list is led by what is about that country and read there, and falls back
 * smoothly to regional and world subjects when little is local.
 *
 * Readership comes only from readers who allowed measurement. A country with few of them is
 * ranked mostly by coverage, which is said plainly in the `basis` field.
 */
import { COUNTRIES, STORY_COUNTRIES, getCountry } from '../../src/data/geo'
import { cached } from './cache'
import { one, q } from './db'

type Topic = { id: string; label: string; query: string; cat: string; storyIds: string[] }
export type TrendItem = Topic & {
  rank: number
  moved: number
  score: number
  wireCount: number
  activeNow: boolean
  /** Measured readers in this level's area, last 24 hours */
  readers: number
  /** Stories on this subject that are about this level's area */
  localStories: number
  /** Why it is on this list: about this place, read in this place, or simply big everywhere */
  basis: 'local' | 'read-here' | 'wider'
}
export type TrendLevel = { level: 'country' | 'region' | 'global'; name: string; code?: string; measuredReaders: number; trends: TrendItem[] }

const log = (n: number) => 2 * Math.log2(1 + n)

async function inputs() {
  const topics = ((await one<{ data: Topic[] }>("SELECT data FROM content WHERE key = 'trendTopics'"))?.data ?? []) as Topic[]
  const stories = await q<{ id: string; countries: string[] | null }>("SELECT id, data->'countries' AS countries FROM stories WHERE published")
  const wire = await q<{ story_id: string; n: string }>("SELECT story_id, count(*) AS n FROM wire_items WHERE at > now() - interval '24 hours' AND story_id IS NOT NULL GROUP BY story_id")
  const latest = (await q<{ story_id: string }>('SELECT story_id FROM wire_items ORDER BY at DESC LIMIT 5')).map((r) => r.story_id)
  // Distinct measured readers per story and country, last 24 hours.
  const views = await q<{ story_id: string; country: string | null; n: string }>(
    "SELECT story_id, country, count(DISTINCT visitor) AS n FROM events WHERE type = 'view' AND at > now() - interval '24 hours' AND story_id IS NOT NULL GROUP BY story_id, country"
  )
  return { topics, stories, wire, latest, views }
}

function rank(data: Awaited<ReturnType<typeof inputs>>, scope: { level: TrendLevel['level']; countries: Set<string> | null }) {
  const published = new Map(data.stories.map((s) => [s.id, s.countries ?? STORY_COUNTRIES[s.id] ?? []]))
  const wireBy = new Map(data.wire.map((w) => [w.story_id, Number(w.n)]))
  const inScope = (code: string | null) => scope.countries === null || (code !== null && scope.countries.has(code))
  const readersBy = new Map<string, number>()
  for (const v of data.views) if (inScope(v.country)) readersBy.set(v.story_id, (readersBy.get(v.story_id) ?? 0) + Number(v.n))

  const base = [...data.topics].sort((a, b) => b.storyIds.length - a.storyIds.length).map((t) => t.id)
  // How much the place counts for, against how big the subject is everywhere.
  const weight = scope.level === 'country' ? { local: 3, readers: 1.5, coverage: 0.35 } : scope.level === 'region' ? { local: 1.5, readers: 1.25, coverage: 0.6 } : { local: 0, readers: 1, coverage: 1 }

  return data.topics
    .map((t) => {
      const ids = t.storyIds.filter((id) => published.has(id))
      const localStories = scope.countries ? ids.filter((id) => published.get(id)!.some((c) => scope.countries!.has(c))).length : ids.length
      const wireCount = ids.reduce((n, id) => n + (wireBy.get(id) ?? 0), 0)
      const readers = ids.reduce((n, id) => n + (readersBy.get(id) ?? 0), 0)
      const activeNow = ids.some((id) => data.latest.includes(id))
      const score = weight.local * localStories + weight.readers * log(readers) + weight.coverage * ids.length + 0.5 * wireCount + (activeNow ? 0.75 : 0)
      const basis: TrendItem['basis'] = scope.level === 'global' ? 'wider' : localStories > 0 ? 'local' : readers > 0 ? 'read-here' : 'wider'
      return { ...t, storyIds: ids, wireCount, readers, activeNow, localStories, basis, score: Math.round(score * 100) / 100 }
    })
    .filter((t) => t.storyIds.length > 0)
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ ...t, rank: i + 1, moved: base.indexOf(t.id) - i }))
}

/** The global ranking alone. */
export async function globalTrends(): Promise<TrendItem[]> {
  return cached('trends', 'global', 20, async () => rank(await inputs(), { level: 'global', countries: null }))
}

/**
 * The three levels for a country code. An unknown or missing code gives the global level only.
 * Cached for 20 seconds per country, so a busy country costs one calculation, not one per reader.
 */
export async function trendLevels(code: string | undefined): Promise<{ country: string | null; levels: TrendLevel[] }> {
  const country = code ? COUNTRIES.find((c) => c.code === code.toUpperCase() && c.code !== 'INT') : undefined
  return cached('trends', `levels:${country?.code ?? 'none'}`, 20, async () => {
    const data = await inputs()
    const total = (set: Set<string> | null) => data.views.reduce((n, v) => n + (set === null || (v.country !== null && set.has(v.country)) ? Number(v.n) : 0), 0)
    const levels: TrendLevel[] = []
    if (country) {
      const own = new Set([country.code])
      levels.push({ level: 'country', name: country.name, code: country.code, measuredReaders: total(own), trends: rank(data, { level: 'country', countries: own }) })
      if (country.region) {
        const region = new Set(COUNTRIES.filter((c) => c.region === country.region).map((c) => c.code))
        levels.push({ level: 'region', name: country.region, measuredReaders: total(region), trends: rank(data, { level: 'region', countries: region }) })
      }
    }
    levels.push({ level: 'global', name: 'Global', measuredReaders: total(null), trends: rank(data, { level: 'global', countries: null }) })
    return { country: country?.code ?? null, levels }
  })
}

/** Countries with measured readers in the last 7 days, most first: for the dashboard's picker. */
export async function activeCountries() {
  const rows = await q<{ country: string; readers: string }>("SELECT country, count(DISTINCT visitor) AS readers FROM events WHERE at > now() - interval '7 days' AND country IS NOT NULL GROUP BY country ORDER BY readers DESC LIMIT 30")
  return rows.map((r) => ({ code: r.country, name: getCountry(r.country).code === 'INT' ? r.country : getCountry(r.country).name, readers: Number(r.readers) }))
}

/** The reader's country as supplied by a proxy or CDN in front of the site, if any. */
export function countryFromHeaders(headers: Record<string, unknown>): string | null {
  for (const h of ['x-country-code', 'cf-ipcountry', 'x-vercel-ip-country']) {
    const v = String(headers[h] ?? '').trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1') return v
  }
  return null
}
