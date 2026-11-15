import React, { useState } from 'react'
import { CalendarDays, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { LiveBadge } from '@/components/live/LiveFeed'
import { Freshness } from '@/components/live/LiveHub'
import { StoryImage } from '@/components/story/StoryImage'
import { Hl, MonoDate, TextLink } from '@/components/ui'
import { CountUp } from '@/components/ui/CountUp'
import { AGENDA, EPL_TABLE, NBA_RESULTS, Story, getStory, storyPath } from '@/data'
import { useWire } from '@/live/feed'

/** The date this edition was compiled, for "in 2 days" on fixtures. */
const TODAY = new Date('2026-11-15T00:00:00Z')
const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00Z`).getTime() - TODAY.getTime()) / 86400000)
const when = (iso: string) => {
  const d = daysUntil(iso)
  return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`
}

type Competition = { id: string; name: string; storyId: string; note: string }
const COMPETITIONS: Competition[] = [
  { id: 'epl', name: 'Premier League', storyId: 's-epl', note: 'After ten matches' },
  { id: 'nba', name: 'NBA', storyId: 's-nba', note: 'Friday 13 November, US time' },
  { id: 'afcon', name: 'AFCON 2027 qualifiers', storyId: 's-afcon', note: '48 matches, 12 to 17 November' },
  { id: 'caf', name: 'CAF Women’s Champions League', storyId: 's-cafw', note: 'Final in Suez, 15 November' },
]

/**
 * The sport desk's scoreboard: results, the table, what is next and the sport wire, in one
 * band under the page title. Figures come from the same snapshot as the stories, and each
 * block says how fresh it is.
 */
export function SportHub() {
  const [tab, setTab] = useState<'table' | 'results'>('table')
  const fixtures = AGENDA.filter((a) => a[3].includes('sport'))
  const { items: wire, status } = useWire({ cat: 'sport', max: 4 })
  const leader = EPL_TABLE[0]

  return (
    <section aria-label="Scoreboard" className="-mx-[18px] border-b border-rule bg-paper px-[18px] py-8 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 lg:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[28px] font-extrabold tracking-[-0.035em]"><Trophy className="size-6 text-signal" /> Scoreboard</h2>
        <Freshness>Snapshot from 15 November</Freshness>
      </div>

      {/* Competitions being followed */}
      <ul className="no-scrollbar -mx-[18px] mb-6 flex gap-3 overflow-x-auto px-[18px] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {COMPETITIONS.map((c) => {
          const s = getStory(c.storyId)
          if (!s) return null
          return (
            <li key={c.id} data-reveal className="w-[250px] flex-none sm:w-auto">
              <Link to={storyPath(s.id)} className="group grid h-full grid-cols-[84px_minmax(0,1fr)] items-center gap-3 bg-white p-2.5 transition-shadow duration-200 hover:shadow-[0_14px_28px_-18px_rgba(14,20,36,.5)]">
                <StoryImage story={s} caption={false} ratio="aspect-square" />
                <span className="min-w-0">
                  <span className="block text-[15.5px] font-semibold leading-tight"><Hl>{c.name}</Hl></span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">{c.note}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Table and results */}
        <div data-reveal className="bg-white p-5 lg:col-span-5">
          <div role="tablist" aria-label="Scoreboard view" className="mb-4 grid grid-cols-2 border-b border-rule">
            {([['table', 'Premier League table'], ['results', 'NBA results']] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className="-mb-px border-b-[3px] border-transparent pb-2.5 text-left text-[15px] font-semibold text-muted transition-colors duration-150 hover:text-ink aria-selected:border-signal aria-selected:text-ink"
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'table' ? (
            <table className="w-full border-collapse text-[14.5px] tabular-nums">
              <thead>
                <tr className="text-[12px] font-medium text-muted">
                  <th className="w-6 pb-1.5 text-left font-medium"><span className="sr-only">Position</span></th>
                  <th className="pb-1.5 text-left font-medium">Club</th>
                  <th className="pb-1.5 text-right font-medium" title="Played">P</th>
                  <th className="pb-1.5 text-right font-medium" title="Won">W</th>
                  <th className="pb-1.5 text-right font-medium" title="Drawn">D</th>
                  <th className="pb-1.5 text-right font-medium" title="Lost">L</th>
                  <th className="hidden w-[26%] pb-1.5 sm:table-cell"><span className="sr-only">Points bar</span></th>
                  <th className="pb-1.5 text-right font-medium">Pts</th>
                  <th className="pb-1.5 text-right font-medium" title="Points behind the leader">Gap</th>
                </tr>
              </thead>
              <tbody>
                {EPL_TABLE.map(([club, w, d, l, pts], i) => (
                  <tr key={club} className={twMerge('border-t border-rule', i === 0 && 'font-semibold')}>
                    <td className="py-2 text-muted">{i + 1}</td>
                    <td className="py-2">{club}</td>
                    <td className="py-2 text-right text-muted">{w + d + l}</td>
                    <td className="py-2 text-right">{w}</td>
                    <td className="py-2 text-right">{d}</td>
                    <td className="py-2 text-right">{l}</td>
                    <td className="hidden px-2 py-2 sm:table-cell"><i className={twMerge('block h-2', i === 0 ? 'bg-signal' : 'bg-ink')} style={{ width: `${(pts / leader[4]) * 100}%` }} /></td>
                    <td className="py-2 text-right font-bold"><CountUp value={pts} /></td>
                    <td className="py-2 text-right text-muted">{i === 0 ? '—' : `−${leader[4] - pts}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul>
              {NBA_RESULTS.map(([home, hs, as, away]) => {
                const homeWon = hs > as
                return (
                  <li key={home} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-t border-rule py-2.5 text-[15px] first:border-t-0">
                    <span className={twMerge('truncate', homeWon && 'font-semibold')}>{home}</span>
                    <span className="flex items-baseline gap-1.5 tabular-nums">
                      <b className={twMerge('text-[20px]', homeWon ? 'font-extrabold' : 'font-normal text-muted')}><CountUp value={hs} /></b>
                      <span className="text-muted">–</span>
                      <b className={twMerge('text-[20px]', !homeWon ? 'font-extrabold' : 'font-normal text-muted')}><CountUp value={as} /></b>
                    </span>
                    <span className={twMerge('truncate text-right', !homeWon && 'font-semibold')}>{away}</span>
                    <span className="col-span-3 -mt-1 text-center text-[12px] text-muted">{homeWon ? home : away} by {Math.abs(hs - as)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-3 text-[12.5px] text-muted">Provider: sports data feed. {tab === 'table' ? 'Top six shown.' : 'Final scores.'} <TextLink to="/live" className="text-ink">All live data</TextLink></p>
        </div>

        {/* What is next */}
        <div data-reveal className="bg-white p-5 lg:col-span-3">
          <h3 className="mb-3 flex items-center gap-2 border-b border-rule pb-2.5 text-[15px] tracking-normal"><CalendarDays className="size-4" /> Next up</h3>
          <ul>
            {fixtures.map(([iso, label, title, , id]) => (
              <li key={title} className="border-b border-rule last:border-b-0">
                <Link to={storyPath(id)} className="group block py-2.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <MonoDate className="font-medium text-ink">{label}</MonoDate>
                    <span className={twMerge('text-[12px] font-semibold', daysUntil(iso) <= 0 ? 'text-signal' : 'text-muted')}>{when(iso)}</span>
                  </span>
                  <span className="mt-0.5 block text-[14.5px] leading-snug"><Hl>{title}</Hl></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Sport wire */}
        <div data-reveal className="bg-ink p-5 text-white lg:col-span-4">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-rule-dark pb-2.5">
            <h3 className="text-[15px] tracking-normal">Sport wire</h3>
            <LiveBadge dark note={false} />
          </div>
          {status === 'connecting' ? (
            <p className="py-3 text-[14.5px] text-mirror">Connecting to the wire…</p>
          ) : (
            <ol>
              {wire.map((w) => (
                <li key={w.id} className="border-b border-rule-dark last:border-b-0">
                  <Link to={w.storyId ? storyPath(w.storyId) : '/live'} className="group grid grid-cols-[44px_minmax(0,1fr)] gap-2.5 py-2.5">
                    <span className="pt-0.5 font-mono text-xs tabular-nums text-mirror">{w.time}</span>
                    <span className="text-[14.5px] leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline">{w.text}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
