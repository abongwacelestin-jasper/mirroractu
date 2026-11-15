import { useEffect, useMemo, useState } from 'react'

import { Story, getStory } from '@/data'
import { TREND_TOPICS, TrendTopic } from '@/data/trends'
import { api, apiOnline } from '@/lib/api'
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
  /** Readers in the last 24 hours, counted only among those who allowed measurement. Absent offline. */
  readers?: number
}

type ApiTrend = TrendTopic & { rank: number; moved: number; wireCount: number; activeNow: boolean; readers: number }

const REFRESH_MS = 45000
let cache: ApiTrend[] | null = null

/**
 * Today's trends, ranked. With the API online the ranking comes from GET /api/v1/trends:
 * stories filed, wire activity and real readership over the last 24 hours, refreshed every
 * 45 seconds. Offline, it falls back to stories filed plus wire activity, worked out here.
 */
export function useTrends(): Trend[] {
  const { items } = useWire({ max: 40 })
  const [remote, setRemote] = useState<ApiTrend[] | null>(cache)

  useEffect(() => {
    if (!apiOnline) return
    let alive = true
    const load = () =>
      api<{ trends: ApiTrend[] }>('/trends')
        .then((d) => {
          cache = d.trends
          if (alive) setRemote(d.trends)
        })
        .catch(() => {})
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  return useMemo(() => {
    const withStories = <T extends TrendTopic>(t: T) => ({ ...t, stories: t.storyIds.map(getStory).filter(Boolean) as Story[] })
    if (remote) return remote.map(withStories).filter((t) => t.stories.length > 0)

    const base = [...TREND_TOPICS].sort((a, b) => b.storyIds.length - a.storyIds.length).map((t) => t.id)
    return TREND_TOPICS.map((t) => {
      const wire = items.filter((w) => w.storyId && t.storyIds.includes(w.storyId))
      const newest = items.slice(0, 5).some((w) => w.storyId && t.storyIds.includes(w.storyId))
      return { t, wireCount: wire.length, activeNow: newest, score: t.storyIds.length + wire.length * 0.5 + (newest ? 0.75 : 0) }
    })
      .sort((a, b) => b.score - a.score)
      .map(({ t, wireCount, activeNow }, i) => ({ ...withStories(t), rank: i + 1, moved: base.indexOf(t.id) - i, wireCount, activeNow }))
      .filter((t) => t.stories.length > 0)
  }, [items, remote])
}
