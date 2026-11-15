/**
 * A small message bus between API instances, carried by Postgres LISTEN / NOTIFY. Anything
 * that changes says so here ("a reader event arrived", "the inbox changed"), every instance
 * hears it, and each pushes it to the browsers connected to it (see live.ts). With one
 * instance it works the same way; nothing extra is needed to run more.
 *
 * Messages are signals, not data stores: small, and safe to lose. A browser that misses one
 * catches up on its next refresh.
 */
import pg from 'pg'

import { config } from './config'
import { q } from './db'

export type BusMessage = { t: string; d?: unknown }
const handlers = new Set<(m: BusMessage) => void>()

/** Tell every instance. Never throws: a signal that cannot be sent must not fail the request that caused it. */
export function publish(t: string, d?: unknown) {
  const text = JSON.stringify(d === undefined ? { t } : { t, d })
  // NOTIFY carries at most 8000 bytes. Anything bigger is sent as the bare signal.
  q("SELECT pg_notify('ma_live', $1)", [text.length < 7000 ? text : JSON.stringify({ t })]).catch(() => {})
}

export function onBus(fn: (m: BusMessage) => void) {
  handlers.add(fn)
  return () => handlers.delete(fn)
}

/** Keep one connection listening, reconnecting if it drops. */
export async function listenToBus() {
  const client = new pg.Client({ connectionString: config.databaseUrl, ssl: /sslmode=require|\.proxy\.rlwy\.net/.test(config.databaseUrl) ? { rejectUnauthorized: false } : undefined })
  let retried = false
  const retry = () => {
    if (retried) return
    retried = true
    client.end().catch(() => {})
    setTimeout(() => listenToBus().catch(() => {}), 3000)
  }
  client.on('error', retry)
  client.on('end', retry)
  client.on('notification', (msg) => {
    try {
      const m = JSON.parse(msg.payload ?? '') as BusMessage
      if (typeof m?.t === 'string') handlers.forEach((fn) => fn(m))
    } catch {
      /* not ours */
    }
  })
  try {
    await client.connect()
    await client.query('LISTEN ma_live')
  } catch {
    retry()
  }
}
