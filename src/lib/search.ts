/**
 * Site search. One index over everything a reader might look for: stories, photographs,
 * videos, trending subjects, desks, upcoming dates and advertiser offers.
 *
 * It runs in the browser over the story snapshot, so results are instant as you type. When a
 * search service is connected, keep `SearchFilters` and `SearchResults` and have `runSearch`
 * call it; the search panel only depends on these types.
 */
import { AGENDA, AgendaItem, CATEGORIES, Category, CategoryId, STORIES, Story } from '@/data'
import { storyMedia } from '@/data/media'
import { ADVERTISERS, Advertiser, Offer } from '@/data/offers'
import { TREND_TOPICS, TREND_VIDEOS, TrendTopic, TrendVideo } from '@/data/trends'

export type SearchType = 'all' | 'stories' | 'videos' | 'photos' | 'topics' | 'dates' | 'offers'
export type SearchSort = 'relevance' | 'newest' | 'oldest'

export type SearchFilters = {
  desk: CategoryId | 'all'
  type: SearchType
  /** ISO dates, yyyy-mm-dd. Empty means no limit. */
  from: string
  to: string
  sort: SearchSort
  /** Only stories that still have open questions */
  openOnly: boolean
}

export const DEFAULT_FILTERS: SearchFilters = { desk: 'all', type: 'all', from: '', to: '', sort: 'relevance', openOnly: false }

export type StoryHit = { story: Story; score: number; snippet: string }
export type SearchResults = {
  stories: StoryHit[]
  photos: Story[]
  videos: TrendVideo[]
  topics: TrendTopic[]
  desks: Category[]
  dates: AgendaItem[]
  offers: { advertiser: Advertiser; offer: Offer }[]
  counts: Record<SearchType, number>
}

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Words of a query, lower-cased and accent-folded. */
export const termsOf = (query: string) => fold(query).split(/[^a-z0-9$%.]+/).filter((t) => t.length > 0)

const has = (text: string, terms: string[]) => {
  const t = fold(text)
  return terms.every((x) => t.includes(x))
}

/** How well a story matches: the headline counts most, then tags and topic, then the body. */
function scoreStory(s: Story, terms: string[]) {
  const h = fold(s.h)
  const tags = fold(`${s.tags} ${s.sub} ${s.cats.join(' ')} ${s.desk}`)
  const st = fold(s.st)
  const body = fold(`${s.what} ${s.why} ${s.ok.join(' ')} ${s.un.join(' ')} ${s.src.map((x) => x[1]).join(' ')}`)
  let score = 0
  for (const t of terms) {
    const word = new RegExp(`(^|[^a-z0-9])${t.replace(/[.$]/g, '\\$&')}`)
    if (h.includes(t)) score += word.test(h) ? 6 : 4
    else if (tags.includes(t)) score += 3
    else if (st.includes(t)) score += 2
    else if (body.includes(t)) score += 1
    else return 0
  }
  return score
}

/** A short passage around the first place the query appears in the story text. */
function snippetFor(s: Story, terms: string[]) {
  if (!terms.length) return s.st
  const passages = [s.st, s.what, ...s.ok, ...s.un, s.why]
  const hit = passages.find((p) => terms.some((t) => fold(p).includes(t))) ?? s.st
  if (hit.length <= 170) return hit
  const at = Math.max(0, fold(hit).indexOf(terms.find((t) => fold(hit).includes(t)) ?? '') - 60)
  return (at > 0 ? '…' : '') + hit.slice(at, at + 170).trim() + '…'
}

export function runSearch(query: string, f: SearchFilters): SearchResults {
  const terms = termsOf(query)
  const inDesk = (cats: CategoryId[]) => f.desk === 'all' || cats.includes(f.desk)

  let stories: StoryHit[] = STORIES.filter((s) => inDesk(s.cats))
    .filter((s) => (!f.from || s.d >= f.from) && (!f.to || s.d <= f.to))
    .filter((s) => !f.openOnly || s.un.length > 0)
    .map((s) => ({ story: s, score: terms.length ? scoreStory(s, terms) : 1, snippet: snippetFor(s, terms) }))
    .filter((x) => x.score > 0)

  const byDate = (a: StoryHit, b: StoryHit) => b.story.d.localeCompare(a.story.d)
  if (f.sort === 'newest' || !terms.length) stories.sort(byDate)
  else if (f.sort === 'oldest') stories.sort((a, b) => -byDate(a, b))
  else stories.sort((a, b) => b.score - a.score || byDate(a, b))
  if (f.sort === 'oldest') stories.sort((a, b) => -byDate(a, b))

  const matchedIds = new Set(stories.map((x) => x.story.id))
  const photos = stories.map((x) => x.story).filter((s) => storyMedia(s.id))
  const videos = TREND_VIDEOS.filter((v) => (terms.length ? has(`${v.title} ${v.alt}`, terms) || matchedIds.has(v.storyId) : true)).filter(
    (v) => f.desk === 'all' || STORIES.find((s) => s.id === v.storyId)?.cats.includes(f.desk)
  )
  const topics = TREND_TOPICS.filter((t) => f.desk === 'all' || t.cat === f.desk).filter((t) => !terms.length || has(`${t.label} ${t.query}`, terms) || matchedIds.has(t.storyIds[0]))
  const desks = terms.length ? CATEGORIES.filter((c) => has(`${c.name} ${c.blurb}`, terms)) : []
  const dates = AGENDA.filter((a) => inDesk(a[3]) && (terms.length ? has(`${a[1]} ${a[2]}`, terms) || matchedIds.has(a[4]) : true)).filter(
    (a) => (!f.from || a[0] >= f.from) && (!f.to || a[0] <= f.to)
  )
  const offers = terms.length
    ? ADVERTISERS.flatMap((advertiser) => advertiser.offers.map((offer) => ({ advertiser, offer }))).filter(({ advertiser, offer }) =>
        has(`${advertiser.name} ${advertiser.category} ${advertiser.line} ${offer.title} ${offer.detail}`, terms)
      )
    : []

  const counts: Record<SearchType, number> = {
    stories: stories.length,
    photos: photos.length,
    videos: videos.length,
    topics: topics.length,
    dates: dates.length,
    offers: offers.length,
    all: stories.length + videos.length + topics.length + dates.length + offers.length,
  }
  return { stories, photos, videos, topics, desks, dates, offers, counts }
}

/* ---------- The address of a search ---------- */

/** /search?q=cop31&desk=climate&type=videos … Only non-default values are written. */
export function searchPath(query: string, f: Partial<SearchFilters> = {}) {
  const p = new URLSearchParams()
  if (query.trim()) p.set('q', query.trim())
  if (f.desk && f.desk !== 'all') p.set('desk', f.desk)
  if (f.type && f.type !== 'all') p.set('type', f.type)
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.sort && f.sort !== 'relevance') p.set('sort', f.sort)
  if (f.openOnly) p.set('open', '1')
  const qs = p.toString()
  return qs ? `/search?${qs}` : '/search'
}

const TYPES: SearchType[] = ['all', 'stories', 'videos', 'photos', 'topics', 'dates', 'offers']
const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Read a search back from the address, ignoring anything that is not a valid value. */
export function parseSearch(params: URLSearchParams): { query: string; filters: SearchFilters } {
  const desk = params.get('desk')
  const type = params.get('type') as SearchType
  const sort = params.get('sort') as SearchSort
  return {
    query: params.get('q') ?? '',
    filters: {
      desk: CATEGORIES.some((c) => c.id === desk) ? (desk as CategoryId) : 'all',
      type: TYPES.includes(type) ? type : 'all',
      from: isDate(params.get('from')) ? params.get('from')! : '',
      to: isDate(params.get('to')) ? params.get('to')! : '',
      sort: ['newest', 'oldest'].includes(sort) ? sort : 'relevance',
      openOnly: params.get('open') === '1',
    },
  }
}
