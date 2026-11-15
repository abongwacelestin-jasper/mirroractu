/**
 * Country editions. A reader's country decides which stories lead their feed, which offers
 * they see first and which languages are suggested.
 *
 * Detection (lib/edition.ts) picks the country; `storiesNear` does the curation. When a CMS is
 * connected, send the country code with the request (e.g. `/api/stories?country=RW`) and let the
 * server curate; the functions here are the client-side stand-in over the story snapshot.
 */
import { Country, STORY_COUNTRIES, getCountry } from './geo'
import { STORIES, Story, newestFirst } from './index'

export * from './geo'


/** The countries a story is about: set on the story by an editor, or from the snapshot's list. */
export const storyCountries = (s: Story) => (s as Story & { countries?: string[] }).countries ?? STORY_COUNTRIES[s.id] ?? []
const isLocal = (s: Story, code: string) => storyCountries(s).includes(code)

function isRegional(s: Story, c: Country) {
  if (!c.region) return false
  if (c.region === 'Africa' && s.cats.includes('africa')) return true
  return storyCountries(s).some((code) => getCountry(code).region === c.region)
}

/**
 * Stories for a country: those about it, then those from its region. `scope` says which of
 * the two the list starts with, so the heading can read "In Rwanda" or "Across Africa".
 */
export function storiesNear(code: string, max = 8): { scope: 'country' | 'region' | 'none'; label: string; stories: Story[] } {
  const c = getCountry(code)
  if (c.code === 'INT') return { scope: 'none', label: '', stories: [] }
  const local = newestFirst(STORIES.filter((s) => isLocal(s, c.code)))
  const regional = newestFirst(STORIES.filter((s) => !isLocal(s, c.code) && isRegional(s, c)))
  const the = ['US', 'GB', 'AE'].includes(c.code) ? 'the ' : ''
  if (local.length) return { scope: 'country', label: `In ${the}${c.name}`, stories: [...local, ...regional].slice(0, max) }
  if (regional.length) return { scope: 'region', label: c.region === 'Africa' ? 'Across Africa' : `Across ${c.region === 'Americas' ? 'the Americas' : c.region}`, stories: regional.slice(0, max) }
  return { scope: 'none', label: '', stories: [] }
}

/** Feed boost: 3 for a story about the reader's country, 1 for one from their region. */
export function nearScore(s: Story, code: string) {
  const c = getCountry(code)
  if (c.code === 'INT') return 0
  return isLocal(s, c.code) ? 3 : isRegional(s, c) ? 1 : 0
}
