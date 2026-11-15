/**
 * The live wire. New items are announced through Postgres LISTEN / NOTIFY, so every API
 * instance hears about an item filed on any other and can push it to its connected readers.
 */
import pg from 'pg'

import { config } from './config'
import { one, q } from './db'

export type WireItem = { id: number; at: string; time: string; desk: string; cat: string; text: string; storyId?: string; kind: string }

const out = (r: any): WireItem => {
  const at = new Date(r.at)
  return { id: Number(r.id), at: at.toISOString(), time: at.toISOString().slice(11, 16), desk: r.desk, cat: r.cat, text: r.text, storyId: r.story_id ?? undefined, kind: r.kind }
}

export const recentWire = async (limit = 40) => (await q('SELECT * FROM wire_items ORDER BY at DESC, id DESC LIMIT $1', [limit])).map(out)

export async function addWire(item: { desk: string; cat: string; text: string; storyId?: string; kind: string }, userId: number) {
  const row = await one('INSERT INTO wire_items (desk, cat, text, story_id, kind, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [item.desk, item.cat, item.text, item.storyId || null, item.kind, userId])
  await q("SELECT pg_notify('wire', $1)", [String(row!.id)])
  return out(row)
}

const listeners = new Set<(item: WireItem) => void>()
export function onWire(fn: (item: WireItem) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Keep one connection listening for new wire items, reconnecting if it drops. */
export async function listenForWire() {
  const client = new pg.Client({ connectionString: config.databaseUrl, ssl: /sslmode=require|\.proxy\.rlwy\.net/.test(config.databaseUrl) ? { rejectUnauthorized: false } : undefined })
  const retry = () => setTimeout(() => listenForWire().catch(() => {}), 3000)
  client.on('error', retry)
  client.on('notification', async (msg) => {
    const row = await one('SELECT * FROM wire_items WHERE id = $1', [Number(msg.payload)])
    if (row) listeners.forEach((fn) => fn(out(row)))
  })
  try {
    await client.connect()
    await client.query('LISTEN wire')
  } catch {
    retry()
  }
}
