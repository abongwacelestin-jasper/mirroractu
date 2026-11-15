/**
 * The public API: everything the website reads, and the three forms readers can send.
 * Read endpoints need no sign-in. Form endpoints are rate limited and must come from the site.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { sameOrigin, visitorHash } from '../auth'
import { one, q } from '../db'
import { cacheBackend, cached } from '../cache'
import { countryFromHeaders, trendLevels } from '../trends'
import { onWire, recentWire } from '../wire'
import { newsroomAddresses, sendLater, siteUrl, deskUrl } from '../mail/send'
import { confirmSubscription, offerFacts, ref, requestSubscription, subscriptionStatus, unsubscribe } from '../mail/service'
import * as T from '../mail/templates'
import { rates } from '../rates'
import { webTrends } from '../webtrends/engine'
import { publish } from '../bus'
import { bodyHtml, feed, headHtml, newsSitemap, robotsTxt, sitemap } from '../seo'
import { resendWebhook } from '../mail/webhook'

const email = z.string().trim().toLowerCase().email().max(254)
const strict = { config: { rateLimit: { max: 8, timeWindow: '10 minutes' } } }

/** Everything about one story the site needs, with its slug and version. */
const storyOut = (r: any) => ({ ...r.data, id: r.id, slug: r.slug, version: r.version })

export async function content() {
  // Dashboard-only settings are kept in the same table; they are not part of the edition.
  const rows = await q<{ key: string; data: unknown }>("SELECT key, data FROM content WHERE key NOT LIKE 'webTrends%'")
  return Object.fromEntries(rows.map((r) => [r.key, r.data]))
}

export async function publicRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, at: new Date().toISOString(), cache: cacheBackend() }))

  /** Where the reader is, when a proxy or CDN in front of the site says so. Null otherwise. */
  app.get('/geo', async (req, reply) => {
    reply.header('Cache-Control', 'private, max-age=300')
    return { country: countryFromHeaders(req.headers) }
  })

  /** One request that gives the site its whole edition. */
  app.get('/bootstrap', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=5')
    // Cached for half a minute, and dropped at once when an editor changes anything.
    return cached('content', 'bootstrap', 30, async () => {
      const stories = (await q('SELECT id, slug, data, version FROM stories WHERE published ORDER BY story_date DESC, id')).map(storyOut)
      return { generatedAt: new Date().toISOString(), stories, ...(await content()) }
    })
  })

  app.get('/stories', async (req) => {
    const p = z.object({ desk: z.string().max(20).optional(), q: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query)
    const rows = await q(
      `SELECT id, slug, data, version FROM stories
       WHERE published AND ($1::text IS NULL OR $1 = ANY(cats)) AND ($2::text IS NULL OR data::text ILIKE '%' || $2 || '%')
       ORDER BY story_date DESC, id LIMIT $3`,
      [p.desk ?? null, p.q?.trim() || null, p.limit]
    )
    return { stories: rows.map(storyOut) }
  })

  app.get('/stories/:key', async (req, reply) => {
    const { key } = z.object({ key: z.string().max(200) }).parse(req.params)
    const row = await one('SELECT id, slug, data, version FROM stories WHERE published AND (slug = $1 OR id = $1)', [key])
    return row ? storyOut(row) : reply.code(404).send({ error: 'No story at this address.' })
  })

  /**
   * Today's trends. With ?country=RW (or a country supplied by the proxy) the answer has three
   * levels: the country, its region, and global. `trends` is always the global list.
   */
  app.get('/trends', async (req, reply) => {
    const { country } = z.object({ country: z.string().max(3).optional() }).parse(req.query)
    const result = await trendLevels(country ?? countryFromHeaders(req.headers) ?? undefined)
    reply.header('Cache-Control', 'public, max-age=20').header('Vary', 'CF-IPCountry, X-Country-Code')
    return { generatedAt: new Date().toISOString(), country: result.country, levels: result.levels, trends: result.levels[result.levels.length - 1].trends }
  })

  /**
   * "Trending on the web": what Google searches, the world's news outlets and Wikipedia readers
   * show is trending, for a country, its region and worldwide. Kept apart from /trends, which
   * is the newsroom's own ranking. Every list names its source.
   */
  app.get('/web-trends', async (req, reply) => {
    const { country } = z.object({ country: z.string().max(3).optional() }).parse(req.query)
    reply.header('Cache-Control', 'public, max-age=60')
    return webTrends(country ?? countryFromHeaders(req.headers) ?? undefined)
  })

  app.get('/wire', async (req) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(40) }).parse(req.query)
    return { items: await recentWire(limit) }
  })

  /** The live wire as a stream: the last items first, then each new one the moment it is filed. */
  app.get('/wire/stream', async (req, reply) => {
    reply.hijack()
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    const send = (event: string, data: unknown) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    send('backfill', await recentWire(40))
    const off = onWire((item) => send('item', item))
    const beat = setInterval(() => reply.raw.write(': keep-alive\n\n'), 25000)
    req.raw.on('close', () => {
      clearInterval(beat)
      off()
    })
  })

  /* ---------- Search engines and link previews (see ../seo.ts) ---------- */
  // The web server calls these for every page it serves, so they are not rate limited.
  const open = { config: { rateLimit: false as const } }
  const pathOf = (req: { params: unknown; url: string }) => `/${String((req.params as any)['*'] ?? '')}${req.url.includes('?') ? '?' : ''}`
  app.get('/seo/head/*', open, async (req, reply) => reply.type('text/html; charset=utf-8').send(await headHtml(pathOf(req))))
  app.get('/seo/body/*', open, async (req, reply) => reply.type('text/html; charset=utf-8').send(await bodyHtml(pathOf(req))))
  app.get('/seo/robots.txt', open, async (_req, reply) => reply.type('text/plain; charset=utf-8').header('Cache-Control', 'public, max-age=3600').send(robotsTxt()))
  app.get('/seo/sitemap.xml', open, async (_req, reply) => reply.type('application/xml; charset=utf-8').header('Cache-Control', 'public, max-age=600').send(await sitemap()))
  app.get('/seo/news-sitemap.xml', open, async (_req, reply) => reply.type('application/xml; charset=utf-8').header('Cache-Control', 'public, max-age=600').send(await newsSitemap()))
  app.get('/seo/feed.xml', open, async (_req, reply) => reply.type('application/rss+xml; charset=utf-8').header('Cache-Control', 'public, max-age=600').send(await feed()))

  /* ---------- Forms ---------- */

  app.post('/subscribe', strict, async (req, reply) => {
    if (!sameOrigin(req)) return reply.code(403).send({ error: 'Request did not come from the MirrorActu site.' })
    const body = z.object({ email, source: z.string().max(40).optional(), country: z.string().max(3).optional(), lang: z.string().max(8).optional() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Enter an email address such as name@example.com.' })
    const country = countryFromHeaders(req.headers) ?? (body.data.country && /^[A-Za-z]{2}$/.test(body.data.country) ? body.data.country.toUpperCase() : null)
    // The same answer whether or not the address was already there, so the form cannot be used to test who subscribes.
    await requestSubscription(body.data.email, { source: body.data.source, country, lang: body.data.lang })
    publish('subscribers')
    return { ok: true }
  })

  /* The links in the confirmation email and in every edition open a page on the site, and the
     page calls these. The token in the link is the reader's proof: no sign-in is involved. */
  const token = z.object({ token: z.string().min(16).max(120) })
  const gone = { error: 'This link is not valid any more. Sign up again from the site to get a new one.' }

  app.get('/subscription', strict, async (req, reply) => {
    const p = token.safeParse(req.query)
    const found = p.success ? await subscriptionStatus(p.data.token) : null
    return found ?? reply.code(404).send(gone)
  })

  app.post('/subscribe/confirm', strict, async (req, reply) => {
    if (!sameOrigin(req)) return reply.code(403).send({ error: 'Request did not come from the MirrorActu site.' })
    const p = token.safeParse(req.body)
    const done = p.success ? await confirmSubscription(p.data.token) : null
    if (done) publish('subscribers')
    return done ?? reply.code(404).send(gone)
  })

  app.post('/unsubscribe', strict, async (req, reply) => {
    if (!sameOrigin(req)) return reply.code(403).send({ error: 'Request did not come from the MirrorActu site.' })
    const p = token.safeParse(req.body)
    const done = p.success ? await unsubscribe(p.data.token) : null
    if (done) publish('subscribers')
    return done ?? reply.code(404).send(gone)
  })

  /* One-click unsubscribe (RFC 8058). The reader's mail program posts here when they press its
     own Unsubscribe button, so there is no page and no Origin header: the token decides. */
  app.register(async (hook) => {
    hook.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => done(null, body))
    hook.post('/unsubscribe/one-click', strict, async (req, reply) => {
      const p = z.object({ t: z.string().min(16).max(120) }).safeParse(req.query)
      if (p.success) await unsubscribe(p.data.t)
      return reply.code(200).send({ ok: true })
    })
  })

  /* Resend tells us here when an address bounces or a reader marks an email as spam. */
  app.register(resendWebhook)

  /** Exchange rates against the US dollar, refreshed twice a day. */
  app.get('/rates', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=3600')
    return rates()
  })

  app.post('/corrections', strict, async (req, reply) => {
    if (!sameOrigin(req)) return reply.code(403).send({ error: 'Request did not come from the MirrorActu site.' })
    const body = z.object({ message: z.string().trim().min(5).max(4000), storyTitle: z.string().trim().max(300).optional(), email: email.optional().or(z.literal('')) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Describe what we should check, in at least a few words.' })
    const row = await one<{ id: string }>('INSERT INTO corrections (story_title, message, email) VALUES ($1, $2, $3) RETURNING id', [body.data.storyTitle || null, body.data.message, body.data.email || null])
    const reference = ref('C', row!.id)
    publish('inbox')
    // The reader's receipt names the story only if it is one of ours, and never repeats what was
    // typed: otherwise the form could be used to send anyone a message of the sender's choosing.
    const known = body.data.storyTitle ? await one("SELECT 1 FROM stories WHERE published AND data->>'h' = $1", [body.data.storyTitle]) : null
    if (body.data.email) sendLater({ to: body.data.email, kind: 'correction.received', mail: T.correctionReceived({ site: siteUrl() }, { ref: reference, storyTitle: known ? body.data.storyTitle : undefined }) })
    const staffMail = T.staffNewCorrection({ site: siteUrl() }, deskUrl(), { ref: reference, storyTitle: body.data.storyTitle || undefined, message: body.data.message, email: body.data.email || undefined })
    for (const to of await newsroomAddresses()) sendLater({ to, kind: 'staff.correction', mail: staffMail, replyTo: body.data.email || undefined })
    return { ok: true, ref: reference }
  })

  app.post('/enquiries', strict, async (req, reply) => {
    if (!sameOrigin(req)) return reply.code(403).send({ error: 'Request did not come from the MirrorActu site.' })
    const body = z.object({ email, advertiserId: z.string().max(80), offerId: z.string().max(80) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Enter an email address such as name@example.com.' })
    const offer = offerFacts(body.data.advertiserId, body.data.offerId)
    if (!offer) return reply.code(400).send({ error: 'That offer is no longer listed.' })
    const row = await one<{ id: string }>('INSERT INTO enquiries (advertiser_id, offer_id, email) VALUES ($1, $2, $3) RETURNING id', [body.data.advertiserId, body.data.offerId, body.data.email])
    const reference = ref('E', row!.id)
    publish('inbox')
    sendLater({ to: body.data.email, kind: 'enquiry.received', mail: T.enquiryReceived({ site: siteUrl() }, { ref: reference, offer }) })
    const staffMail = T.staffNewEnquiry({ site: siteUrl() }, deskUrl(), { ref: reference, offer, email: body.data.email })
    for (const to of await newsroomAddresses()) sendLater({ to, kind: 'staff.enquiry', mail: staffMail, replyTo: body.data.email })
    return { ok: true, ref: reference }
  })

  /**
   * Readership. The site only calls this for readers who allowed measurement. It records the
   * page and story, never the IP address: the visitor id is a daily hash that cannot be reversed.
   */
  app.post('/events', { config: { rateLimit: { max: 180, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!sameOrigin(req)) return reply.code(403).send({ error: 'Request did not come from the MirrorActu site.' })
    // Respect "do not track" style signals even if the page called us.
    if (req.headers['sec-gpc'] === '1') return reply.code(204).send()
    const body = z
      .object({
        type: z.enum(['view', 'page', 'click', 'search']),
        storyId: z.string().max(80).optional(),
        path: z.string().max(300),
        country: z.string().max(3).optional(),
        lang: z.string().max(8).optional(),
        /** What was clicked, or the words searched for */
        label: z.string().trim().max(80).optional(),
        /** The site the reader came from: a host name only, never a full address */
        ref: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]{1,80}$/).optional(),
        value: z.number().int().min(0).max(100000).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Bad event.' })
    const b = body.data
    // Only the page's path is kept: anything after "?" could carry something personal.
    const path = b.path.split(/[?#]/)[0]
    await q('INSERT INTO events (type, story_id, path, country, lang, visitor, label, ref, value) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [b.type, b.storyId ?? null, path, countryFromHeaders(req.headers) ?? (b.country && /^[A-Za-z]{2}$/.test(b.country) ? b.country.toUpperCase() : null), b.lang ?? null, visitorHash(req), b.label || null, b.ref || null, b.value ?? null])
    // The dashboard sees it as it happens. No reader code is included.
    publish('event', { at: new Date().toISOString(), type: b.type, path, label: b.label || null, ref: b.ref || null, value: b.value ?? null, country: countryFromHeaders(req.headers) ?? (b.country && /^[A-Za-z]{2}$/.test(b.country) ? b.country.toUpperCase() : null), lang: b.lang ?? null })
    return reply.code(204).send()
  })
}
