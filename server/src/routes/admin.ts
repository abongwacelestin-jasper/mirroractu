/**
 * Sign-in and the dashboard API. Every route under /admin needs a signed-in member of staff;
 * user management and the audit log need an administrator. Every change is written to the audit log.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { audit, currentUser, endSession, hashPassword, login, requireUser, sameOrigin, startSession, throughAdminGateway, userOf } from '../auth'
import { one, q } from '../db'
import { slugify } from '../slug'
import { addWire } from '../wire'
import { bump } from '../cache'
import { activeCountries, globalTrends, trendLevels } from '../trends'
import { config } from '../config'
import { deskUrl, mailConfigured, sendLater, sendMail, siteUrl } from '../mail/send'
import { TEMPLATES, buildEdition, confirmLink, latestStories, ref, sample, sendEdition, unsubscribeLink } from '../mail/service'
import * as T from '../mail/templates'

const CATS = ['world', 'africa', 'business', 'tech', 'climate', 'health', 'culture', 'sport'] as const
const line = z.string().trim().min(1).max(600)

const storyIn = z.object({
  h: z.string().trim().min(8).max(200),
  st: z.string().trim().min(8).max(400),
  what: z.string().trim().min(20).max(3000),
  why: z.string().trim().min(8).max(1000),
  ok: z.array(line).min(1).max(12),
  un: z.array(line).max(12),
  src: z.array(z.tuple([z.string().trim().min(2).max(80), z.string().trim().min(2).max(200)]).or(z.tuple([z.string().trim().min(2).max(80), z.string().trim().min(2).max(200), z.string().url().max(500)]))).min(1).max(3),
  cats: z.array(z.enum(CATS)).min(1).max(3),
  tier: z.enum(['low', 'medium', 'high']),
  d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  desk: z.string().trim().min(2).max(60),
  sub: z.string().trim().min(2).max(40),
  tags: z.string().trim().max(300).default(''),
  /** ISO country codes this story is about, e.g. ["RW", "ZA"]. Drives country and region trends. */
  countries: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)).max(12).default([]),
  published: z.boolean().default(true),
})

const bad = (e: z.ZodError) => ({ error: 'Some fields need attention.', fields: e.issues.map((i) => ({ field: i.path.join('.'), problem: i.message })) })

export async function adminRoutes(app: FastifyInstance) {
  // Everything in this file sits behind the admin gateway: see throughAdminGateway in auth.ts.
  app.addHook('onRequest', async (req, reply) => {
    if (!throughAdminGateway(req)) return reply.code(404).send({ error: 'Not found.' })
  })

  /* ---------- Sign-in ---------- */

  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    if (!sameOrigin(req, 'admin')) return reply.code(403).send({ error: 'Request did not come from the MirrorActu dashboard.' })
    const body = z.object({ email: z.string().max(254), password: z.string().min(1).max(200) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Enter your email and password.' })
    const result = await login(body.data.email, body.data.password)
    if ('error' in result) {
      await audit(null, 'login.failed', body.data.email.slice(0, 100))
      return reply.code(result.status).send({ error: result.error })
    }
    await startSession(reply, result.user.id, req.headers['user-agent'])
    await audit(result.user, 'login')
    return { user: result.user }
  })

  app.post('/auth/logout', async (req, reply) => {
    await endSession(req, reply)
    return { ok: true }
  })

  app.get('/auth/me', async (req) => ({ user: await currentUser(req) }))

  app.post('/auth/password', { preHandler: requireUser(undefined, true) }, async (req, reply) => {
    const body = z.object({ current: z.string().max(200), next: z.string().min(12).max(200) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'The new password needs at least 12 characters.' })
    const user = userOf(req)
    const check = await login(user.email, body.data.current)
    if ('error' in check) return reply.code(400).send({ error: 'Your current password is not right.' })
    if (body.data.next === body.data.current) return reply.code(400).send({ error: 'Choose a password different from the current one.' })
    await q('UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1', [user.id, await hashPassword(body.data.next)])
    // Sign out everywhere else.
    await q('DELETE FROM sessions WHERE user_id = $1', [user.id])
    await startSession(reply, user.id, req.headers['user-agent'])
    await audit(user, 'password.changed')
    sendLater({ to: user.email, kind: 'staff.password', mail: T.passwordChanged({ site: siteUrl() }, deskUrl(), { name: user.name, at: new Date() }) })
    return { ok: true }
  })

  /* ---------- Dashboard ---------- */

  app.register(async (admin) => {
    admin.addHook('preHandler', requireUser())

    admin.get('/overview', async () => {
      const [counts] = await q(`SELECT
        (SELECT count(*) FROM stories WHERE published) AS stories,
        (SELECT count(*) FROM stories WHERE NOT published) AS drafts,
        (SELECT count(*) FROM subscribers) AS subscribers,
        (SELECT count(*) FROM corrections WHERE status IN ('open', 'checking')) AS corrections_open,
        (SELECT count(*) FROM enquiries) AS enquiries,
        (SELECT count(*) FROM wire_items WHERE at > now() - interval '24 hours') AS wire_today,
        (SELECT count(*) FROM events WHERE type = 'view' AND at > now() - interval '24 hours') AS views_today,
        (SELECT count(DISTINCT visitor) FROM events WHERE at > now() - interval '24 hours') AS readers_today`)
      const days = await q(`SELECT to_char(d, 'YYYY-MM-DD') AS day, count(e.id) AS views, count(DISTINCT e.visitor) AS readers
        FROM generate_series(current_date - 13, current_date, '1 day') d
        LEFT JOIN events e ON e.type = 'view' AND e.at >= d AND e.at < d + interval '1 day'
        GROUP BY d ORDER BY d`)
      const top = await q(`SELECT e.story_id AS id, s.data->>'h' AS headline, count(*) AS views, count(DISTINCT e.visitor) AS readers
        FROM events e JOIN stories s ON s.id = e.story_id
        WHERE e.type = 'view' AND e.at > now() - interval '7 days' GROUP BY e.story_id, s.data ORDER BY readers DESC, views DESC LIMIT 8`)
      const by = (col: 'country' | 'lang') => q(`SELECT coalesce(${col}, 'unknown') AS key, count(DISTINCT visitor) AS readers FROM events WHERE at > now() - interval '7 days' GROUP BY 1 ORDER BY readers DESC LIMIT 8`)
      const num = (r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, /^\d+$/.test(String(v)) ? Number(v) : v]))
      return { counts: num(counts), days: days.map(num), topStories: top.map(num), countries: (await by('country')).map(num), languages: (await by('lang')).map(num), trends: (await globalTrends()).slice(0, 10), activeCountries: await activeCountries() }
    })

    /** Trends as readers in one country see them: country, region and global levels. */
    admin.get('/trends', async (req) => {
      const { country } = z.object({ country: z.string().max(3).optional() }).parse(req.query)
      return trendLevels(country)
    })

    /* Stories */
    admin.get('/stories', async () => ({
      stories: (await q('SELECT id, slug, data, published, version, updated_at FROM stories ORDER BY story_date DESC, id')).map((r) => ({ ...r.data, id: r.id, slug: r.slug, published: r.published, version: r.version, updatedAt: r.updated_at })),
    }))

    admin.post('/stories', async (req, reply) => {
      const body = storyIn.safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const { published, ...story } = body.data
      let slug = slugify(story.h)
      if (await one('SELECT 1 FROM stories WHERE slug = $1', [slug])) slug = `${slug}-${Date.now().toString(36)}`
      const id = `s-${slug.split('-').slice(0, 3).join('-')}-${Date.now().toString(36)}`
      await q('INSERT INTO stories (id, slug, data, cats, tier, story_date, published, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, slug, JSON.stringify({ ...story, id }), story.cats, story.tier, story.d, published, userOf(req).id])
      await bump('content')
      await bump('trends')
      await audit(userOf(req), 'story.created', id, { headline: story.h, published })
      return reply.code(201).send({ id, slug })
    })

    admin.put('/stories/:id', async (req, reply) => {
      const { id } = z.object({ id: z.string().max(120) }).parse(req.params)
      const body = storyIn.safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const { published, ...story } = body.data
      // The address (slug) is kept when a headline changes, so links already shared keep working.
      const row = await one('UPDATE stories SET data = $2, cats = $3, tier = $4, story_date = $5, published = $6, version = version + 1, updated_at = now(), updated_by = $7 WHERE id = $1 RETURNING version', [id, JSON.stringify({ ...story, id }), story.cats, story.tier, story.d, published, userOf(req).id])
      if (!row) return reply.code(404).send({ error: 'No such story.' })
      await bump('content')
      await bump('trends')
      await audit(userOf(req), 'story.updated', id, { headline: story.h, published, version: row.version })
      return { ok: true, version: row.version }
    })

    admin.delete('/stories/:id', { preHandler: requireUser('admin') }, async (req, reply) => {
      const { id } = z.object({ id: z.string().max(120) }).parse(req.params)
      const row = await one("DELETE FROM stories WHERE id = $1 RETURNING data->>'h' AS h", [id])
      if (!row) return reply.code(404).send({ error: 'No such story.' })
      await bump('content')
      await bump('trends')
      await audit(userOf(req), 'story.deleted', id, { headline: row.h })
      return { ok: true }
    })

    /* Wire */
    admin.post('/wire', async (req, reply) => {
      const body = z.object({ desk: z.string().trim().min(2).max(40), cat: z.enum(CATS), text: z.string().trim().min(8).max(300), storyId: z.string().max(120).optional().or(z.literal('')), kind: z.enum(['update', 'confirmed', 'result', 'data']) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const item = await addWire({ ...body.data, storyId: body.data.storyId || undefined }, userOf(req).id)
      await bump('trends')
      await audit(userOf(req), 'wire.posted', String(item.id), { text: item.text })
      return reply.code(201).send({ item })
    })

    admin.delete('/wire/:id', async (req) => {
      const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params)
      await q('DELETE FROM wire_items WHERE id = $1', [id])
      await audit(userOf(req), 'wire.deleted', String(id))
      return { ok: true }
    })

    /* Inbox */
    admin.get('/corrections', async () => ({ corrections: await q('SELECT c.*, u.name AS handled_by_name FROM corrections c LEFT JOIN users u ON u.id = c.handled_by ORDER BY c.created_at DESC LIMIT 200') }))

    admin.patch('/corrections/:id', async (req, reply) => {
      const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params)
      const body = z.object({ status: z.enum(['open', 'checking', 'corrected', 'no_change']), note: z.string().trim().max(1000).optional() }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const before = await one<{ status: string; email: string | null; story_title: string | null }>('SELECT status, email, story_title FROM corrections WHERE id = $1', [id])
      if (!before) return reply.code(404).send({ error: 'No such report.' })
      await q('UPDATE corrections SET status = $2, note = coalesce($3, note), handled_by = $4, handled_at = now() WHERE id = $1', [id, body.data.status, body.data.note || null, userOf(req).id])
      // The reader is told once, when the report is first closed either way.
      const closing = (body.data.status === 'corrected' || body.data.status === 'no_change') && before.status !== body.data.status
      const emailed = closing && !!before.email
      if (emailed) sendLater({ to: before.email!, kind: `correction.${body.data.status}`, mail: T.correctionOutcome({ site: siteUrl() }, { ref: ref('C', id), storyTitle: before.story_title ?? undefined, outcome: body.data.status as 'corrected' | 'no_change', note: body.data.note || undefined }) })
      await audit(userOf(req), 'correction.updated', String(id), { status: body.data.status, readerEmailed: emailed })
      return { ok: true, readerEmailed: emailed }
    })

    admin.get('/enquiries', async () => ({ enquiries: await q('SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 200') }))

    admin.get('/subscribers', async () => ({ subscribers: await q('SELECT id, email, status, source, country, created_at, confirmed_at FROM subscribers ORDER BY created_at DESC LIMIT 1000') }))

    admin.get('/subscribers.csv', { preHandler: requireUser('admin') }, async (req, reply) => {
      const rows = await q('SELECT email, status, source, country, created_at FROM subscribers ORDER BY created_at')
      await audit(userOf(req), 'subscribers.exported', undefined, { count: rows.length })
      const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="mirroractu-subscribers.csv"')
      return ['email,status,source,country,signed_up', ...rows.map((r) => [r.email, r.status, r.source, r.country, new Date(r.created_at).toISOString()].map(cell).join(','))].join('\n')
    })

    /**
     * Sign-ups from before email was connected were never sent a confirmation. This sends it to
     * them (50 at a time), once each. Administrators only.
     */
    admin.post('/subscribers/confirm-waiting', { preHandler: requireUser('admin'), config: { rateLimit: { max: 6, timeWindow: '1 hour' } } }, async (req, reply) => {
      if (!mailConfigured()) return reply.code(409).send({ error: 'Email is not connected yet: RESEND_API_KEY is not set on the API.' })
      const rows = await q<{ id: string; email: string; token: string }>("UPDATE subscribers SET confirm_sent_at = now() WHERE id IN (SELECT id FROM subscribers WHERE status = 'pending' AND confirm_sent_at IS NULL ORDER BY id LIMIT 50) RETURNING id, email, token")
      for (const r of rows) sendLater({ to: r.email, kind: 'subscribe.confirm', mail: T.confirmSubscription({ site: siteUrl() }, confirmLink(r.token)) })
      await audit(userOf(req), 'subscribers.confirmation_sent', undefined, { count: rows.length })
      return { sent: rows.length }
    })

    /* ---------- Email ---------- */

    /** Whether email is connected, the templates, recent sends and past editions. */
    admin.get('/mail', async () => {
      const [counts] = await q(`SELECT
        (SELECT count(*) FROM subscribers WHERE status = 'confirmed') AS confirmed,
        (SELECT count(*) FROM subscribers WHERE status = 'pending') AS pending,
        (SELECT count(*) FROM subscribers WHERE status = 'pending' AND confirm_sent_at IS NULL) AS never_asked,
        (SELECT count(*) FROM emails WHERE status = 'sent' AND at > now() - interval '7 days') AS sent_week,
        (SELECT count(*) FROM emails WHERE status = 'failed' AND at > now() - interval '7 days') AS failed_week`)
      return {
        configured: mailConfigured(),
        from: config.mailFrom,
        fromIsTestSender: !config.mailFromSet,
        replyTo: config.mailReplyTo || null,
        postalAddress: config.mailPostalAddress || null,
        webhook: !!config.resendWebhookSecret,
        counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
        templates: TEMPLATES.map(([id, name, when]) => ({ id, name, when })),
        stories: (await latestStories(14)).map((x) => ({ id: x.id, h: x.h, section: x.section })),
        recent: await q('SELECT id, at, kind, recipient, subject, status, error FROM emails ORDER BY at DESC LIMIT 60'),
        editions: await q('SELECT n.id, n.subject, n.status, n.recipients, n.delivered, n.failed, n.created_at, u.name AS sent_by FROM newsletters n LEFT JOIN users u ON u.id = n.sent_by ORDER BY n.created_at DESC LIMIT 20'),
      }
    })

    const templateId = z.enum(TEMPLATES.map((t) => t[0]) as [string, ...string[]])
    const editionIn = z.object({ subject: z.string().trim().min(6).max(150), intro: z.string().trim().max(600).optional(), storyIds: z.array(z.string().max(120)).min(1).max(8), country: z.string().max(3).optional() })

    /** Any template with sample details. `assets` makes the logo load inside the dashboard's own preview. */
    admin.get('/mail/preview/:kind', async (req, reply) => {
      const p = templateId.safeParse((req.params as any).kind)
      if (!p.success) return reply.code(404).send({ error: 'No such template.' })
      return sample(p.data as any, userOf(req), '')
    })

    /** Send a template, with sample details, to the signed-in person only. */
    admin.post('/mail/test', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
      const p = z.object({ kind: templateId }).safeParse(req.body)
      if (!p.success) return reply.code(400).send({ error: 'No such template.' })
      const user = userOf(req)
      const mail = await sample(p.data.kind as any, user)
      const ok = await sendMail({ to: user.email, kind: `test.${p.data.kind}`, mail: { ...mail, subject: `[Test] ${mail.subject}` } })
      // Not a 5xx: the web server in front replaces those with its own "API not reachable" message.
      if (!ok) return reply.code(409).send({ error: mailConfigured() ? 'Resend did not accept the email. The reason is under Sent, in Recent email.' : 'Email is not connected yet: RESEND_API_KEY is not set on the API.' })
      return { ok: true, to: user.email }
    })

    admin.post('/newsletter/preview', async (req, reply) => {
      const body = editionIn.safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      return buildEdition(body.data, body.data.country || null, unsubscribeLink('sample-token'), '')
    })

    /** The edition as written, to the signed-in person only. */
    admin.post('/newsletter/test', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
      const body = editionIn.safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const user = userOf(req)
      const mail = await buildEdition(body.data, body.data.country || null, unsubscribeLink('sample-token'))
      const ok = await sendMail({ to: user.email, kind: 'test.newsletter', mail: { ...mail, subject: `[Test] ${mail.subject}` } })
      // Not a 5xx: the web server in front replaces those with its own "API not reachable" message.
      if (!ok) return reply.code(409).send({ error: mailConfigured() ? 'Resend did not accept the email. The reason is under Sent, in Recent email.' : 'Email is not connected yet: RESEND_API_KEY is not set on the API.' })
      return { ok: true, to: user.email }
    })

    /** Send the edition to every confirmed subscriber. Administrators only; it cannot be recalled. */
    admin.post('/newsletter/send', { preHandler: requireUser('admin'), config: { rateLimit: { max: 4, timeWindow: '1 hour' } } }, async (req, reply) => {
      const body = editionIn.safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      if (!mailConfigured()) return reply.code(409).send({ error: 'Email is not connected yet: RESEND_API_KEY is not set on the API.' })
      if (await one("SELECT 1 FROM newsletters WHERE status = 'sending' AND created_at > now() - interval '30 minutes'")) return reply.code(409).send({ error: 'An edition is still being sent. Wait for it to finish.' })
      const [{ n }] = await q<{ n: string }>("SELECT count(*) AS n FROM subscribers WHERE status = 'confirmed'")
      if (Number(n) === 0) return reply.code(409).send({ error: 'Nobody has confirmed their address yet, so there is no one to send to.' })
      const row = await one<{ id: string }>('INSERT INTO newsletters (subject, intro, story_ids, recipients, sent_by) VALUES ($1, $2, $3, $4, $5) RETURNING id', [body.data.subject, body.data.intro || null, body.data.storyIds, Number(n), userOf(req).id])
      await audit(userOf(req), 'newsletter.sent', String(row!.id), { subject: body.data.subject, recipients: Number(n) })
      void sendEdition(Number(row!.id), body.data)
      return reply.code(202).send({ id: Number(row!.id), recipients: Number(n) })
    })

    /* Staff and audit: administrators only */
    admin.get('/users', { preHandler: requireUser('admin') }, async () => ({ users: await q('SELECT id, email, name, role, disabled, created_at FROM users ORDER BY created_at') }))

    admin.post('/users', { preHandler: requireUser('admin') }, async (req, reply) => {
      const body = z.object({ email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(2).max(80), role: z.enum(['admin', 'editor']), password: z.string().min(12).max(200) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      if (await one('SELECT 1 FROM users WHERE email = $1', [body.data.email])) return reply.code(409).send({ error: 'Someone already has that email.' })
      // A password set by someone else is a first password: the new member must replace it.
      const row = await one('INSERT INTO users (email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, true) RETURNING id', [body.data.email, body.data.name, body.data.role, await hashPassword(body.data.password)])
      await audit(userOf(req), 'user.created', String(row!.id), { email: body.data.email, role: body.data.role })
      // Tells them where to sign in. The first password is never emailed: the administrator passes it on.
      sendLater({ to: body.data.email, kind: 'staff.welcome', mail: T.staffWelcome({ site: siteUrl() }, deskUrl(), { name: body.data.name, role: body.data.role, by: userOf(req).name }) })
      return reply.code(201).send({ id: Number(row!.id) })
    })

    admin.patch('/users/:id', { preHandler: requireUser('admin') }, async (req, reply) => {
      const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params)
      const body = z.object({ disabled: z.boolean().optional(), role: z.enum(['admin', 'editor']).optional() }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      if (id === userOf(req).id) return reply.code(400).send({ error: 'You cannot change your own access. Ask another administrator.' })
      await q('UPDATE users SET disabled = coalesce($2, disabled), role = coalesce($3, role) WHERE id = $1', [id, body.data.disabled ?? null, body.data.role ?? null])
      if (body.data.disabled) await q('DELETE FROM sessions WHERE user_id = $1', [id])
      await audit(userOf(req), 'user.updated', String(id), body.data)
      return { ok: true }
    })

    admin.get('/audit', { preHandler: requireUser('admin') }, async () => ({
      entries: await q('SELECT a.id, a.at, a.action, a.target, a.detail, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.at DESC LIMIT 200'),
    }))
  }, { prefix: '/admin' })
}
