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
import { deliverability } from '../mail/check'
import { engineStatus, refreshNow, resumeSource, setBlocked, setSourceEnabled, syncAll } from '../webtrends/engine'
import { SOURCES } from '../webtrends/sources'

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
      return { counts: num(counts), days: days.map(num), topStories: top.map(num), countries: (await by('country')).map(num), languages: (await by('lang')).map(num), trends: (await globalTrends()).slice(0, 10), activeCountries: await activeCountries(), mail: mailConfigured() }
    })

    /**
     * Engagement over the last 1, 7 or 30 days: pages, clicks, where readers came from, what
     * they searched for, where they are, and how busy each hour was. Counts cover readers
     * who allowed measurement only.
     */
    admin.get('/engagement', async (req) => {
      const { days } = z.object({ days: z.coerce.number().int().refine((d) => [1, 7, 30].includes(d)).default(7) }).parse(req.query)
      const num = (r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v]))
      const since = `at > now() - make_interval(days => $1)`
      const totals = (from: string, to: string) =>
        one(
          `SELECT count(*) FILTER (WHERE type = 'page') AS pages, count(DISTINCT visitor) AS readers, count(*) FILTER (WHERE type = 'click') AS clicks,
             count(*) FILTER (WHERE type = 'search') AS searches, count(*) FILTER (WHERE type = 'page' AND ref IS NOT NULL) AS referred
           FROM events WHERE at > now() - make_interval(days => ${from}) AND at <= now() - make_interval(days => ${to})`,
          [days]
        )
      const [now, before, hours, pages, referrers, clicks, searches, countries] = await Promise.all([
        totals('$1', '0'),
        totals('$1 * 2', '$1'),
        // Hour by hour for 1 day, otherwise day by day.
        days === 1
          ? q(`SELECT to_char(h, 'YYYY-MM-DD"T"HH24:00') AS t, count(e.id) AS n FROM generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), '1 hour') h LEFT JOIN events e ON e.at >= h AND e.at < h + interval '1 hour' AND e.type <> 'time' GROUP BY h ORDER BY h`)
          : q(`SELECT to_char(d, 'YYYY-MM-DD') AS t, count(e.id) AS n FROM generate_series(current_date - ($1::int - 1), current_date, '1 day') d LEFT JOIN events e ON e.at >= d AND e.at < d + interval '1 day' AND e.type <> 'time' GROUP BY d ORDER BY d`, [days]),
        q(`SELECT path, count(*) AS views, count(DISTINCT visitor) AS readers FROM events WHERE type = 'page' AND ${since} GROUP BY path ORDER BY views DESC LIMIT 12`, [days]),
        q(`SELECT ref, count(*) AS visits FROM events WHERE type = 'page' AND ref IS NOT NULL AND ${since} GROUP BY ref ORDER BY visits DESC LIMIT 10`, [days]),
        q(`SELECT label, count(*) AS n FROM events WHERE type = 'click' AND label IS NOT NULL AND ${since} GROUP BY label ORDER BY n DESC LIMIT 12`, [days]),
        q(`SELECT lower(label) AS q, count(*) AS n, count(*) FILTER (WHERE value = 0) AS empty FROM events WHERE type = 'search' AND label IS NOT NULL AND ${since} GROUP BY 1 ORDER BY n DESC LIMIT 12`, [days]),
        q(`SELECT country AS code, count(*) AS requests, count(*) FILTER (WHERE type = 'page') AS pages, count(DISTINCT visitor) AS readers FROM events WHERE country IS NOT NULL AND type <> 'time' AND ${since} GROUP BY country ORDER BY requests DESC`, [days]),
      ])
      // The hour of the day (UTC) that carries the most, over the whole period: when to expect load.
      const busiest = await one(`SELECT extract(hour FROM at)::int AS hour, count(*) AS n FROM events WHERE type <> 'time' AND ${since} GROUP BY 1 ORDER BY n DESC LIMIT 1`, [days])
      const unknown = await one(`SELECT count(*) AS n FROM events WHERE country IS NULL AND type <> 'time' AND ${since}`, [days])
      // Time on page: the middle value (half the visits were shorter, half longer), which a few
      // tabs left open all afternoon cannot distort the way an average would.
      const med = 'round(percentile_cont(0.5) WITHIN GROUP (ORDER BY value))::int'
      const [timeAll, timePages, timeCountries] = await Promise.all([
        one(`SELECT ${med} AS median, count(*) AS visits FROM events WHERE type = 'time' AND value > 0 AND ${since}`, [days]),
        q(`SELECT path, ${med} AS median, count(*) AS visits FROM events WHERE type = 'time' AND value > 0 AND ${since} GROUP BY path HAVING count(*) >= 3 ORDER BY visits DESC LIMIT 10`, [days]),
        q(`SELECT country AS code, ${med} AS median, count(*) AS visits FROM events WHERE type = 'time' AND value > 0 AND country IS NOT NULL AND ${since} GROUP BY country HAVING count(*) >= 3 ORDER BY visits DESC LIMIT 10`, [days]),
      ])
      const by3 = (col: string) => q(`SELECT ${col} AS key, count(*) AS n, count(DISTINCT coalesce(visit, visitor)) AS readers FROM events WHERE ${col} IS NOT NULL AND type <> 'time' AND ${since} GROUP BY 1 ORDER BY n DESC LIMIT 8`, [days])
      const [devices, systems, browsers] = await Promise.all([by3('device'), by3('os'), by3('browser')])
      return { days, devices: { device: devices.map(num), os: systems.map(num), browser: browsers.map(num) }, time: { ...num(timeAll), pages: timePages.map(num), countries: timeCountries.map(num) }, totals: num(now), previous: num(before), series: hours.map(num), pages: pages.map(num), referrers: referrers.map(num), clicks: clicks.map(num), searches: searches.map(num), countries: countries.map(num), busiestHour: busiest ? num(busiest) : null, unknownCountry: Number(unknown?.n ?? 0) }
    })

    /**
     * One slice of engagement in detail: everything measured for one country, page, arrival
     * site, click label, search or stretch of time. Returns its totals, when it was busy, what
     * it breaks down into, and the requests themselves with their times, newest first.
     * Requests are never tied to a person: the daily reader code is used for counting only
     * and is not sent to the dashboard.
     */
    admin.get('/engagement/detail', async (req, reply) => {
      const p = z
        .object({
          days: z.coerce.number().int().refine((d) => [1, 7, 30].includes(d)).default(7),
          by: z.enum(['country', 'page', 'ref', 'click', 'search', 'time', 'type', 'device', 'os', 'browser']),
          value: z.string().max(300),
          offset: z.coerce.number().int().min(0).max(100000).default(0),
        })
        .safeParse(req.query)
      if (!p.success) return reply.code(400).send({ error: 'Bad request.' })
      const { days, by, value, offset } = p.data
      const args: unknown[] = [days]
      const add = (v: unknown) => `$${args.push(v)}`
      // Time on page is a measurement, not a request: it has its own figures.
      let where = "at > now() - make_interval(days => $1) AND type <> 'time'"
      if (by === 'country') where += value === 'none' ? ' AND country IS NULL' : ` AND country = ${add(value.toUpperCase())}`
      if (by === 'page') where += ` AND path = ${add(value)} AND type IN ('page', 'view')`
      if (by === 'ref') where += ` AND ref = ${add(value)}`
      if (by === 'click') where += ` AND type = 'click' AND label = ${add(value)}`
      if (by === 'search') where += ` AND type = 'search' AND lower(label) = ${add(value.toLowerCase())}`
      if (by === 'type') where += ` AND type = ${add(value)}`
      if (by === 'device' || by === 'os' || by === 'browser') where += ` AND ${by} = ${add(value)}`
      if (by === 'time') {
        // An hour ("2026-11-15T14:00") or a day ("2026-11-15"), as the chart labels them (UTC).
        const hour = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(value)
        if (!hour && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return reply.code(400).send({ error: 'Bad request.' })
        where += ` AND at >= ${add(value)}::timestamp AND at < ${add(value)}::timestamp + interval '${hour ? '1 hour' : '1 day'}'`
      }
      const num = (r: any) => Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v]))
      const top = (col: string, extra = '') => q(`SELECT ${col} AS key, count(*) AS n FROM events WHERE ${where} AND ${col} IS NOT NULL ${extra} GROUP BY 1 ORDER BY n DESC LIMIT 8`, args)
      const [summary, hours, types, pages, countries, refs, langs, devices, labels, events] = await Promise.all([
        one(`SELECT count(*) AS requests, count(DISTINCT visitor) AS readers, count(*) FILTER (WHERE type = 'page') AS pages, count(*) FILTER (WHERE type = 'view') AS views, count(*) FILTER (WHERE type = 'click') AS clicks, count(*) FILTER (WHERE type = 'search') AS searches, min(at) AS first, max(at) AS last FROM events WHERE ${where}`, args),
        // When in the day it happens (UTC), whatever the period: 24 bars.
        q(`SELECT h AS hour, count(x.at) AS n FROM generate_series(0, 23) h LEFT JOIN (SELECT at FROM events WHERE ${where}) x ON extract(hour FROM x.at)::int = h GROUP BY h ORDER BY h`, args),
        top('type'),
        top('path'),
        top('country'),
        top('ref'),
        top('lang'),
        q(`SELECT concat_ws(' · ', initcap(device), os, browser) AS key, count(*) AS n FROM events WHERE ${where} AND device IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 8`, args),
        q(`SELECT type, label AS key, count(*) AS n FROM events WHERE ${where} AND label IS NOT NULL AND type IN ('click', 'search') GROUP BY 1, 2 ORDER BY n DESC LIMIT 8`, args),
        // The offset is this query's own parameter: the others share `args` and must not see it.
        q(`SELECT at, type, path, label, ref, value, country, lang, device, os, browser, visit FROM events WHERE ${where} ORDER BY at DESC, id DESC LIMIT 60 OFFSET $${args.length + 1}`, [...args, offset]),
      ])
      return { days, by, value, summary: num(summary), hours: hours.map(num), types: types.map(num), pages: pages.map(num), countries: countries.map(num), referrers: refs.map(num), languages: langs.map(num), devices: devices.map(num), labels: labels.map(num), events, offset, more: offset + events.length < Number((summary as any)?.requests ?? 0) }
    })

    /**
     * Visits. A visit is one reader's time on the site in one tab: its pages, clicks and searches
     * in order. It is known only by a random code made in the reader's browser for that visit.
     * It carries no IP address, and visits are not linked to each other or to a person.
     */
    admin.get('/visits', async (req) => {
      const p = z.object({ days: z.coerce.number().int().refine((d) => [1, 7, 30].includes(d)).default(1), offset: z.coerce.number().int().min(0).max(100000).default(0), country: z.string().max(3).optional(), device: z.string().max(10).optional() }).parse(req.query)
      const args: unknown[] = [p.days]
      let where = 'visit IS NOT NULL AND at > now() - make_interval(days => $1)'
      if (p.country) where += ` AND country = $${args.push(p.country.toUpperCase())}`
      if (p.device) where += ` AND device = $${args.push(p.device)}`
      const rows = await q(
        `SELECT visit, min(at) AS started, max(at) AS ended, count(*) FILTER (WHERE type IN ('page', 'view')) AS pages, count(*) FILTER (WHERE type = 'click') AS clicks, count(*) FILTER (WHERE type = 'search') AS searches,
                coalesce(sum(value) FILTER (WHERE type = 'time'), 0) AS seconds, max(country) AS country, max(device) AS device, max(os) AS os, max(browser) AS browser, max(lang) AS lang,
                (array_agg(path ORDER BY at) FILTER (WHERE type IN ('page', 'view')))[1] AS entry, (array_agg(path ORDER BY at DESC) FILTER (WHERE type IN ('page', 'view')))[1] AS exit, (array_agg(ref ORDER BY at) FILTER (WHERE ref IS NOT NULL))[1] AS ref
         FROM events WHERE ${where} GROUP BY visit ORDER BY started DESC LIMIT 50 OFFSET $${args.push(p.offset)}`,
        args
      )
      const total = await one(`SELECT count(DISTINCT visit) AS n, round(avg(pages))::numeric(6,1) AS avg_pages FROM (SELECT visit, count(*) FILTER (WHERE type IN ('page', 'view')) AS pages FROM events WHERE ${where} GROUP BY visit) v`, args.slice(0, -1))
      const numeric = (r: any) => ({ ...r, pages: Number(r.pages), clicks: Number(r.clicks), searches: Number(r.searches), seconds: Number(r.seconds) })
      return { days: p.days, total: Number(total?.n ?? 0), averagePages: total?.avg_pages != null ? Number(total.avg_pages) : null, visits: rows.map(numeric), more: p.offset + rows.length < Number(total?.n ?? 0) }
    })

    /** One visit, step by step, in the order it happened. */
    admin.get('/visits/:id', async (req, reply) => {
      const { id } = z.object({ id: z.string().regex(/^[a-z0-9]{10,24}$/) }).parse(req.params)
      const steps = await q('SELECT at, type, path, label, ref, value, country, lang, device, os, browser FROM events WHERE visit = $1 ORDER BY at, id LIMIT 500', [id])
      if (!steps.length) return reply.code(404).send({ error: 'No such visit. It may be older than the events we keep.' })
      // Story headlines, so a path reads as what it was.
      const slugs = [...new Set(steps.map((s) => String(s.path ?? '').match(/^\/story\/(.+)$/)?.[1]).filter(Boolean))]
      const titles = slugs.length ? await q<{ slug: string; id: string; h: string }>("SELECT slug, id, data->>'h' AS h FROM stories WHERE slug = ANY($1) OR id = ANY($1)", [slugs]) : []
      return { id, steps, titles: Object.fromEntries(titles.flatMap((t) => [[`/story/${t.slug}`, t.h], [`/story/${t.id}`, t.h]])) }
    })

    /**
     * For the 3D view: where the server is, where each country is counted from, and the most
     * recent requests to replay when the site is quiet.
     */
    admin.get('/universe', async () => {
      const REGIONS: [RegExp, number, number, string][] = [
        [/^us-west1/, 45.6, -121.2, 'Oregon, US'], [/^us-west/, 34.05, -118.24, 'California, US'], [/^us-east/, 39.03, -77.48, 'Virginia, US'],
        [/^europe-west4/, 52.37, 4.9, 'Netherlands'], [/^europe/, 50.11, 8.68, 'Europe'], [/^asia-southeast/, 1.35, 103.82, 'Singapore'],
      ]
      const set = config.serverLocation.split(',').map((x) => x.trim())
      const region = REGIONS.find(([re]) => re.test(config.serverRegion))
      const server = set.length >= 2 && Number.isFinite(Number(set[0])) && Number.isFinite(Number(set[1]))
        ? { lat: Number(set[0]), lon: Number(set[1]), label: set[2] || 'Server', known: true }
        : region
          ? { lat: region[1], lon: region[2], label: region[3], known: true }
          : { lat: 52.37, lon: 4.9, label: 'Server', known: false }
      const recent = await q("SELECT at, type, path, label, ref, value, country, lang, device, os, browser, visit FROM events WHERE type <> 'time' AND at > now() - interval '24 hours' ORDER BY at DESC, id DESC LIMIT 400")
      const today = await one("SELECT count(*) AS requests, count(DISTINCT visitor) AS readers, count(DISTINCT country) AS countries FROM events WHERE type <> 'time' AND at > now() - interval '24 hours'")
      const med = await one("SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY value))::int AS median FROM events WHERE type = 'time' AND value > 0 AND at > now() - interval '24 hours'")
      return { server, recent: recent.reverse(), today: { requests: Number(today?.requests ?? 0), readers: Number(today?.readers ?? 0), countries: Number(today?.countries ?? 0), medianSeconds: med?.median ?? null } }
    })

    /* ---------- Trending on the web: the engine's state and its switches ---------- */
    admin.get('/web-trends', async () => engineStatus())

    admin.patch('/web-trends/sources/:id', { preHandler: requireUser('admin') }, async (req, reply) => {
      const { id } = z.object({ id: z.enum(SOURCES.map((s) => s.id) as [string, ...string[]]) }).parse(req.params)
      const body = z.object({ enabled: z.boolean() }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      await setSourceEnabled(id, body.data.enabled)
      await audit(userOf(req), 'webtrends.source', id, body.data)
      return { ok: true }
    })

    /** Words that must not appear in any list. A term containing one is dropped. */
    admin.put('/web-trends/blocked', async (req, reply) => {
      const body = z.object({ terms: z.array(z.string().trim().toLowerCase().min(2).max(60)).max(200) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      await setBlocked([...new Set(body.data.terms)])
      await audit(userOf(req), 'webtrends.blocked', undefined, { count: body.data.terms.length })
      return { ok: true }
    })

    admin.post('/web-trends/refresh', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req, reply) => {
      const body = z.object({ source: z.string().max(20), country: z.string().max(3) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      await refreshNow(body.data.source, body.data.country.toUpperCase())
      return { ok: true }
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

    /** Publish, unpublish or delete several stories at once. Deleting needs an administrator. */
    admin.post('/stories/bulk', async (req, reply) => {
      const body = z.object({ ids: z.array(z.string().max(120)).min(1).max(200), action: z.enum(['publish', 'unpublish', 'delete']) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const { ids, action } = body.data
      if (action === 'delete' && userOf(req).role !== 'admin') return reply.code(403).send({ error: 'Only an administrator can delete stories.' })
      const rows = action === 'delete'
        ? await q('DELETE FROM stories WHERE id = ANY($1) RETURNING id', [ids])
        : await q('UPDATE stories SET published = $2, version = version + 1, updated_at = now(), updated_by = $3 WHERE id = ANY($1) AND published <> $2 RETURNING id', [ids, action === 'publish', userOf(req).id])
      await bump('content')
      await bump('trends')
      await audit(userOf(req), `stories.bulk.${action}`, undefined, { count: rows.length, ids: rows.map((r) => r.id).slice(0, 50) })
      return { ok: true, changed: rows.length }
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

    admin.post('/wire/bulk', async (req, reply) => {
      const body = z.object({ ids: z.array(z.coerce.number().int()).min(1).max(500), action: z.enum(['delete']) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const rows = await q('DELETE FROM wire_items WHERE id = ANY($1) RETURNING id', [body.data.ids])
      await bump('trends')
      await audit(userOf(req), 'wire.bulk.delete', undefined, { count: rows.length })
      return { ok: true, changed: rows.length }
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

    /** Remove reports for good, with the reader's address. Administrators only. */
    admin.post('/corrections/bulk', { preHandler: requireUser('admin') }, async (req, reply) => {
      const body = z.object({ ids: z.array(z.coerce.number().int()).min(1).max(500), action: z.enum(['delete']) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const rows = await q('DELETE FROM corrections WHERE id = ANY($1) RETURNING id', [body.data.ids])
      await audit(userOf(req), 'corrections.bulk.delete', undefined, { count: rows.length })
      return { ok: true, changed: rows.length }
    })

    admin.post('/enquiries/bulk', { preHandler: requireUser('admin') }, async (req, reply) => {
      const body = z.object({ ids: z.array(z.coerce.number().int()).min(1).max(500), action: z.enum(['delete']) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const rows = await q('DELETE FROM enquiries WHERE id = ANY($1) RETURNING id', [body.data.ids])
      await audit(userOf(req), 'enquiries.bulk.delete', undefined, { count: rows.length })
      return { ok: true, changed: rows.length }
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
     * Several subscribers at once. Administrators only.
     *   delete       remove the address for good (for a reader who asks to be forgotten)
     *   unsubscribe  stop sending, keep the record so they are not emailed again by mistake
     *   resend       send the confirmation email again to those who have not confirmed
     */
    admin.post('/subscribers/bulk', { preHandler: requireUser('admin'), config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
      const body = z.object({ ids: z.array(z.coerce.number().int()).min(1).max(500), action: z.enum(['delete', 'unsubscribe', 'resend']) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const { ids, action } = body.data
      let changed = 0
      if (action === 'delete') changed = (await q('DELETE FROM subscribers WHERE id = ANY($1) RETURNING id', [ids])).length
      if (action === 'unsubscribe') changed = (await q("UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = now() WHERE id = ANY($1) AND status IN ('pending', 'confirmed') RETURNING id", [ids])).length
      if (action === 'resend') {
        if (!mailConfigured()) return reply.code(409).send({ error: 'Email is not connected yet: RESEND_API_KEY is not set on the API.' })
        // Only people who asked and have not answered, 100 at a time, and not twice within three minutes.
        const rows = await q<{ email: string; token: string }>("UPDATE subscribers SET confirm_sent_at = now() WHERE id IN (SELECT id FROM subscribers WHERE id = ANY($1) AND status = 'pending' AND (confirm_sent_at IS NULL OR confirm_sent_at < now() - interval '3 minutes') ORDER BY id LIMIT 100) RETURNING email, token", [ids])
        for (const r of rows) sendLater({ to: r.email, kind: 'subscribe.confirm', mail: T.confirmSubscription({ site: siteUrl() }, confirmLink(r.token)) })
        changed = rows.length
      }
      await audit(userOf(req), `subscribers.bulk.${action}`, undefined, { count: changed })
      return { ok: true, changed }
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
        replyToRejected: config.mailReplyToRejected || null,
        postalAddress: config.mailPostalAddress || null,
        webhook: !!config.resendWebhookSecret,
        counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
        templates: TEMPLATES.map(([id, name, when]) => ({ id, name, when })),
        stories: (await latestStories(14)).map((x) => ({ id: x.id, h: x.h, section: x.section })),
        recent: await q('SELECT id, at, kind, recipient, subject, status, error FROM emails ORDER BY at DESC LIMIT 60'),
        editions: await q('SELECT n.id, n.subject, n.intro, n.story_ids, n.status, n.recipients, n.delivered, n.failed, n.created_at, u.name AS sent_by FROM newsletters n LEFT JOIN users u ON u.id = n.sent_by ORDER BY n.created_at DESC LIMIT 20'),
      }
    })

    /** The DNS records and settings that decide whether email reaches the inbox or the spam folder. */
    admin.get('/mail/check', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async () => deliverability())

    /**
     * Editions already sent. "delete" removes the records. "reset" releases an edition stuck on
     * "Sending" (for example after a restart mid-send), so the next one can go out.
     */
    admin.post('/newsletters/bulk', { preHandler: requireUser('admin') }, async (req, reply) => {
      const body = z.object({ ids: z.array(z.coerce.number().int()).min(1).max(200), action: z.enum(['delete', 'reset']) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      const rows = body.data.action === 'delete' ? await q("DELETE FROM newsletters WHERE id = ANY($1) AND status <> 'sending' RETURNING id", [body.data.ids]) : await q("UPDATE newsletters SET status = 'failed' WHERE id = ANY($1) AND status = 'sending' RETURNING id", [body.data.ids])
      await audit(userOf(req), `newsletters.bulk.${body.data.action}`, undefined, { count: rows.length })
      return { ok: true, changed: rows.length }
    })

    /** Empty the log of sent email. The emails themselves are not affected. */
    admin.delete('/mail/log', { preHandler: requireUser('admin') }, async (req) => {
      const rows = await q('DELETE FROM emails RETURNING id')
      await audit(userOf(req), 'mail.log.cleared', undefined, { count: rows.length })
      return { ok: true, changed: rows.length }
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

    /** A new first password for someone who is locked out. They must replace it at their next sign-in. */
    admin.post('/users/:id/password', { preHandler: requireUser('admin') }, async (req, reply) => {
      const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params)
      const body = z.object({ password: z.string().min(12).max(200) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: 'The password needs at least 12 characters.' })
      if (id === userOf(req).id) return reply.code(400).send({ error: 'Change your own password under Your account.' })
      const row = await one('UPDATE users SET password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = NULL WHERE id = $1 RETURNING email', [id, await hashPassword(body.data.password)])
      if (!row) return reply.code(404).send({ error: 'No such person.' })
      await q('DELETE FROM sessions WHERE user_id = $1', [id])
      await audit(userOf(req), 'user.password_reset', String(id))
      return { ok: true }
    })

    /** Remove an account for good. What they wrote and changed stays, without their name. */
    admin.delete('/users/:id', { preHandler: requireUser('admin') }, async (req, reply) => {
      const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params)
      if (id === userOf(req).id) return reply.code(400).send({ error: 'You cannot delete your own account. Ask another administrator.' })
      const row = await one<{ email: string; role: string }>('SELECT email, role FROM users WHERE id = $1', [id])
      if (!row) return reply.code(404).send({ error: 'No such person.' })
      await q('DELETE FROM users WHERE id = $1', [id])
      await audit(userOf(req), 'user.deleted', String(id), { email: row.email, role: row.role })
      return { ok: true }
    })

    /* ---------- Sync and reset ---------- */

    /** Work out the newsroom's own trends again now, and serve the edition fresh. */
    admin.post('/trends/recalculate', async (req) => {
      await bump('trends')
      await bump('content')
      await bump('webtrends')
      await audit(userOf(req), 'cache.cleared')
      return { ok: true }
    })

    /** Queue outside lists for fetching: one source or all. `reset` empties them first (administrators). */
    admin.post('/web-trends/sync', { config: { rateLimit: { max: 12, timeWindow: '10 minutes' } } }, async (req, reply) => {
      const body = z.object({ source: z.enum(['all', ...SOURCES.map((s) => s.id)] as [string, ...string[]]).default('all'), reset: z.boolean().default(false) }).safeParse(req.body)
      if (!body.success) return reply.code(400).send(bad(body.error))
      if (body.data.reset && userOf(req).role !== 'admin') return reply.code(403).send({ error: 'Only an administrator can reset the lists.' })
      const result = await syncAll(body.data.source === 'all' ? null : body.data.source, body.data.reset)
      await audit(userOf(req), body.data.reset ? 'webtrends.reset' : 'webtrends.sync', body.data.source, result)
      return result
    })

    admin.post('/web-trends/sources/:id/resume', { preHandler: requireUser('admin') }, async (req) => {
      const { id } = z.object({ id: z.enum(SOURCES.map((s) => s.id) as [string, ...string[]]) }).parse(req.params)
      await resumeSource(id)
      await audit(userOf(req), 'webtrends.resumed', id)
      return { ok: true }
    })

    admin.get('/audit', { preHandler: requireUser('admin') }, async () => ({
      entries: await q('SELECT a.id, a.at, a.action, a.target, a.detail, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.at DESC LIMIT 200'),
    }))
  }, { prefix: '/admin' })
}
