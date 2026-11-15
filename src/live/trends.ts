import { useEffect, useMemo, useState } from 'react'

import { siteSocket } from './socket'
import { Story, getStory } from '@/data'
import { getCountry } from '@/data/countries'
import { TREND_TOPICS, TrendTopic } from '@/data/trends'
import { api, apiOnline } from '@/lib/api'
import { useEdition } from '@/lib/edition'
import { useWire } from './feed'

export type Trend = TrendTopic & {
  rank: number
  /** Places moved since the start of the day's ranking: positive is up. */
  moved: number
  stories: Story[]
  /** Wire updates on this subject in the last day */
  wireCount: number
  /** True if one of the five newest wire updates is on this subject */
  activeNow: boolean
  /** Measured readers in this level's area, last 24 hours. Absent offline. */
  readers?: number
  /** Stories on this subject that are about this level's area */
  localStories?: number
  /** Why it is on the list: about this place, read in this place, or big everywhere */
  basis?: 'local' | 'read-here' | 'wider'
}

/** One rung of the ladder: the reader's country, their region, or the world. */
export type TrendLevel = { level: 'country' | 'region' | 'global'; name: string; code?: string; measuredReaders: number; trends: Trend[] }

type ApiTrend = Omit<Trend, 'stories'>
type ApiLevel = Omit<TrendLevel, 'trends'> & { trends: ApiTrend[] }

// With the WebSocket connected, a change arrives as a nudge within a second; this is the fallback pace.
const REFRESH_MS = 120000
/** Every mounted trends list, so one nudge from the API reloads them all. */
const reloaders = new Set<() => void>()
let listening = false
function listen() {
  if (listening) return
  listening = true
  let timer = 0
  siteSocket.subscribe((m) => {
    if (m.t !== 'trends' && m.t !== 'content' && m.t !== 'resync') return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => reloaders.forEach((r) => r()), 1200)
  })
}
const cache = new Map<string, ApiLevel[]>()

/**
 * Today's trends as a ladder from the reader outwards: their country, their region, the world.
 * With the API online each level is ranked by stories about that place, wire activity and
 * measured readership there (GET /api/v1/trends?country=RW), refreshed every 45 seconds.
 * Offline there is one level, global, worked out here from stories and the wire.
 */
export function useTrendLevels(): TrendLevel[] {
  const [country] = useEdition()
  const { items } = useWire({ max: 40 })
  const code = country.code === 'INT' ? '' : country.code
  const [remote, setRemote] = useState<ApiLevel[] | null>(cache.get(code) ?? null)

  useEffect(() => {
    if (!apiOnline) return
    listen()
    let alive = true
    setRemote(cache.get(code) ?? null)
    const load = () =>
      api<{ levels: ApiLevel[] }>(`/trends${code ? `?country=${code}` : ''}`)
        .then((d) => {
          cache.set(code, d.levels)
          if (alive) setRemote(d.levels)
        })
        .catch(() => {})
    load()
    reloaders.add(load)
    const t = window.setInterval(load, REFRESH_MS)
    return () => {
      reloaders.delete(load)
      alive = false
      window.clearInterval(t)
    }
  }, [code])

  return useMemo(() => {
    const withStories = <T extends TrendTopic>(t: T) => ({ ...t, stories: t.storyIds.map(getStory).filter(Boolean) as Story[] })
    if (remote) return remote.map((l) => ({ ...l, trends: l.trends.map(withStories).filter((t) => t.stories.length > 0) }))

    const base = [...TREND_TOPICS].sort((a, b) => b.storyIds.length - a.storyIds.length).map((t) => t.id)
    const trends = TREND_TOPICS.map((t) => {
      const wire = items.filter((w) => w.storyId && t.storyIds.includes(w.storyId))
      const newest = items.slice(0, 5).some((w) => w.storyId && t.storyIds.includes(w.storyId))
      return { t, wireCount: wire.length, activeNow: newest, score: t.storyIds.length + wire.length * 0.5 + (newest ? 0.75 : 0) }
    })
      .sort((a, b) => b.score - a.score)
      .map(({ t, wireCount, activeNow }, i) => ({ ...withStories(t), rank: i + 1, moved: base.indexOf(t.id) - i, wireCount, activeNow }))
      .filter((t) => t.stories.length > 0)
    return [{ level: 'global' as const, name: 'Global', measuredReaders: 0, trends }]
  }, [items, remote])
}

/** The global ranking alone. */
export function useTrends(): Trend[] {
  const levels = useTrendLevels()
  return levels[levels.length - 1].trends
}

/** "In Rwanda", "Across Africa", "Around the world". */
export function levelTitle(l: TrendLevel) {
  if (l.level === 'global') return 'Around the world'
  if (l.level === 'region') return l.name === 'Americas' ? 'Across the Americas' : l.name === 'Middle East' ? 'Across the Middle East' : `Across ${l.name}`
  const the = ['US', 'GB', 'AE'].includes(l.code ?? '') ? 'the ' : ''
  return `In ${the}${getCountry(l.code).name}`
}
