/**
 * Real time, over WebSockets.
 *
 *   /api/v1/live         the public site: the live wire, and a nudge whenever trends, outside
 *                        trends or the edition change, so open pages update by themselves.
 *   /api/v1/admin/live   the dashboard (signed-in staff, through the dashboard's own server):
 *                        all of that, plus reader activity as it happens, how many readers
 *                        are on the site right now and from where, and a nudge whenever the
 *                        inbox, subscribers, email, staff or the trends engine change.
 *
 * Browsers only listen. The one thing the site may say is which country edition it is showing,
 * and it says that only for readers who allowed measurement; everyone else is counted without
 * a country. Nothing identifies a reader: a connection is a number in a count.
 */
import websocket from '@fastify/websocket'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'

import { currentUser, sameOrigin, throughAdminGateway } from './auth'
import { BusMessage, onBus } from './bus'
import { redisClient } from './cache'
import { onWire, recentWire } from './wire'

type Client = { socket: WebSocket; admin: boolean; country: string | null; alive: boolean; ip: string }
const clients = new Set<Client>()
const INSTANCE = randomBytes(6).toString('hex')
const MAX_TOTAL = 20000
const MAX_PER_ADDRESS = 30

/** What the public site may hear. Everything else is for staff. */
const PUBLIC_TOPICS = new Set(['wire', 'trends', 'webtrends', 'content'])

const send = (c: Client, message: unknown) => {
  if (c.socket.readyState === 1) c.socket.send(JSON.stringify(message))
}
const broadcast = (message: BusMessage, to: 'all' | 'admin') => {
  const text = JSON.stringify(message)
  for (const c of clients) if ((to === 'all' || c.admin) && c.socket.readyState === 1) c.socket.send(text)
}

/* ---------- From the bus to the browsers ---------- */

// Signals are held for a moment and sent once, so a burst of changes is one nudge, not fifty.
const pending = new Map<string, NodeJS.Timeout>()
const nudge = (t: string) => {
  if (pending.has(t)) return
  pending.set(t, setTimeout(() => {
    pending.delete(t)
    broadcast({ t }, PUBLIC_TOPICS.has(t) ? 'all' : 'admin')
  }, 700))
}
// Reader events go to the dashboard in small batches, twice a second at most.
let events: unknown[] = []
let dropped = 0
setInterval(() => {
  if (!events.length) return
  broadcast({ t: 'events', d: { items: events, more: dropped } }, 'admin')
  events = []
  dropped = 0
}, 500).unref()

function onMessage(m: BusMessage) {
  if (m.t === 'event') {
    if (events.length < 40) events.push(m.d)
    else dropped++
    return
  }
  nudge(m.t)
}

/* ---------- Who is on the site right now ---------- */

type Presence = { total: number; countries: Record<string, number> }
let lastPresence = ''

function localPresence(): Presence {
  const p: Presence = { total: 0, countries: {} }
  for (const c of clients) {
    if (c.admin) continue
    p.total++
    if (c.country) p.countries[c.country] = (p.countries[c.country] ?? 0) + 1
  }
  return p
}

/** This instance's count, added to the others' when Redis is there to share them. */
async function presence(): Promise<Presence> {
  const mine = localPresence()
  const redis = redisClient()
  if (redis?.status !== 'ready') return mine
  try {
    await redis.set(`ma:live:presence:${INSTANCE}`, JSON.stringify(mine), 'EX', 20)
    const keys: string[] = []
    let cursor = '0'
    do {
      const [next, found] = await redis.scan(cursor, 'MATCH', 'ma:live:presence:*', 'COUNT', 100)
      cursor = next
      keys.push(...found)
    } while (cursor !== '0' && keys.length < 200)
    const all: Presence = { total: 0, countries: {} }
    for (const raw of keys.length ? await redis.mget(keys) : []) {
      if (!raw) continue
      const p = JSON.parse(raw) as Presence
      all.total += p.total
      for (const [k, n] of Object.entries(p.countries)) all.countries[k] = (all.countries[k] ?? 0) + n
    }
    return all
  } catch {
    return mine
  }
}

async function tellPresence(force = false) {
  if (![...clients].some((c) => c.admin)) return
  const p = await presence()
  const text = JSON.stringify(p)
  if (!force && text === lastPresence) return
  lastPresence = text
  broadcast({ t: 'presence', d: p }, 'admin')
}

/* ---------- Connections ---------- */

function accept(socket: WebSocket, req: FastifyRequest, admin: boolean) {
  const ip = req.ip
  let fromHere = 0
  for (const c of clients) if (c.ip === ip) fromHere++
  if (clients.size >= MAX_TOTAL || fromHere >= MAX_PER_ADDRESS) {
    socket.close(1013, 'Too many connections')
    return
  }
  const client: Client = { socket, admin, country: null, alive: true, ip }
  clients.add(client)
  socket.on('pong', () => {
    client.alive = true
  })
  socket.on('close', () => clients.delete(client))
  socket.on('error', () => clients.delete(client))
  socket.on('message', (raw) => {
    // The only thing a browser may tell us: which country edition it is showing.
    if (admin || String(raw).length > 200) return
    try {
      const m = JSON.parse(String(raw))
      if (m?.t === 'hello') client.country = typeof m.country === 'string' && /^[A-Z]{2}$/.test(m.country) ? m.country : null
    } catch {
      /* ignored */
    }
  })
  send(client, { t: 'ready', d: { admin } })
  // The wire as it stands, then each new item as it is filed.
  recentWire(40).then((items) => send(client, { t: 'wire.backfill', d: items })).catch(() => {})
  if (admin) tellPresence(true).catch(() => {})
}

export async function liveRoutes(app: FastifyInstance) {
  await app.register(websocket, { options: { maxPayload: 1024 } })

  app.get('/live', { websocket: true, config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, preValidation: async (req, reply) => {
    // Browsers always say where a WebSocket is opened from: only our own site may connect.
    if (!sameOrigin(req)) return reply.code(403).send({ error: 'Request did not come from the MirrorActu site.' })
  } }, (socket, req) => accept(socket, req, false))

  app.get('/admin/live', { websocket: true, preValidation: async (req, reply) => {
    if (!throughAdminGateway(req)) return reply.code(404).send({ error: 'Not found.' })
    if (!sameOrigin(req, 'admin')) return reply.code(403).send({ error: 'Request did not come from the MirrorActu dashboard.' })
    const user = await currentUser(req)
    if (!user || user.mustChangePassword) return reply.code(401).send({ error: 'Sign in first.' })
  } }, (socket, req) => accept(socket, req, true))
}

export function startLive() {
  onBus(onMessage)
  onWire((item) => broadcast({ t: 'wire', d: item }, 'all'))
  // Drop connections that have gone quiet, and keep the rest open through proxies.
  setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.socket.terminate()
        clients.delete(c)
        continue
      }
      c.alive = false
      try {
        c.socket.ping()
      } catch {
        clients.delete(c)
      }
    }
  }, 25000).unref()
  setInterval(() => tellPresence().catch(() => {}), 4000).unref()
  console.log('Live: WebSockets ready (/api/v1/live, /api/v1/admin/live)')
}
