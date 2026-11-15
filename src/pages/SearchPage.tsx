import React from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdSlot } from '@/components/ads/AdSlot'
import { SearchPanel } from '@/components/search/SearchPanel'
import { Container } from '@/components/ui'
import { SearchFilters, parseSearch, searchPath } from '@/lib/search'

/**
 * Full search results at a shareable address: /search?q=cop31&desk=climate&type=videos.
 * The address is the state, so a search can be bookmarked, shared or reloaded.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const { query, filters } = parseSearch(params)
  const update = (q: string, f: SearchFilters) => setParams(new URLSearchParams(searchPath(q, f).split('?')[1] ?? ''), { replace: true })

  return (
    <Container className="max-w-[1100px] pb-[72px] pt-8">
      <h1 className="sr-only">Search</h1>
      <SearchPanel query={query} onQuery={(q) => update(q, filters)} filters={filters} onFilters={(f) => update(query, f)} />
      <AdSlot format="leaderboard" slot={0} placement="the foot of the search results page" className="mt-12" />
    </Container>
  )
}
