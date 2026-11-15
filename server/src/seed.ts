/**
 * First-run content. If the stories table is empty, load the 15 November 2026 snapshot that
 * the website was built with, so the API serves a full edition from the first request.
 * It never overwrites: once there is content, the dashboard is the only way it changes.
 */
import * as snapshot from '../../src/data/snapshot'
import { STORY_COUNTRIES } from '../../src/data/geo'
import { TREND_TOPICS } from '../../src/data/trends'
import { one, pool, q } from './db'
import { slugify } from './slug'

const WIRE: [string, string, string, string, string][] = [
  ['Climate', 'climate', 'COP31: finance working group resumes after overnight session in Antalya.', 's-cop31', 'update'],
  ['Sport', 'sport', 'CAF Women’s Champions League final kicks off in Suez.', 's-cafw', 'update'],
  ['World', 'world', 'New Zealand Electoral Commission confirms special-vote count is on schedule for 27 November.', 's-nz', 'confirmed'],
  ['Business', 'business', 'Brent crude feed still stale: last provider update 6 November.', 's-oil', 'data'],
  ['Sport', 'sport', 'AFCON 2027 qualifiers: 12 of 48 matchday-four fixtures completed.', 's-afcon', 'result'],
  ['Health', 'health', 'WHO situation report on DR Congo cholera due Tuesday.', 's-cholera', 'update'],
  ['Tech', 'tech', 'US court sets hearing date in AI impersonation fraud case.', 's-fraud', 'update'],
  ['Culture', 'culture', 'Godzilla Minus Zero holds the North American top spot on Saturday estimates.', 's-godzilla', 'result'],
  ['Africa', 'africa', 'South Africa: final local-election turnout confirmed at 52%.', 's-safrica', 'confirmed'],
  ['Sport', 'sport', 'Premier League snapshot refreshed after ten matches: Arsenal lead on 27 points.', 's-epl', 'data'],
  ['Africa', 'africa', 'AGOA: access for Rwanda and South Africa still due to end on 1 January.', 's-agoa', 'update'],
  ['Tech', 'tech', 'Blue Origin: next New Glenn launch now listed for 2027.', 's-space', 'confirmed'],
]

export async function seed() {
  const { n } = (await one<{ n: string }>('SELECT count(*) AS n FROM stories'))!
  if (Number(n) > 0) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const used = new Set<string>()
    for (const s of snapshot.S as any[]) {
      let slug = slugify(s.h)
      if (used.has(slug)) slug = `${slug}-${s.id.replace(/^s-/, '')}`
      used.add(slug)
      // The topic within a section lives in a separate table in the snapshot; fold it into the story.
      const story = { ...s, sub: s.sub ?? (snapshot as any).SUB?.[s.id] ?? '', countries: STORY_COUNTRIES[s.id] ?? [] }
      await client.query('INSERT INTO stories (id, slug, data, cats, tier, story_date) VALUES ($1, $2, $3, $4, $5, $6)', [s.id, slug, JSON.stringify(story), s.cats, s.tier, s.d])
    }
    const content: Record<string, unknown> = {
      categories: snapshot.CATS,
      tiers: snapshot.TIER,
      viz: snapshot.V,
      agenda: snapshot.AGENDA,
      keyFigures: snapshot.KEY,
      epl: snapshot.EPL,
      nba: snapshot.NBA,
      searchTopics: snapshot.TOPICS,
      trendTopics: TREND_TOPICS,
    }
    for (const [key, data] of Object.entries(content)) await client.query('INSERT INTO content (key, data) VALUES ($1, $2)', [key, JSON.stringify(data)])
    const now = Date.now()
    for (const [i, [desk, cat, text, storyId, kind]] of WIRE.entries()) {
      await client.query('INSERT INTO wire_items (at, desk, cat, text, story_id, kind) VALUES ($1, $2, $3, $4, $5, $6)', [new Date(now - (WIRE.length - i) * 6 * 60000), desk, cat, text, storyId, kind])
    }
    await client.query('COMMIT')
    console.log(`Seeded ${(snapshot.S as any[]).length} stories, ${Object.keys(content).length} content sets and ${WIRE.length} wire items`)
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

/** The topic of each story within its section ("COP31", "Elections"…), where the snapshot lists it separately. */
export async function storyCount() {
  return Number((await q<{ n: string }>('SELECT count(*) AS n FROM stories'))[0].n)
}

/**
 * Stories loaded before country tags existed get them now, from the snapshot's list. It only
 * fills in stories that have none, so anything an editor has set is left alone.
 */
export async function backfillCountries() {
  let n = 0
  for (const [id, countries] of Object.entries(STORY_COUNTRIES)) {
    const r = await q("UPDATE stories SET data = jsonb_set(data, '{countries}', $2::jsonb) WHERE id = $1 AND NOT (data ? 'countries') RETURNING id", [id, JSON.stringify(countries)])
    n += r.length
  }
  if (n) console.log(`Tagged ${n} stories with the countries they are about`)
}
