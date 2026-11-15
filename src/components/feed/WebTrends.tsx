import React from 'react'
import { ArrowUpRight, Globe2, Newspaper, Search } from 'lucide-react'

import { Container } from '@/components/ui'
import { WebLevel, WebList, ago, useWebTrends } from '@/live/webTrends'

const ICON = { google: Search, gdelt: Newspaper, wikimedia: Globe2 } as const

/**
 * "Trending on the web": what people are searching for, what the most outlets are reporting and
 * what is being read on Wikipedia, for the level the reader has picked on the Trends page.
 * These lists come from outside sources and are not MirrorActu reporting, and the section says
 * so: every list names its source, every link leaves the site, and nothing here is verified.
 */
export function WebTrends({ level }: { level: 'country' | 'region' | 'global' }) {
  const levels = useWebTrends()
  const current: WebLevel | undefined = levels.find((l) => l.level === level) ?? levels.at(-1)
  if (!current || current.lists.length === 0) return null
  const where = current.level === 'global' ? 'around the world' : current.level === 'region' ? `across ${current.name}` : `in ${current.name}`

  return (
    <section aria-labelledby="web-trends" className="border-y border-rule bg-paper">
      <Container className="py-10 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">From outside sources</p>
            <h2 id="web-trends" className="mt-1 text-[30px] font-extrabold tracking-[-0.035em]">Trending on the web {where}</h2>
          </div>
          <p className="max-w-[46ch] border-l-2 border-signal pl-4 text-[13.5px] text-muted">
            <b className="text-ink">Not MirrorActu reporting.</b> These lists are produced by the sources named on each. We have not checked them, and every link opens another site.
          </p>
        </div>
        <div className={`mt-7 grid gap-x-8 gap-y-9 ${current.lists.length >= 3 ? 'lg:grid-cols-3' : current.lists.length === 2 ? 'lg:grid-cols-2' : ''}`}>
          {current.lists.map((list) => <List key={list.source} list={list} />)}
        </div>
      </Container>
    </section>
  )
}

function List({ list }: { list: WebList }) {
  const Icon = ICON[list.source]
  return (
    <div data-reveal className="min-w-0">
      <div className="flex items-center gap-2.5 border-t-2 border-ink pt-3">
        <span className="flex size-8 flex-none items-center justify-center rounded-full bg-ink text-white"><Icon className="size-4" /></span>
        <div className="min-w-0 leading-tight">
          <h3 className="text-[18px]">{list.label}</h3>
          <p className="truncate text-[12.5px] text-muted">{list.about}</p>
        </div>
      </div>
      <ol className="mt-3">
        {list.items.slice(0, 8).map((item, i) => (
          <li key={item.url + i} className="grid grid-cols-[26px_minmax(0,1fr)] gap-x-2 border-b border-rule py-2.5">
            <span className="font-mono text-[12.5px] leading-6 text-signal tabular-nums" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" data-track={`webtrend:${list.source}`} className="group inline text-[15.5px] font-semibold leading-snug decoration-signal decoration-2 underline-offset-4 hover:underline" translate="no">
                {item.title}
                <ArrowUpRight className="ml-0.5 inline size-3.5 -translate-y-px text-muted transition-colors group-hover:text-ink" aria-label="(opens another site)" />
              </a>
              <p className="text-[12.5px] text-muted tabular-nums">{item.note}</p>
              {item.headline && (
                <p className="mt-0.5 truncate text-[12.5px] text-muted">
                  <a href={item.headline.url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-signal" translate="no">{item.headline.title}</a>
                  {item.headline.publisher && <span translate="no"> · {item.headline.publisher}</span>}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2.5 text-[12px] text-muted">
        Source: <a href={list.credit.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-[3px]" translate="no">{list.credit.name}</a>
        {list.fetchedAt && <> · updated {ago(list.fetchedAt)}</>}
      </p>
    </div>
  )
}
