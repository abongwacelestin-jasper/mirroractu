/** Reader preferences kept in localStorage: saved stories, followed sections, text size. */
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const memory: Record<string, string> = {}

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? memory[key] ?? fallback
  } catch {
    return memory[key] ?? fallback
  }
}

function write(key: string, value: string) {
  memory[key] = value
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage blocked: keep it for this session */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function useStored(key: string, fallback: string) {
  return useSyncExternalStore(subscribe, () => read(key, fallback), () => fallback)
}

function useToggleList(key: string): [string[], (id: string) => void] {
  const list: string[] = JSON.parse(useStored(key, '[]'))
  const toggle = (id: string) =>
    write(key, JSON.stringify(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  return [list, toggle]
}

export const useSavedStories = () => useToggleList('ma-saved')
export const useFollowedSections = () => useToggleList('ma-follow')

/** A single stored string, e.g. cookie consent or a dismissed popup. */
export function useStoredValue(key: string, fallback: string): [string, (v: string) => void] {
  return [useStored(key, fallback), (v) => write(key, v)]
}

export type TextSize = 'm' | 'l'
export function useTextSize(): [TextSize, (s: TextSize) => void] {
  const size = useStored('ma-size', 'm') as TextSize
  return [size, (s) => write('ma-size', s)]
}

/** Stories the reader has opened, oldest first. Drives "read" marks and the For you ranking. */
export function useReadStories(): [string[], (id: string) => void] {
  const list: string[] = JSON.parse(useStored('ma-read', '[]'))
  const markRead = (id: string) => {
    if (!list.includes(id)) write('ma-read', JSON.stringify([...list, id].slice(-200)))
  }
  return [list, markRead]
}

/** Stories the reader liked. Kept in this browser; there is no public count. */
export const useLikedStories = () => useToggleList('ma-liked')
/** Stories the reader asked not to see in their feed. */
export const useHiddenStories = () => useToggleList('ma-hidden')

/* ---------- The reader's data on this device ---------- */

/** Every value this site keeps in the browser, keyed by its storage name. */
export function storedData(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('ma-')) out[k] = localStorage.getItem(k) ?? ''
    }
  } catch {
    Object.assign(out, memory)
  }
  return out
}

/** Remove everything this site stored, including Google Translate's language cookie. */
export function eraseStoredData() {
  for (const k of Object.keys(storedData())) {
    delete memory[k]
    try {
      localStorage.removeItem(k)
    } catch {
      /* storage blocked */
    }
  }
  document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  listeners.forEach((l) => l())
}
