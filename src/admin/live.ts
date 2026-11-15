/**
 * The dashboard's real-time connection (see server/src/live.ts). Pages say which subjects they
 * care about and are told the moment one changes, so nothing needs refreshing by hand.
 *
 *   content, trends, webtrends   stories, the newsroom's trends, outside trends
 *   wire, wire.changed           a wire item filed, or removed
 *   inbox, subscribers, mail, newsletter, staff, engine, audit
 *   events                       reader activity, in small batches as it happens
 *   presence                     how many readers are on the site right now, and where
 */
import { useEffect, useSyncExternalStore } from 'react'

import { LiveMessage, createSocket, useSocketStatus, useTopics } from '@/lib/socket'

export const adminSocket = createSocket('/api/v1/admin/live')

export const useLive = (topics: string[], fn: (m: LiveMessage) => void, quietMs?: number) => useTopics(adminSocket, topics, fn, quietMs)
export const useLiveStatus = () => useSocketStatus(adminSocket)

export type Presence = { total: number; countries: Record<string, number> }

// The count is sent when the dashboard connects and then only when it changes, so it is kept
// here for pages opened later.
let presence: Presence | null = null
const watchers = new Set<() => void>()

/** Mounted once, by the dashboard shell: remembers the latest count for every page. */
export function usePresenceKeeper() {
  useEffect(
    () =>
      adminSocket.subscribe((m) => {
        if (m.t !== 'presence') return
        presence = m.d
        watchers.forEach((w) => w())
      }),
    []
  )
}

/** Readers on the site at this moment. Null until the first count arrives. */
export function usePresence(): Presence | null {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => void watchers.delete(fn)
    },
    () => presence,
    () => null
  )
}
