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

export const storyPath = (id: string) => `/story/${id}`
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
