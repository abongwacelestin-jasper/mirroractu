/**
 * Typed access to the MirrorActu story snapshot.
 * The raw records live in snapshot.ts (hand-compiled 15 Nov 2026); in production
 * this module is the seam to replace with CMS / API calls.
 */
import * as raw from '@/data/snapshot'

export type CategoryId = 'world' | 'africa' | 'business' | 'tech' | 'climate' | 'health' | 'culture' | 'sport'
export type Tier = 'low' | 'medium' | 'high'

export type Category = { id: CategoryId; name: string; blurb: string }

/** [role, label, url?] */
export type Source = [string, string, string?]

export type Story = {
  id: string
  cats: CategoryId[]
  tier: Tier
  /** ISO date, yyyy-mm-dd */
  d: string
  /** Optional display date that overrides `d` */
  dl?: string
  desk: string
  /** Headline */
  h: string
  /** Standfirst */
  st: string
  what: string
  ok: string[]
  un: string[]
  why: string
  src: Source[]
  tags: string
  /** Topic within the section */
  sub: string
  /** ISO codes of the countries this story is about. Drives country and region trends. */
  countries?: string[]
}

export type VizSpec =
  | { k: 'bars'; cap: string; src: string; rows: [string, number, string, number?][] }
  | { k: 'div'; cap: string; src: string; rows: [string, number, string][] }
  | { k: 'prog'; p: number; cap: string; src: string }
  | { k: 'fig'; n: string; c: string }
  | { k: 'seats' }
  | { k: 'scale' }
  | { k: 'scores' }

/** [date, label, title, categories, storyId] */
export type AgendaItem = [string, string, string, CategoryId[], string]
/** [value, caption, storyId] */
export type KeyFigure = [string, string, string]

export const CATEGORIES: Category[] = raw.CATS as any
export const TIERS: Record<Tier, [string, string]> = raw.TIER as any
export const STORIES: Story[] = raw.S as any
export const VIZ: Record<string, VizSpec> = raw.V as any
export const SEARCH_TOPICS: [string, string][] = raw.TOPICS as any
/** [club, won, drawn, lost, points] */
export const EPL_TABLE: [string, number, number, number, number][] = raw.EPL as any
/** [home, homeScore, awayScore, away] */
export const NBA_RESULTS: [string, number, number, string][] = raw.NBA as any
export const KEY_FIGURES: Record<CategoryId, KeyFigure[]> = raw.KEY as any
export const AGENDA: AgendaItem[] = raw.AGENDA as any

export const BRIEF_IDS = ['s-cop31', 's-agoa', 's-nz', 's-safrica', 's-asia', 's-fraud', 's-godzilla', 's-afcon']
export const EDITION_DATE = 'Sunday 15 November 2026'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const getStory = (id: string | undefined) => STORIES.find((s) => s.id === id)
export const getCategory = (id: string | undefined) => CATEGORIES.find((c) => c.id === id)
export const categoryName = (id: CategoryId) => getCategory(id)?.name ?? id

export const formatDate = (iso: string, withYear = false) => {
  const [y, m, d] = iso.split('-')
  return `${+d} ${MONTHS[+m - 1]}${withYear ? ' ' + y : ''}`
}
export const storyDate = (s: Story, withYear = false) => s.dl || formatDate(s.d, withYear)
export const newestFirst = (list: Story[]) => [...list].sort((a, b) => b.d.localeCompare(a.d))
export const storiesIn = (c: CategoryId) => newestFirst(STORIES.filter((s) => s.cats.includes(c)))

/* ---------- URLs ----------
   Story addresses are readable slugs made from the headline:
     /story/cop31-opens-in-antalya-as-scientists-warn-of-a-1-5c-overshoot
   Internal ids ("s-cop31") never appear in links. An old id link still works and is redirected
   to the slug, so nothing shared earlier breaks. When a CMS is connected, store the slug with the
   story (so a later headline edit does not move the page) and return it from `storySlug`. */

/** "COP31 opens in Antalya…" → "cop31-opens-in-antalya". Accents folded, max 72 characters, cut at a word. */
export function slugify(text: string) {
  const base = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'‘]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (base.length <= 72) return base
  const cut = base.slice(0, 72)
  return cut.slice(0, cut.lastIndexOf('-'))
}

const SLUG_BY_ID = new Map<string, string>()
const ID_BY_SLUG = new Map<string, string>()

/** Work out each story's address. A slug supplied with the story (from the API) wins over one made from the headline. */
function indexSlugs() {
  SLUG_BY_ID.clear()
  ID_BY_SLUG.clear()
  for (const s of STORIES) {
    let slug = (s as Story & { slug?: string }).slug || slugify(s.h)
    // Two stories must never share an address.
    if (ID_BY_SLUG.has(slug)) slug = `${slug}-${s.id.replace(/^s-/, '')}`
    SLUG_BY_ID.set(s.id, slug)
    ID_BY_SLUG.set(slug, s.id)
  }
}
indexSlugs()

/** What GET /api/v1/bootstrap returns. */
export type Edition = {
  stories: Story[]
  categories?: Category[]
  tiers?: Record<Tier, [string, string]>
  viz?: Record<string, VizSpec>
  agenda?: AgendaItem[]
  keyFigures?: Record<CategoryId, KeyFigure[]>
  epl?: typeof EPL_TABLE
  nba?: typeof NBA_RESULTS
  searchTopics?: [string, string][]
}

const refill = <T,>(target: T[], source?: T[]) => {
  if (!source) return
  target.length = 0
  target.push(...source)
}
const reassign = <T extends object>(target: T, source?: T) => {
  if (!source) return
  for (const k of Object.keys(target)) delete (target as any)[k]
  Object.assign(target, source)
}

/**
 * Replace the bundled snapshot with an edition from the API. It runs once, before the first
 * render, and changes the exported lists in place, so every page reads the live edition
 * without knowing where it came from. If the API is unreachable the snapshot stays.
 */
export function hydrate(edition: Edition) {
  if (!edition?.stories?.length) return
  refill(STORIES, edition.stories)
  refill(CATEGORIES, edition.categories)
  refill(AGENDA, edition.agenda)
  refill(EPL_TABLE, edition.epl)
  refill(NBA_RESULTS, edition.nba)
  refill(SEARCH_TOPICS, edition.searchTopics)
  reassign(TIERS, edition.tiers)
  reassign(VIZ, edition.viz)
  reassign(KEY_FIGURES, edition.keyFigures)
  indexSlugs()
}

export const storySlug = (id: string) => SLUG_BY_ID.get(id) ?? id
export const storyPath = (id: string) => `/story/${storySlug(id)}`

/** Find a story from the last part of its address: a slug, or an old-style id. */
export function resolveStory(param: string | undefined): { story?: Story; canonical: boolean } {
  if (!param) return { canonical: false }
  const bySlug = ID_BY_SLUG.get(param)
  if (bySlug) return { story: getStory(bySlug), canonical: true }
  return { story: getStory(param), canonical: false }
}
export const sectionPath = (id: CategoryId) => `/${id}`

export function searchStories(query: string, category: CategoryId | 'all') {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  let r = newestFirst(STORIES)
  if (category !== 'all') r = r.filter((s) => s.cats.includes(category))
  if (!terms.length) return r.slice(0, 6)
  return r.filter((s) => {
    const hay = `${s.h} ${s.st} ${s.what} ${s.tags} ${s.cats.join(' ')}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}
