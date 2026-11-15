import React from 'react'
import { twMerge } from 'tailwind-merge'

import { EPL_TABLE } from '@/data'
import { NbaScores } from '@/components/story/Viz'

/** Freshness label. `stale` data stays visible with its age; `off` has no provider yet. */
export function Freshness({ state = 'fresh', children }: { state?: 'fresh' | 'stale' | 'off'; children: React.ReactNode }) {
  return (
    <span className={twMerge('flex items-center gap-2 text-[13px] text-muted', state === 'stale' && 'font-semibold text-ink')}>
      <span
        aria-hidden="true"
        className={twMerge(
          'size-2 flex-none rounded-full bg-ink',
          state === 'stale' && 'rotate-45 rounded-none bg-dew ring-1 ring-ink',
          state === 'off' && 'bg-transparent ring-[1.5px] ring-inset ring-ink'
        )}
      />
      {children}
    </span>
  )
}

export function Commodities({ compact = false }: { compact?: boolean }) {
  const rows: [string, string, string][] = [
    [compact ? 'Brent' : 'Brent crude', '$97.83', compact ? '−17%' : '−17% wk'],
    [compact ? 'WTI' : 'WTI crude', '$90.20', compact ? '−13%' : '−13% wk'],
    [compact ? 'Gold' : 'Gold, per oz', '$4,074', compact ? '+4.5%' : '+4.5% wk'],
  ]
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-[18px] gap-y-2.5 tabular-nums">
      {rows.map(([label, value, change]) => (
        <React.Fragment key={label}>
          <span>{label}</span>
          <b className="text-right text-[22px] font-semibold tracking-[-0.02em]">{value}</b>
          <span className="text-right text-sm text-muted">{change}</span>
        </React.Fragment>
      ))}
    </div>
  )
}

export function LeagueTable({ rows = EPL_TABLE, full = true }: { rows?: typeof EPL_TABLE; full?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px] tabular-nums">
        {full && (
          <thead>
            <tr className="text-[12.5px] font-medium text-muted">
              <th className="w-[26px] pb-2 text-left font-medium"><span className="sr-only">Position</span></th>
              <th className="px-1.5 pb-2 text-left font-medium">Club</th>
              <th className="px-1.5 pb-2 text-right font-medium">W</th>
              <th className="px-1.5 pb-2 text-right font-medium">D</th>
              <th className="px-1.5 pb-2 text-right font-medium">L</th>
              <th className="pb-2"><span className="sr-only">Points bar</span></th>
              <th className="px-1.5 pb-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map(([club, w, d, l, pts], i) => (
            <tr key={club} className="border-t border-rule">
              <td className="w-[26px] py-[9px] text-muted">{i + 1}</td>
              <td className="px-1.5 py-[9px]">{club}</td>
              {full && (
                <>
                  <td className="px-1.5 py-[9px] text-right">{w}</td>
                  <td className="px-1.5 py-[9px] text-right">{d}</td>
                  <td className="px-1.5 py-[9px] text-right">{l}</td>
                  <td className="w-[34%] px-1.5 py-[9px]"><i className="block h-2 bg-ink" style={{ width: `${(pts / 27) * 100}%` }} /></td>
                </>
              )}
              <td className="px-1.5 py-[9px] text-right font-semibold">{pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Tile({ title, children, className, surface }: { title: string; children: React.ReactNode; className?: string; surface: 'white' | 'paper' }) {
  return (
    <section className={twMerge('flex h-full flex-col gap-4 px-7 py-[26px]', surface === 'white' ? 'bg-white' : 'bg-paper', className)}>
      <h3 className="text-[21px]">{title}</h3>
      {children}
    </section>
  )
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="mt-auto text-sm text-muted">{children}</p>

/** The live data modules. Each names its provider and its age. */
export function LiveHub({ surface = 'white' }: { surface?: 'white' | 'paper' }) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-y-10">
      <Tile surface={surface} title="Premier League" className="lg:col-span-5">
        <Freshness>Snapshot from 15 November, after ten matches</Freshness>
        <LeagueTable />
        <Note>Provider: sports data feed</Note>
      </Tile>
      <Tile surface={surface} title="Commodities" className="lg:col-span-4">
        <Freshness state="stale">Stale: last updated 6 November</Freshness>
        <Commodities />
        <Note>Any module that misses its freshness window is flagged like this, never shown as current. Source: Fair Value briefing.</Note>
      </Tile>
      <Tile surface={surface} title="Global temperature" className="lg:col-span-3">
        <Freshness>Monthly, published 5 November</Freshness>
        <div>
          <div className="text-[60px] font-extrabold leading-[0.95] tracking-[-0.045em]">+1.75°C</div>
          <p className="mt-3 text-[15px] text-muted">October 2026 against the pre-industrial estimate. The warmest October on record.</p>
        </div>
        <Note>Provider: Copernicus, via RMetS</Note>
      </Tile>
      <Tile surface={surface} title="NBA results" className="lg:col-span-7">
        <Freshness>Final scores from Friday 13 November, US time</Freshness>
        <NbaScores />
        <Note>Provider: sports data feed</Note>
      </Tile>
      <Tile surface={surface} title="Exchange rates" className="lg:col-span-5">
        <Freshness state="off">No provider connected</Freshness>
        <p className="text-muted">
          USD/RWF, EUR/RWF and EUR/USD will appear here once a licensed rates provider is approved. The public rate pages we checked
          disagreed with each other, so no figure is shown.
        </p>
        <Note>Waiting on provider sign-off</Note>
      </Tile>
    </div>
  )
}
