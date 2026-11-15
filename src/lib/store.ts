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
