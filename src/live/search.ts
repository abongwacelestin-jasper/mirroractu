import { useEffect, useState } from 'react'

import { api, apiOnline } from '@/lib/api'
import { detectCountry } from '@/lib/edition'

export type LiveStory = { id: string; slug: string; h: string; st: string; cat: string | null; d: string }
export type LiveWire = { id: number; at: string; desk: string; cat: string; text: string; storyId?: string; kind: string }
export type LiveWeb = { title: string; url: string; note: string; source: 'google' | 'gdelt' | 'wikimedia'; credit: { name: string; url: string }; places: string[]; headline?: { title: string; url: string; publisher: string } }
export type LiveResults = { stories: LiveStory[]; wire: LiveWire[]; web: LiveWeb[] }

const edition = () => {
  try {
    const code = localStorage.getItem('ma-country') || localStorage.getItem('ma-country-geo') || detectCountry()
    return /^[A-Z]{2}$/.test(code) ? code : undefined
  } catch {
    return undefined
  }
}

/**
 * Search what is live on the server: stories as they stand this second, the wire of the last
 * two weeks, and the outside trend lists (POST /api/v1/search). It runs a moment after the
 * reader stops typing. `null` while waiting or when the API is offline; the search built into
 * the page still answers in that case.
 */
export function useLiveSearch(query: string): { results: LiveResults | null; loading: boolean } {
  const [state, setState] = useState<{ q: string; results: LiveResults | null }>({ q: '', results: null })
  const [loading, setLoading] = useState(false)
  const q = query.trim()
  useEffect(() => {
    if (!apiOnline || q.length < 2) {
      setState({ q, results: null })
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    const t = window.setTimeout(() => {
      api<LiveResults>('/search', { body: { q, country: edition() } })
        .then((results) => alive && setState({ q, results }))
        .catch(() => alive && setState({ q, results: null }))
        .finally(() => alive && setLoading(false))
    }, 320)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [q])
  return { results: state.q === q ? state.results : null, loading }
}
