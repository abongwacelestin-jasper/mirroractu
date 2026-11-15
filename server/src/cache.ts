/**
 * Caching. With REDIS_URL set, answers are cached in Redis and shared by every API instance.
 * Without it, or while Redis is unreachable, each instance falls back to a small cache in its
 * own memory, so the API keeps working either way.
 *
 * Nothing is deleted on a change. Each group of keys ("content", "trends") carries a version
 * number in its key; changing something bumps the number, new requests use new keys, and the
 * old ones expire by themselves.
 */
import Redis from 'ioredis'

import { publish } from './bus'
import { config } from './config'

let redis: Redis | null = null
let lastError = 0
const memory = new Map<string, { expires: number; value: string }>()
const versions = new Map<string, { value: number; checked: number }>()

export function startCache() {
  if (!config.redisUrl) {
    console.log('Cache: in memory (REDIS_URL is not set)')
    return
  }
  redis = new Redis(config.redisUrl, {
    // Fail fast: a slow cache must never slow a page. The caller falls back to memory.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    retryStrategy: (times) => Math.min(times * 500, 10000),
    // Railway and other private networks may be IPv6 only.
    family: 0,
  })
  redis.on('ready', () => console.log('Cache: Redis connected'))
  redis.on('error', (e) => {
    // One line a minute at most, however often it retries.
    if (Date.now() - lastError > 60000) console.warn(`Cache: Redis unavailable, using memory (${e.message})`)
    lastError = Date.now()
  })
}

export const cacheBackend = () => (redis?.status === 'ready' ? 'redis' : 'memory')
/** The connection, for other parts that can use Redis (rate limiting). Null without REDIS_URL. */
export const redisClient = () => redis

async function version(group: string) {
  const known = versions.get(group)
  if (known && Date.now() - known.checked < 2000) return known.value
  let value = known?.value ?? 0
  if (redis?.status === 'ready') {
    try {
      value = Number(await redis.get(`ma:version:${group}`)) || 0
    } catch {
      /* keep the last known version */
    }
  }
  versions.set(group, { value, checked: Date.now() })
  return value
}

/** Everything cached under `group` is now out of date. */
export async function bump(group: string) {
  // Open pages and the dashboard are told at once that this has changed (see live.ts).
  publish(group)
  const next = ((versions.get(group)?.value ?? 0) + 1) | 0
  versions.set(group, { value: next, checked: Date.now() })
  if (redis?.status === 'ready') {
    try {
      const v = await redis.incr(`ma:version:${group}`)
      versions.set(group, { value: v, checked: Date.now() })
    } catch {
      /* this instance is updated; others catch up when Redis is back */
    }
  }
}

/**
 * Return the cached answer for `key`, or work it out with `compute`, remember it for
 * `ttlSeconds`, and return that.
 */
export async function cached<T>(group: string, key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const full = `ma:${group}:${await version(group)}:${key}`
  if (redis?.status === 'ready') {
    try {
      const hit = await redis.get(full)
      if (hit !== null) return JSON.parse(hit) as T
    } catch {
      /* fall through to memory */
    }
  }
  const local = memory.get(full)
  if (local && local.expires > Date.now()) return JSON.parse(local.value) as T

  const value = await compute()
  const text = JSON.stringify(value)
  memory.set(full, { expires: Date.now() + ttlSeconds * 1000, value: text })
  if (memory.size > 500) for (const [k, v] of memory) if (v.expires < Date.now()) memory.delete(k)
  if (redis?.status === 'ready') redis.set(full, text, 'EX', ttlSeconds).catch(() => {})
  return value
}
