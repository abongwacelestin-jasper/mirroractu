import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

import { config } from './config'

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  // Managed Postgres (Railway and others) needs TLS from outside its private network.
  ssl: /sslmode=require|\.proxy\.rlwy\.net/.test(config.databaseUrl) ? { rejectUnauthorized: false } : undefined,
})

/** Run a query. Values are always passed as parameters, never built into the SQL text. */
export async function q<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query<T>(text, params)
  return r.rows
}
export const one = async <T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) => (await q<T>(text, params))[0] as T | undefined

/** Apply any migration files that have not run yet, in name order, each in a transaction. */
export async function migrate() {
  const here = dirname(fileURLToPath(import.meta.url))
  const dir = [join(here, '../migrations'), join(here, 'migrations')].find((d) => {
    try {
      return readdirSync(d).length > 0
    } catch {
      return false
    }
  })
  if (!dir) throw new Error('Migrations folder not found')
  await pool.query('CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const done = new Set((await q<{ name: string }>('SELECT name FROM migrations')).map((r) => r.name))
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(readFileSync(join(dir, name), 'utf8'))
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [name])
      await client.query('COMMIT')
      console.log(`Applied migration ${name}`)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

/** Wait for the database to accept connections (it may still be starting). */
export async function waitForDb(tries = 30) {
  for (let i = 1; ; i++) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (e) {
      if (i >= tries) throw e
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}
