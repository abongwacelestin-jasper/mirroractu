import { useMemo } from 'react'

import { Story, getStory } from '@/data'
import { TREND_TOPICS, TrendTopic } from '@/data/trends'
import { useWire } from './feed'

export type Trend = TrendTopic & {
  rank: number
  /** Places moved since the start of the day's ranking: positive is up. */
  moved: number
  stories: Story[]
  /** Wire updates on this subject among the latest on the wire */
  wireCount: number
  /** True if one of the five newest wire updates is on this subject */
  activeNow: boolean
}

/**
 * Today's trends, ranked. A subject scores one point per story filed and half a point per
 * recent wire update, so the order shifts through the day as desks file.
 */
export function useTrends(): Trend[] {
  const { items } = useWire({ max: 40 })
  return useMemo(() => {
    const base = [...TREND_TOPICS].sort((a, b) => b.storyIds.length - a.storyIds.length).map((t) => t.id)
    const scored = TREND_TOPICS.map((t) => {
      const wire = items.filter((w) => w.storyId && t.storyIds.includes(w.storyId))
      const newest = items.slice(0, 5).some((w) => w.storyId && t.storyIds.includes(w.storyId))
      return { t, wireCount: wire.length, activeNow: newest, score: t.storyIds.length + wire.length * 0.5 + (newest ? 0.75 : 0) }
    }).sort((a, b) => b.score - a.score)
    return scored.map(({ t, wireCount, activeNow }, i) => ({
      ...t,
      rank: i + 1,
      moved: base.indexOf(t.id) - i,
      stories: t.storyIds.map(getStory).filter(Boolean) as Story[],
      wireCount,
      activeNow,
    }))
  }, [items])
}
