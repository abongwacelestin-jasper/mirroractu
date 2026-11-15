/**
 * The three outside sources behind "Trending on the web", each reduced to the same small shape.
 *
 *   google     Google Trends' daily feed of trending searches, per country. Free and current to
 *              the minute, but undocumented: it can be switched off without touching the others.
 *   gdelt      The GDELT Project's index of world news. We ask for a country's last 24 hours of
 *              articles and rank the stories that the most separate outlets are reporting.
 *              Free, commercial use allowed with credit. Strictly rate limited.
 *   wikimedia  Wikipedia's most-read articles, yesterday. Public domain (CC0). Used for the
 *              worldwide list and for countries large enough to have their own.
 *
 * Nothing about any reader is sent to these services: each call is a plain request from the
 * server for a public list. No pictures are taken from them, so a reader's browser never
 * contacts them just by looking at the list.
 */
import { COUNTRIES, getCountry } from '../../../src/data/geo'
import { config } from '../config'

export type WebTrend = {
  title: string
  url: string
  /** Why it is on the list, in the source's own measure: "20,000+ searches", "7 outlets", "12,400 views" */
  note: string
  /** Size of that measure, for ranking when lists are combined */
  weight: number
  /** A headline about it and who published it, when the source gives one */
  headline?: { title: string; url: string; publisher: string }
}

export type Fetched = { status: 'ok' | 'empty' | 'unsupported'; items: WebTrend[]; mode?: string }
/** Thrown for answers that mean "slow down": the engine pauses the whole source. */
export class RateLimited extends Error {
  retryAfterS?: number
  constructor(message: string, retryAfterS?: number) {
    super(message)
    this.retryAfterS = retryAfterS
  }
}

export type Source = {
  id: 'google' | 'gdelt' | 'wikimedia'
  label: string
  /** Shown beside every list, with a link, as each source asks */
  credit: { name: string; url: string }
  /** What the list is, in a few words, for readers */
  about: string
  /** Countries it has a list for ('' is worldwide) */
  countries: string[]
  /** Shortest pause between two requests to this source */
  gapMs: number
  /** How often a feed in demand is refreshed, and the slowest it may drift to */
  baseS: number
  maxS: number
  /** A list older than this is not shown at all */
  keepS: number
  fetch: (country: string, mode: string | null) => Promise<Fetched>
}

const editions = COUNTRIES.filter((c) => c.code !== 'INT').map((c) => c.code)

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': config.webTrendsUserAgent, Accept: accept }, signal: AbortSignal.timeout(15000), redirect: 'follow' })
  if (res.status === 429 || res.status === 503) throw new RateLimited(`${res.status} from ${new URL(url).hostname}`, Number(res.headers.get('retry-after')) || undefined)
  return res
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .trim()
const tag = (xml: string, name: string) => decode(xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? '')
const http = (url: string) => (/^https?:\/\//i.test(url) ? url : '')

/* ---------- Google Trends ---------- */

/** "200+" → 200, "2K+" → 2000, "1M+" → 1000000 */
const traffic = (s: string) => {
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*([KM])?/i)
  return m ? Math.round(Number(m[1]) * (m[2]?.toUpperCase() === 'M' ? 1e6 : m[2]?.toUpperCase() === 'K' ? 1e3 : 1)) : 0
}

async function google(country: string): Promise<Fetched> {
  const res = await get(`https://trends.google.com/trending/rss?geo=${country}`, 'application/rss+xml, application/xml')
  if (res.status === 400 || res.status === 404) return { status: 'unsupported', items: [] }
  if (!res.ok) throw new Error(`Google Trends answered ${res.status}`)
  const xml = await res.text()
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]): WebTrend | null => {
    const title = tag(item, 'title')
    if (!title) return null
    const n = traffic(tag(item, 'ht:approx_traffic'))
    const news = item.match(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/)?.[1]
    const headlineUrl = news ? http(tag(news, 'ht:news_item_url')) : ''
    return {
      title,
      url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=${country}&date=now%207-d`,
      note: n ? `${n.toLocaleString('en')}+ searches` : 'Rising in search',
      weight: n,
      ...(news && headlineUrl ? { headline: { title: tag(news, 'ht:news_item_title'), url: headlineUrl, publisher: tag(news, 'ht:news_item_source') } } : {}),
    }
  })
  const list = items.filter((x): x is WebTrend => !!x).slice(0, 15)
  return { status: list.length ? 'ok' : 'empty', items: list }
}

/* ---------- GDELT ---------- */

/** GDELT names countries with FIPS codes, which differ from ISO for many of them. */
const FIPS: Record<string, string> = {
  RW: 'RW', KE: 'KE', UG: 'UG', TZ: 'TZ', BI: 'BY', CD: 'CG', ET: 'ET', SD: 'SU', SS: 'OD', EG: 'EG', MA: 'MO', NG: 'NI', GH: 'GH', SN: 'SG', CI: 'IV', CM: 'CM', ZA: 'SF', ZW: 'ZI',
  GB: 'UK', FR: 'FR', DE: 'GM', TR: 'TU', US: 'US', CA: 'CA', BR: 'BR', IN: 'IN', CN: 'CH', JP: 'JA', KR: 'KS', AE: 'AE', AU: 'AS', NZ: 'NZ',
}
const GDELT_NAME: Record<string, string> = { CD: 'congo', CI: 'ivory coast', GB: 'britain', US: 'united states', AE: 'emirates', KR: 'south korea', TR: 'turkey' }

const STOP = new Set(
  'the and for with from that this have has had are was were will been their they them his her its not but you your our out who what when where why how after over into about more than says said say new amid as at by in of on to a an is it be or vs via per les des une est que qui dans pour sur avec par aux du de la le et en au un'.split(' ')
)
const words = (title: string) => new Set(title.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))
/** GDELT stores titles with spaces around punctuation and often the site's name on the end. */
const tidy = (title: string) =>
  title
    .replace(/\s+([,.:;!?%)’”])/g, '$1')
    .replace(/([(“‘$£€])\s+/g, '$1')
    .replace(/\s+-\s+/g, '-')
    .replace(/\s+[|–—]\s+[^|–—]{2,40}$/u, '')
    .replace(/\s+/g, ' ')
    .trim()

type Article = { title: string; url: string; domain: string; language?: string }

/** Group articles that are the same story, and rank the stories by how many separate outlets carry them. */
export function clusterArticles(articles: Article[]): WebTrend[] {
  const groups: { tokens: Set<string>; items: (Article & { tokens: Set<string> })[] }[] = []
  for (const a of articles) {
    const tokens = words(a.title)
    if (tokens.size < 3) continue
    let best: (typeof groups)[number] | undefined
    let bestScore = 0
    for (const g of groups) {
      let shared = 0
      for (const t of tokens) if (g.tokens.has(t)) shared++
      const score = shared / Math.min(tokens.size, g.tokens.size)
      if (score > bestScore) [best, bestScore] = [g, score]
    }
    if (best && bestScore >= 0.5) {
      best.items.push({ ...a, tokens })
      for (const t of tokens) best.tokens.add(t)
    } else groups.push({ tokens: new Set(tokens), items: [{ ...a, tokens }] })
  }
  return groups
    .map((g) => {
      const outlets = new Set(g.items.map((i) => i.domain)).size
      // The plainest telling of the story: the shortest title of reasonable length.
      const lead = [...g.items].sort((a, b) => Math.abs(tidy(a.title).length - 70) - Math.abs(tidy(b.title).length - 70))[0]
      return { title: tidy(lead.title), url: http(lead.url), note: outlets > 1 ? `${outlets} outlets reporting` : lead.domain.replace(/^www\./, ''), weight: outlets * 10 + g.items.length, outlets }
    })
    .filter((t) => t.url && t.title.length > 12)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12)
    .map(({ outlets: _o, ...t }) => t)
}

async function gdelt(country: string, mode: string | null): Promise<Fetched> {
  const name = (GDELT_NAME[country] ?? getCountry(country).name).toLowerCase()
  // First choice: what the country's own press published. Small countries have few outlets in
  // the index, so if that proves thin the feed switches itself to "articles about the country".
  const about = mode === 'about'
  const query = about ? `${name.includes(' ') ? `"${name}"` : name} sourcelang:english` : `sourcecountry:${FIPS[country]}`
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&timespan=24h&format=json&maxrecords=75&sort=${about ? 'hybridrel' : 'datedesc'}`
  const res = await get(url, 'application/json')
  const text = await res.text()
  // GDELT sometimes answers "please slow down" with status 200 and a sentence instead of JSON.
  if (/limit requests/i.test(text.slice(0, 200))) throw new RateLimited('GDELT asked us to slow down')
  if (!res.ok) throw new Error(`GDELT answered ${res.status}`)
  let articles: Article[] = []
  try {
    articles = (JSON.parse(text).articles ?? []) as Article[]
  } catch {
    if (text.trim()) throw new Error('GDELT did not send JSON')
  }
  const seen = new Set<string>()
  const unique = articles.filter((a) => a?.title && a?.url && a?.domain && !seen.has(a.url) && seen.add(a.url))
  const items = clusterArticles(unique)
  const next = !about && unique.length < 8 ? 'about' : about ? 'about' : 'source'
  return { status: items.length ? 'ok' : 'empty', items, mode: next }
}

/* ---------- Wikimedia ---------- */

const NOT_ARTICLES = /^(Main_Page|Special:|Wikipedia:|Wikip[eé]dia:|File:|Portal:|Help:|Category:|Template:|Talk:|User:|Draft:|Spécial:|Fichier:|Portail:|Aide:|-$|404)/i
const wikiDate = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86400000)
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
}

async function wikimedia(country: string): Promise<Fetched> {
  // Yesterday's figures are published during the following day, so fall back a day if needed.
  for (const daysAgo of [1, 2]) {
    const url = country ? `https://wikimedia.org/api/rest_v1/metrics/pageviews/top-per-country/${country}/all-access/${wikiDate(daysAgo)}` : `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${wikiDate(daysAgo)}`
    const res = await get(url, 'application/json')
    if (res.status === 404) continue
    if (!res.ok) throw new Error(`Wikimedia answered ${res.status}`)
    const data: any = await res.json()
    const rows: { article: string; project?: string; views?: number; views_ceil?: number }[] = data?.items?.[0]?.articles ?? []
    const items = rows
      .filter((r) => r.article && !NOT_ARTICLES.test(r.article))
      .slice(0, 15)
      .map((r): WebTrend => {
        const views = r.views ?? r.views_ceil ?? 0
        return { title: decodeURIComponent(r.article).replace(/_/g, ' '), url: `https://${r.project ?? 'en.wikipedia'}.org/wiki/${encodeURIComponent(r.article)}`, note: `${views.toLocaleString('en')} views yesterday`, weight: views }
      })
    // A country's list is published only where enough people read: one or two articles is not a trend.
    return { status: items.length >= 5 ? 'ok' : 'empty', items: items.length >= 5 ? items : [] }
  }
  return { status: 'unsupported', items: [] }
}

export const SOURCES: Source[] = [
  { id: 'google', label: 'Searched on Google', credit: { name: 'Google Trends', url: 'https://trends.google.com/trending' }, about: 'Searches rising fastest today', countries: editions, gapMs: 4000, baseS: 30 * 60, maxS: 6 * 3600, keepS: 36 * 3600, fetch: (c) => google(c) },
  { id: 'gdelt', label: 'In the news', credit: { name: 'The GDELT Project', url: 'https://www.gdeltproject.org' }, about: 'Stories the most outlets are reporting, last 24 hours', countries: editions.filter((c) => FIPS[c]), gapMs: 20000, baseS: 45 * 60, maxS: 8 * 3600, keepS: 36 * 3600, fetch: gdelt },
  { id: 'wikimedia', label: 'Read on Wikipedia', credit: { name: 'Wikimedia pageviews', url: 'https://pageviews.wmcloud.org' }, about: 'Most-read articles yesterday', countries: ['', ...editions], gapMs: 3000, baseS: 6 * 3600, maxS: 24 * 3600, keepS: 72 * 3600, fetch: (c) => wikimedia(c) },
]
export const sourceById = (id: string) => SOURCES.find((s) => s.id === id)
