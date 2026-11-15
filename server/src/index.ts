/**
 * MirrorActu API.
 *
 *   /api/v1/…            public: bootstrap, stories, trends, wire (and its live stream), forms
 *   /api/v1/auth/…       staff sign-in
 *   /api/v1/admin/…      the dashboard, signed-in staff only
 *
 * On start it waits for the database, applies migrations, loads first-run content, and creates
 * any staff accounts listed in ADMIN_EMAILS / EDITOR_EMAILS that do not exist yet.
 */
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { ZodError } from 'zod'

import { syncStaff } from './auth'
import { checkConfig, config } from './config'
import { migrate, pool, q, waitForDb } from './db'
import { adminRoutes } from './routes/admin'
import { publicRoutes } from './routes/public'
import { seed } from './seed'
import { listenForWire } from './wire'

checkConfig()

const app = Fastify({
  logger: { level: config.logLevel, redact: ['req.headers.cookie', 'req.headers.authorization'] },
  // Behind nginx / a platform proxy: take the reader's address from X-Forwarded-For.
  trustProxy: true,
  bodyLimit: 64 * 1024,
})

await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } })
await app.register(cookie)
await app.register(rateLimit, { max: config.rateLimitPerMinute, timeWindow: '1 minute' })

// Never leak stack traces or SQL to a caller.
app.setErrorHandler((err: any, req, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ error: 'Bad request.' })
  if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.statusCode === 429 ? 'Too many requests. Wait a minute and try again.' : err.message })
  req.log.error(err)
  return reply.code(500).send({ error: 'Something went wrong on our side.' })
})

// The same health path as the two websites, so one health check setting fits every service.
app.get('/healthz', async () => 'ok\n')

await app.register(async (api) => {
  await api.register(publicRoutes)
  await api.register(adminRoutes)
}, { prefix: '/api/v1' })

await waitForDb()
await migrate()
if (config.seedContent) await seed()
await syncStaff()
await listenForWire()

// Housekeeping: drop expired sessions hourly, and readership events after 90 days.
setInterval(() => {
  q('DELETE FROM sessions WHERE expires_at < now()').catch(() => {})
  q('DELETE FROM events WHERE at < now() - make_interval(days => $1)', [config.eventsRetentionDays]).catch(() => {})
}, 3600_000).unref()

// '::' accepts both IPv4 and IPv6. Private networks on some hosts (Railway) are IPv6 only.
await app.listen({ port: config.port, host: '::' })
console.log(`MirrorActu API listening on :${config.port}`)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}
