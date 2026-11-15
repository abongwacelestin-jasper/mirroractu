import { useEffect, useState } from 'react'

import { siteSocket } from './socket'
import { api, apiOnline } from '@/lib/api'
import { useEdition } from '@/lib/edition'

export type WebTrend = { title: string; url: string; note: string; headline?: { title: string; url: string; publisher: string } }
export type WebList = { source: 'google' | 'gdelt' | 'wikimedia'; label: string; about: string; credit: { name: string; url: string }; fetchedAt: string | null; items: WebTrend[] }
export type WebLevel = { level: 'country' | 'region' | 'global'; name: string; lists: WebList[] }

const cache = new Map<string, WebLevel[]>()

/**
 * "Trending on the web": what outside sources show is trending for the reader's country, its
 * region and the world (GET /api/v1/web-trends). Refreshed every two minutes; the API decides
 * how often each source is really asked. Empty when the API is offline or has nothing yet.
 */
export function useWebTrends(): WebLevel[] {
  const [country] = useEdition()
  const code = country.code === 'INT' ? '' : country.code
  const [levels, setLevels] = useState<WebLevel[]>(cache.get(code) ?? [])
  useEffect(() => {
    if (!apiOnline) return
    let alive = true
    setLevels(cache.get(code) ?? [])
    const load = () =>
      api<{ levels: WebLevel[] }>(`/web-trends${code ? `?country=${code}` : ''}`)
        .then((d) => {
          cache.set(code, d.levels)
          if (alive) setLevels(d.levels)
        })
        .catch(() => {})
    load()
    // The API nudges when a list changes; the timer is only the fallback.
    const off = siteSocket.subscribe((m) => (m.t === 'webtrends' || m.t === 'resync') && load())
    const t = window.setInterval(load, 300000)
    return () => {
      alive = false
      off()
      window.clearInterval(t)
    }
  }, [code])
  return levels
}

/** "12 minutes ago", "3 hours ago", "yesterday" */
export function ago(iso: string | null): string {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 2) return 'just now'
  if (m < 60) return `${m} minutes ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  return h < 48 ? 'yesterday' : `${Math.round(h / 24)} days ago`
}
