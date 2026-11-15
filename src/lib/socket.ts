/**
 * One WebSocket to the API, shared by everything on the page that wants real-time updates.
 * It reconnects by itself (1 second, then 2, 4… up to 30), and when it comes back it tells
 * every listener to catch up, since anything sent while it was down was missed.
 *
 *   createSocket('/api/v1/live')         the public site
 *   createSocket('/api/v1/admin/live')   the dashboard
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'

export type LiveMessage = { t: string; d?: any }
export type SocketStatus = 'connecting' | 'live' | 'offline'

export function createSocket(path: string, hello?: () => unknown) {
  let ws: WebSocket | null = null
  let status: SocketStatus = 'connecting'
  let wait = 1000
  let timer = 0
  let everOpened = false
  let wanted = 0
  const listeners = new Set<(m: LiveMessage) => void>()
  const watchers = new Set<() => void>()
  const setStatus = (s: SocketStatus) => {
    if (s === status) return
    status = s
    watchers.forEach((w) => w())
  }
  const emit = (m: LiveMessage) => listeners.forEach((l) => l(m))

  function open() {
    if (ws || typeof WebSocket === 'undefined') return
    setStatus(everOpened ? 'connecting' : status)
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`)
    ws = socket
    socket.onopen = () => {
      wait = 1000
      setStatus('live')
      const first = hello?.()
      if (first) socket.send(JSON.stringify(first))
      // After a gap, everything may have changed: ask every listener to load again.
      if (everOpened) emit({ t: 'resync' })
      everOpened = true
    }
    socket.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data)) as LiveMessage
        if (typeof m?.t === 'string') emit(m)
      } catch {
        /* not ours */
      }
    }
    socket.onclose = () => {
      if (ws === socket) ws = null
      setStatus('offline')
      if (wanted > 0) {
        timer = window.setTimeout(open, wait)
        wait = Math.min(30000, wait * 2)
      }
    }
    socket.onerror = () => socket.close()
  }
  function close() {
    window.clearTimeout(timer)
    ws?.close()
    ws = null
  }
  // A phone that wakes up, or a laptop that comes back online, reconnects at once.
  if (typeof window !== 'undefined') {
    const wake = () => {
      if (wanted > 0 && !ws && document.visibilityState === 'visible') {
        window.clearTimeout(timer)
        wait = 1000
        open()
      }
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
  }

  return {
    /** Listen while mounted. The connection opens with the first listener and closes with the last. */
    subscribe(fn: (m: LiveMessage) => void) {
      listeners.add(fn)
      if (++wanted === 1) open()
      return () => {
        listeners.delete(fn)
        if (--wanted === 0) close()
      }
    },
    send(message: unknown) {
      if (ws?.readyState === 1) ws.send(JSON.stringify(message))
    },
    status: () => status,
    /** True if a connection has been made at least once on this page. */
    opened: () => everOpened,
    watch(fn: () => void) {
      watchers.add(fn)
      return () => void watchers.delete(fn)
    },
  }
}
export type Socket = ReturnType<typeof createSocket>

/**
 * Run `fn` when one of `topics` arrives (or the connection comes back). Bursts are folded
 * together: `fn` runs at most once per `quietMs`.
 */
export function useTopics(socket: Socket, topics: string[], fn: (m: LiveMessage) => void, quietMs = 400) {
  const latest = useRef(fn)
  latest.current = fn
  const key = topics.join('|')
  useEffect(() => {
    let timer = 0
    let last: LiveMessage | null = null
    const off = socket.subscribe((m) => {
      if (m.t !== 'resync' && !topics.includes(m.t)) return
      last = m
      if (!quietMs) return latest.current(m)
      if (timer) return
      timer = window.setTimeout(() => {
        timer = 0
        if (last) latest.current(last)
      }, quietMs)
    })
    return () => {
      off()
      window.clearTimeout(timer)
    }
  }, [key, quietMs])
}

export const useSocketStatus = (socket: Socket) => useSyncExternalStore(socket.watch, socket.status, () => 'connecting' as SocketStatus)
