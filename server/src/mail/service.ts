/**
 * What the API does with email: the sign-up flow for the morning email, building and sending
 * an edition, and the sample data behind the dashboard's previews.
 */
import { randomBytes } from 'node:crypto'

import { ADVERTISERS } from '../../../src/data/offers'
import { getCountry } from '../../../src/data/geo'
import { one, q } from '../db'
import { publish } from '../bus'
import { trendLevels } from '../trends'
import { type Mail, type Outgoing, deskUrl, sendLater, sendMail, sendMany, siteUrl } from './send'
import * as T from './templates'

const site = (): T.Site => ({ site: siteUrl() })
export const newToken = () => randomBytes(24).toString('base64url')
export const confirmLink = (token: string) => `${siteUrl()}/newsletter/confirm?t=${token}`
export const unsubscribeLink = (token: string) => `${siteUrl()}/newsletter/unsubscribe?t=${token}`
/** Mail programs call this themselves when the reader presses their own "Unsubscribe" button (RFC 8058). */
const oneClick = (token: string) => `${siteUrl()}/api/v1/unsubscribe/one-click?t=${token}`
export const listHeaders = (token: string) => ({ 'List-Unsubscribe': `<${oneClick(token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })

export const ref = (prefix: 'C' | 'E', id: number | string) => `MA-${prefix}${String(id).padStart(5, '0')}`

/* ---------- Stories for email ---------- */

type Row = { id: string; slug: string; data: any }
const storyLine = (r: Row): T.EditionStory => ({
  h: r.data.h,
  st: r.data.st,
  what: r.data.what,
  why: r.data.why,
  ok: r.data.ok ?? [],
  un: r.data.un ?? [],
  url: `${siteUrl()}/story/${r.slug}`,
  section: T.sectionName(r.data.cats?.[0]),
})

export async function latestStories(limit: number): Promise<(T.EditionStory & { id: string })[]> {
  const rows = await q<Row>("SELECT id, slug, data FROM stories WHERE published ORDER BY story_date DESC, CASE tier WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id LIMIT $1", [limit])
  return rows.map((r) => ({ ...storyLine(r), id: r.id }))
}

async function storiesByIds(ids: string[]) {
  const rows = await q<Row>('SELECT id, slug, data FROM stories WHERE published AND id = ANY($1)', [ids])
  // Keep the editor's order.
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => !!r).map(storyLine)
}

/* ---------- The morning email: sign-up, confirm, leave ---------- */

type Subscriber = { id: number; email: string; status: string; token: string; country: string | null; confirm_sent_at: Date | null }

/**
 * A sign-up from the site. A new or returning address gets a confirmation email; nothing else
 * is sent until they confirm. An address that is already confirmed is left alone. The caller
 * answers the same way in every case, so the form cannot be used to find out who subscribes.
 */
export async function requestSubscription(email: string, o: { source?: string; country?: string | null; lang?: string }) {
  const existing = await one<Subscriber>('SELECT id, email, status, token, country, confirm_sent_at FROM subscribers WHERE email = $1', [email])
  // At most one email every three minutes to the same address, whatever its state.
  if (existing?.confirm_sent_at && Date.now() - new Date(existing.confirm_sent_at).getTime() < 3 * 60000) return
  if (existing?.status === 'confirmed') {
    // Already on the list. Say so by email rather than on the page, so the form cannot be used
    // to find out who subscribes, and the reader is not left waiting for a confirmation.
    await q('UPDATE subscribers SET confirm_sent_at = now() WHERE id = $1', [existing.id])
    sendLater({ to: email, kind: 'subscribe.already', mail: T.alreadySubscribed(site(), { unsubscribeUrl: unsubscribeLink(existing.token) }), headers: listHeaders(existing.token) })
    return
  }
  const token = newToken()
  if (existing) await q("UPDATE subscribers SET status = 'pending', token = $2, confirm_sent_at = now(), country = coalesce($3, country), lang = coalesce($4, lang) WHERE id = $1", [existing.id, token, o.country ?? null, o.lang ?? null])
  else await q('INSERT INTO subscribers (email, source, token, country, lang, confirm_sent_at) VALUES ($1, $2, $3, $4, $5, now())', [email, o.source ?? null, token, o.country ?? null, o.lang ?? null])
  sendLater({ to: email, kind: 'subscribe.confirm', mail: T.confirmSubscription(site(), confirmLink(token)) })
}

const mask = (email: string) => email.replace(/^(.).*?(.?)@/, (_m, a, b) => `${a}•••${b}@`)

export async function subscriptionStatus(token: string) {
  const s = await one<Subscriber>('SELECT email, status FROM subscribers WHERE token = $1', [token])
  return s ? { status: s.status, email: mask(s.email) } : null
}

/** The reader followed the link in the confirmation email (or chose to come back after leaving). */
export async function confirmSubscription(token: string) {
  const s = await one<Subscriber & { confirmed_at: Date | null }>('SELECT id, email, status, token, confirmed_at FROM subscribers WHERE token = $1', [token])
  if (!s || s.status === 'bounced') return null
  if (s.status !== 'confirmed') {
    await q("UPDATE subscribers SET status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()), unsubscribed_at = NULL WHERE id = $1", [s.id])
    // The welcome is sent once. Someone coming back after unsubscribing has already had it.
    if (!s.confirmed_at) sendLater({ to: s.email, kind: 'subscribe.welcome', mail: T.welcome(site(), { unsubscribeUrl: unsubscribeLink(s.token), stories: await latestStories(3) }), headers: listHeaders(s.token) })
  }
  return { status: 'confirmed', email: mask(s.email) }
}

export async function unsubscribe(token: string) {
  const s = await one<Subscriber>("UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = now() WHERE token = $1 AND status <> 'bounced' RETURNING email", [token])
  return s ? { status: 'unsubscribed', email: mask(s.email) } : null
}

/* ---------- Offers ---------- */

export function offerFacts(advertiserId: string, offerId: string): T.OfferFacts | null {
  const advertiser = ADVERTISERS.find((a) => a.id === advertiserId)
  const offer = advertiser?.offers.find((o) => o.id === offerId)
  return advertiser && offer ? { title: offer.title, advertiser: advertiser.name, price: offer.price, priceNote: offer.priceNote, url: `${siteUrl()}/offers/${advertiser.category}/${offer.id}` } : null
}

/* ---------- An edition of the morning email ---------- */

export type EditionIn = { subject: string; intro?: string; storyIds: string[] }

/** The trends block for a reader's country: the nearest level that has something to say. */
async function trendsFor(country: string | null) {
  const { levels } = await trendLevels(country ?? undefined)
  const level = levels[0]
  const where = level.level === 'global' ? 'around the world' : `in ${level.name}`
  return {
    trendsTitle: level.level === 'global' ? 'Trending around the world' : level.level === 'region' ? `Trending across ${level.name}` : `Trending in ${level.name}`,
    trends: level.trends.slice(0, 5).map((t) => ({ label: t.label, note: t.basis === 'local' ? `About ${level.name}` : t.basis === 'read-here' ? `Being read ${where}` : t.activeNow ? 'Moving now, everywhere' : 'Big everywhere' })),
  }
}

export async function buildEdition(e: EditionIn, country: string | null, unsubscribeUrl: string, assets?: string): Promise<Mail> {
  const stories = await storiesByIds(e.storyIds)
  return T.newsletter({ site: siteUrl(), assets }, { subject: e.subject, intro: e.intro, stories, unsubscribeUrl, ...(await trendsFor(country)) })
}

/**
 * Send an edition to every confirmed subscriber. The edition is built once per country (the
 * trends block differs), then each reader's own unsubscribe link is put in. Runs after the
 * dashboard has had its answer; progress is written to the `newsletters` row.
 */
export async function sendEdition(id: number, e: EditionIn) {
  const MARK = 'https://unsubscribe.invalid/token'
  try {
    const readers = await q<{ email: string; token: string; country: string | null }>("SELECT email, token, country FROM subscribers WHERE status = 'confirmed' ORDER BY id")
    await q('UPDATE newsletters SET recipients = $2 WHERE id = $1', [id, readers.length])
    const built = new Map<string, Mail>()
    const out: Outgoing[] = []
    for (const r of readers) {
      const key = getCountry(r.country ?? undefined).code
      if (!built.has(key)) built.set(key, await buildEdition(e, key === 'INT' ? null : key, MARK))
      const m = built.get(key)!
      const mine = unsubscribeLink(r.token)
      out.push({ to: r.email, kind: 'newsletter', mail: { subject: m.subject, html: m.html.split(MARK).join(mine), text: m.text.split(MARK).join(mine) }, headers: listHeaders(r.token) })
    }
    const result = await sendMany(out, (sent, failed) => void q('UPDATE newsletters SET delivered = $2, failed = $3 WHERE id = $1', [id, sent, failed]).then(() => publish('newsletter')).catch(() => {}))
    await q('UPDATE newsletters SET status = $2, delivered = $3, failed = $4 WHERE id = $1', [id, result.sent === 0 && result.failed > 0 ? 'failed' : 'sent', result.sent, result.failed])
    publish('newsletter')
  } catch (err) {
    console.error('Newsletter send failed', err)
    await q("UPDATE newsletters SET status = 'failed' WHERE id = $1", [id]).catch(() => {})
  }
}

/* ---------- Previews and test sends, for the dashboard ---------- */

export const TEMPLATES = [
  ['newsletter', 'The morning email', 'Sent from this page to every confirmed subscriber'],
  ['subscribe.confirm', 'Confirm your address', 'To a reader, the moment they sign up'],
  ['subscribe.welcome', 'Welcome', 'To a reader, once they confirm'],
  ['subscribe.already', 'Already subscribed', 'To a reader who signs up again with a confirmed address'],
  ['correction.received', 'Correction report received', 'To a reader who left an address with a report'],
  ['correction.corrected', 'Correction: story corrected', 'To that reader, when an editor marks it Corrected'],
  ['correction.no_change', 'Correction: no change', 'To that reader, when an editor marks it No change needed'],
  ['enquiry.received', 'Offer enquiry received', 'To a reader who asked about an advertiser offer'],
  ['staff.correction', 'Newsroom: new correction', 'To the newsroom, for every report'],
  ['staff.enquiry', 'Newsroom: new enquiry', 'To the newsroom, for every enquiry'],
  ['staff.welcome', 'Dashboard account created', 'To a new member of staff'],
  ['staff.password', 'Password changed', 'To a member of staff, every time their password changes'],
] as const
export type TemplateId = (typeof TEMPLATES)[number][0]

/** Any template, filled with sample details, as the named person would receive it. */
export async function sample(kind: TemplateId, who: { name: string }, assets?: string): Promise<Mail> {
  const s: T.Site = { site: siteUrl(), assets }
  const desk = deskUrl()
  const stories = await latestStories(5)
  const storyTitle = stories[0]?.h ?? 'COP31 opens in Antalya'
  const offer = offerFacts(ADVERTISERS[0].id, ADVERTISERS[0].offers[0].id)!
  const unsub = unsubscribeLink('sample-token')
  switch (kind) {
    case 'newsletter':
      return buildEdition({ subject: `MirrorActu morning: ${storyTitle}`, intro: 'Good morning. Here is what is confirmed, what is still open, and why it matters today.', storyIds: stories.map((x) => x.id) }, null, unsub, assets)
    case 'subscribe.confirm':
      return T.confirmSubscription(s, confirmLink('sample-token'))
    case 'subscribe.already':
      return T.alreadySubscribed(s, { unsubscribeUrl: unsub })
    case 'subscribe.welcome':
      return T.welcome(s, { unsubscribeUrl: unsub, stories: stories.slice(0, 3) })
    case 'correction.received':
      return T.correctionReceived(s, { ref: ref('C', 128), storyTitle })
    case 'correction.corrected':
      return T.correctionOutcome(s, { ref: ref('C', 128), storyTitle, outcome: 'corrected', note: 'The figure in the third paragraph was out of date. It now gives the number from the ministry’s statement of 14 November, and the story carries a correction note.' })
    case 'correction.no_change':
      return T.correctionOutcome(s, { ref: ref('C', 128), storyTitle, outcome: 'no_change', note: 'We compared the paragraph with the original statement and the figure matches it.' })
    case 'enquiry.received':
      return T.enquiryReceived(s, { ref: ref('E', 57), offer })
    case 'staff.correction':
      return T.staffNewCorrection(s, desk, { ref: ref('C', 128), storyTitle, message: 'The third paragraph gives last year’s figure. The ministry published a new one on 14 November.', email: 'reader@example.com' })
    case 'staff.enquiry':
      return T.staffNewEnquiry(s, desk, { ref: ref('E', 57), offer, email: 'reader@example.com' })
    case 'staff.welcome':
      return T.staffWelcome(s, desk, { name: who.name, role: 'editor', by: 'Your administrator' })
    case 'staff.password':
      return T.passwordChanged(s, desk, { name: who.name, at: new Date() })
  }
}

export { sendMail }
