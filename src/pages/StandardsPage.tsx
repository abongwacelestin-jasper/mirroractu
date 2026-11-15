import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AD_FORMATS, AdSlot, AdTag } from '@/components/ads/AdSlot'
import { Freshness } from '@/components/live/LiveHub'
import { Button, ButtonLink, Container, Hl, PageHeader, TextLink } from '@/components/ui'
import { useSiteActions } from '@/lib/actions'
import { STORIES, Story, Tier, newestFirst, storyPath } from '@/data'

/* ---------- Content ---------- */

const NAV: [string, string][] = [
  ['about', 'At a glance'],
  ['pipeline', 'From report to published'],
  ['tiers', 'Who decides'],
  ['sources', 'Sources'],
  ['ai', 'How we use AI'],
  ['corrections', 'Corrections'],
  ['advertising', 'Advertising'],
  ['live-data', 'Live data'],
  ['faq', 'Questions'],
  ['status', 'Status and contact'],
]

const PRINCIPLES: [string, string][] = [
  ['Confirmed and still open, side by side', 'Every story separates what is established from what is not yet known.'],
  ['Up to three sources, each with a role', 'You can open them. We never add a link only to reach three.'],
  ['Editors decide sensitive stories', 'Elections, conflict, health, legal and money claims need a named editor.'],
  ['AI drafts, people decide', 'AI sorts and drafts from approved material. It cannot invent or sign off.'],
  ['Corrections stay visible', 'A dated note marks every change. Earlier versions are kept.'],
  ['Adverts are labelled', 'Every advert is tagged and framed apart from reporting. Coverage is not for sale.'],
]

type Actor = 'System' | 'AI' | 'Editor'
const PIPELINE: [string, Actor, string][] = [
  ['Intake', 'System', 'Items arrive from licensed providers and public records. Material we lack rights to stops here.'],
  ['Sort and group', 'AI', 'Incoming items are sorted by desk and grouped so one event becomes one story.'],
  ['Draft', 'AI', 'A draft is prepared from approved material only. No invented facts, quotes or links.'],
  ['Checks', 'System', 'Source, freshness and rights checks run on every draft. Failures are blocked with a recorded reason.'],
  ['Sign-off', 'Editor', 'The risk tier decides: automatic, approved by an editor, or signed by a named editor.'],
  ['Publish and record', 'System', 'The story goes out with its sources, its open questions and a version number.'],
]

type TierId = Tier | 'blocked'
const TIER_INFO: Record<TierId, { name: string; covers: string; rule: string; who: string }> = {
  low: { name: 'Low', covers: 'Scores, listings, scheduled releases', rule: 'May publish automatically after source, freshness and rights checks.', who: 'System' },
  medium: { name: 'Medium', covers: 'Business, tech, sport and culture news', rule: 'Drafted, then approved by an editor.', who: 'An editor' },
  high: { name: 'High', covers: 'Elections, conflict, health, legal and financial claims', rule: 'A named editor signs off against primary sources.', who: 'A named editor' },
  blocked: { name: 'Blocked', covers: 'Rumour, manipulated media, material we lack rights to', rule: 'Not published. The reason is recorded.', who: 'Nobody' },
}

const AI_MAY = ['Sort incoming items by desk and topic', 'Group items about one event into one story', 'Prepare drafts from approved material']
const AI_MAY_NOT = ['Invent facts, quotes or links', 'Decide sensitive stories', 'Publish medium or high-risk stories without an editor']

const CORRECTION_STEPS: [string, string][] = [
  ['Report', 'Anyone can report a mistake from any story, or from this page.'],
  ['Check', 'An editor checks the report against the story’s sources.'],
  ['Correct', 'The story is corrected in the open, with a dated note saying what changed.'],
  ['Keep', 'The earlier version stays on record. Nothing is quietly rewritten.'],
]

const AD_RULES = [
  'Every advert carries a solid “Advertisement” tag and names who paid for it.',
  'Paid items inside story lists are tagged “Sponsored” and framed differently from stories.',
  'Sponsors cannot buy coverage, see stories before they publish or change what is reported.',
  'Adverts never appear inside the Confirmed and Still open lists, in search results or in the live wire.',
  'This page and the legal page carry no advertising. The example below is a specimen.',
]

type FreshState = 'fresh' | 'stale' | 'off'
const FRESH_LEGEND: [FreshState, string, string][] = [
  ['fresh', 'Within its window', 'The provider delivered on time. The label gives the date of the data.'],
  ['stale', 'Stale', 'The provider missed its window. The figure stays visible with its age, never shown as current.'],
  ['off', 'No provider', 'No licensed provider is connected, so no figure is shown at all.'],
]
const MODULES: [string, string, FreshState, string][] = [
  ['Premier League table', 'Sports data feed', 'fresh', 'Snapshot from 15 November'],
  ['NBA results', 'Sports data feed', 'fresh', 'Final scores from 13 November'],
  ['Global temperature', 'Copernicus, via RMetS', 'fresh', 'Monthly, published 5 November'],
  ['Commodities', 'Fair Value briefing', 'stale', 'Last updated 6 November'],
  ['Exchange rates', 'None yet', 'off', 'Waiting on provider sign-off'],
  ['The wire', 'Simulated in this preview', 'off', 'Desk feeds connect at launch'],
]

const FAQ: [string, string][] = [
  ['Why do stories have a “Still open” list?', 'Because most news is unfinished when it is first reported. Listing what is not yet known stops a story implying more than its sources support.'],
  ['How many sources does a story need?', 'Up to three. Each is labelled with the part it plays, such as primary record or independent corroboration. We never add a link only to reach three.'],
  ['Does AI write MirrorActu stories?', 'AI sorts incoming items, groups them and prepares drafts from approved material. It may not invent facts, quotes or links, and people decide what is published on anything sensitive.'],
  ['Can advertisers influence coverage?', 'No. Adverts and sponsored items are labelled and kept apart from reporting, and sponsors cannot buy favourable coverage.'],
  ['How do I report a mistake?', 'Use “Report a correction” on any story or on this page. Errors are corrected in the open with a dated note, and earlier versions are kept.'],
  ['Will stories stay online?', 'MirrorActu keeps its own reporting as a lasting archive with stable links. Licensed material is kept only as long as the provider’s terms allow.'],
  ['Why do some figures carry a stale warning?', 'Each data module has a freshness window. When a provider misses it, the figure stays visible with its age so nobody mistakes it for current.'],
  ['Where are my saved stories kept?', 'In your browser only. Saved stories, followed sections and text size are not sent to a server.'],
  ['Is this the finished site?', 'No. This is a preview edition. Privacy notice, terms and contact routes still need legal review, and the feeds are not connected.'],
]

const NOT_CONNECTED: [string, string][] = [
  ['Morning email', 'Sign-up opens at launch. Nothing you type is sent or stored.'],
  ['Corrections desk', 'The form validates but does not send yet.'],
  ['Live feeds', 'The wire and market quotes run on a simulated provider.'],
  ['Exchange rates', 'No licensed provider approved yet.'],
  ['Ad server', 'Adverts shown are placeholder creatives.'],
  ['Legal pages', 'Privacy, terms and contact are pending legal review.'],
]

/* ---------- Figures drawn from the stories on the site ---------- */

function useFigures() {
  const all = STORIES
  const count = (fn: (s: Story) => number) => all.reduce((n, s) => n + fn(s), 0)
  const citations = count((s) => s.src.length)
  const roles = new Map<string, number>()
  all.forEach((s) => s.src.forEach(([role]) => roles.set(role, (roles.get(role) ?? 0) + 1)))
  const byTier = (t: Tier) => newestFirst(all.filter((s) => s.tier === t))
  return {
    stories: all.length,
    confirmed: count((s) => s.ok.length),
    open: count((s) => s.un.length),
    citations,
    linked: count((s) => s.src.filter((x) => x[2]).length),
    perStory: (citations / all.length).toFixed(1),
    multi: all.filter((s) => s.src.length > 1).length,
    roles: [...roles.entries()].sort((a, b) => b[1] - a[1]),
    tiers: { low: byTier('low'), medium: byTier('medium'), high: byTier('high') },
  }
}

/* ---------- Page ---------- */

export function StandardsPage() {
  const { hash } = useLocation()
  const { openCorrection } = useSiteActions()
  const f = useFigures()
  const active = useActiveSection(NAV.map(([id]) => id))

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  return (
    <>
      <PageHeader
        title="How we work"
        intro="How MirrorActu decides what to publish, credits its sources and corrects its mistakes."
        aside={
          <dl className="grid grid-cols-2 gap-x-9 gap-y-4 lg:text-right">
            {[
              ['Stories on the site', f.stories],
              ['Facts confirmed', f.confirmed],
              ['Questions still open', f.open],
              ['Sources cited', f.citations],
            ].map(([t, v]) => (
              <div key={t}>
                <dt className="text-[13px] text-mirror">{t}</dt>
                <dd className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        }
      />

      {/* Section nav: a scrolling strip on phones, a sticky column from 1024px. */}
      <nav aria-label="On this page" className="no-scrollbar sticky top-[100px] z-[5] flex gap-2 overflow-x-auto border-b border-rule bg-white px-[18px] py-3 sm:px-6 lg:hidden">
        {NAV.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={active === id ? 'true' : undefined}
            className="whitespace-nowrap rounded-full border border-rule px-3.5 py-1.5 text-sm aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-white"
          >
            {label}
          </a>
        ))}
      </nav>

      <Container className="grid grid-cols-[minmax(0,1fr)] gap-x-12 pb-[88px] lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-[92px] pt-12">
            {NAV.map(([id, label], i) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'true' : undefined}
                  className="group grid grid-cols-[26px_1fr] items-baseline border-l-2 border-rule py-[7px] pl-3.5 text-[14.5px] text-muted transition-colors duration-150 hover:text-ink aria-[current]:border-signal aria-[current]:font-semibold aria-[current]:text-ink"
                >
                  <span className="font-mono text-[11px] tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          <Block n={1} id="about" title="At a glance" lede="MirrorActu is a news and live-information service from TheGoodMorningDewPub. It shows what is happening, explains why it matters and keeps a lasting record.">
            <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
              {PRINCIPLES.map(([t, d]) => (
                <li key={t} className="border-t border-ink py-3.5">
                  <b className="block text-[16.5px] font-semibold leading-snug">{t}</b>
                  <span className="mt-1 block text-[14.5px] text-muted">{d}</span>
                </li>
              ))}
            </ul>
          </Block>

          <Block n={2} id="pipeline" title="From report to published" lede="Six steps, the same for every story. The tag shows who does each one.">
            <ol className="grid gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
              {PIPELINE.map(([name, actor, text], i) => (
                <li key={name} className="relative border-t-2 border-ink pt-3">
                  <span aria-hidden="true" className="absolute -top-[7px] left-0 size-3 rounded-full bg-signal" />
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[17px] font-semibold">
                      <span className="mr-2 font-mono text-xs font-normal text-muted">{i + 1}</span>
                      {name}
                    </b>
                    <ActorTag actor={actor} />
                  </div>
                  <p className="mt-1.5 text-[14.5px] text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </Block>

          <Block n={3} id="tiers" title="Who decides what gets published" lede="Every story is given a risk tier. The tier sets who must approve it.">
            <div role="img" aria-label={`Stories by tier: ${f.tiers.high.length} high, ${f.tiers.medium.length} medium, ${f.tiers.low.length} low`} className="mb-1 flex h-3 gap-0.5 text-ink">
              {(['high', 'medium', 'low'] as Tier[]).map((t) => (
                <i key={t} style={{ flex: f.tiers[t].length }} className={twMerge('block', tierMark(t))} />
              ))}
            </div>
            <p className="mb-4 text-[13.5px] text-muted">Share of the {f.stories} stories on the site today, by tier.</p>
            <div className="border-b border-rule">
              {(['high', 'medium', 'low', 'blocked'] as TierId[]).map((t) => {
                const info = TIER_INFO[t]
                const list = t === 'blocked' ? [] : f.tiers[t]
                return (
                  <div key={t} className="grid gap-x-6 gap-y-1.5 border-t border-rule py-4 md:grid-cols-[130px_1fr_1fr_150px]">
                    <div className="flex items-center gap-2.5 self-start">
                      <i aria-hidden="true" className={twMerge('block size-3.5 flex-none text-ink', t === 'blocked' ? 'bg-signal' : tierMark(t))} />
                      <b className="text-[17px] font-semibold">{info.name}</b>
                    </div>
                    <p className="text-[15px]"><Label>Covers</Label>{info.covers}</p>
                    <p className="text-[15px]"><Label>Rule</Label>{info.rule}</p>
                    <div className="text-[14.5px] md:text-right">
                      <Label>Approved by</Label>
                      <b className="font-semibold">{info.who}</b>
                      <span className="block text-muted tabular-nums">{t === 'blocked' ? 'Never shown' : `${list.length} stories now`}</span>
                    </div>
                    {list[0] && (
                      <Link to={storyPath(list[0].id)} className="group text-[14px] text-muted md:col-span-3 md:col-start-2">
                        Example: <span className="text-ink"><Hl>{list[0].h}</Hl></span>
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </Block>

          <Block n={4} id="sources" title="Sources" lede="Stories draw on licensed providers and public records. Each lists up to three sources and the part each one plays.">
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
              <div>
                <dl className="grid grid-cols-3 gap-4 border-t border-ink pt-3.5">
                  <Stat value={f.citations} label="sources cited" />
                  <Stat value={f.perStory} label="per story, average" />
                  <Stat value={f.linked} label="you can open" />
                </dl>
                <ul className="mt-5 text-[15px]">
                  {[
                    'Up to three sources per story, never more for show.',
                    'Each source is labelled with its role.',
                    'We never add a link only to reach three.',
                    `${f.multi} of ${f.stories} stories rest on more than one source.`,
                    'Licensed material is kept only as long as the provider’s terms allow.',
                  ].map((x) => <Tick key={x}>{x}</Tick>)}
                </ul>
              </div>
              <div>
                <h3 className="border-t border-ink pt-3.5 text-[15px] tracking-normal">Roles sources play, across the site</h3>
                <ul className="mt-3 grid gap-2">
                  {f.roles.slice(0, 7).map(([role, n]) => (
                    <li key={role} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[14.5px]">
                      <span className="col-span-2 flex justify-between gap-3">
                        {role}
                        <span className="tabular-nums text-muted">{n}</span>
                      </span>
                      <i aria-hidden="true" className="col-span-2 block h-1.5 bg-ink" style={{ width: `${(n / f.roles[0][1]) * 100}%` }} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Block>

          <Block n={5} id="ai" title="How we use AI" lede="AI does the sorting and the first draft. It does not decide what is true or what is published.">
            <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
              <div>
                <h3 className="border-t-2 border-ink pt-3 text-[15px] tracking-normal">AI may</h3>
                <ul className="mt-1 text-[15.5px]">{AI_MAY.map((x) => <Tick key={x}>{x}</Tick>)}</ul>
              </div>
              <div>
                <h3 className="border-t-2 border-signal pt-3 text-[15px] tracking-normal">AI may not</h3>
                <ul className="mt-1 text-[15.5px]">{AI_MAY_NOT.map((x) => <Tick key={x} no>{x}</Tick>)}</ul>
              </div>
            </div>
          </Block>

          <Block n={6} id="corrections" title="Corrections" lede="Errors are corrected in the open with a dated note, and earlier versions are kept.">
            <ol className="grid gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
              {CORRECTION_STEPS.map(([name, text], i) => (
                <li key={name} className="border-t border-ink pt-3">
                  <b className="text-[17px] font-semibold">
                    <span className="mr-2 font-mono text-xs font-normal text-muted">{i + 1}</span>
                    {name}
                  </b>
                  <p className="mt-1 text-[14.5px] text-muted">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-paper px-5 py-4">
              <p className="text-[15px]">
                <b className="font-semibold">Corrections so far: none.</b>{' '}
                <span className="text-muted">All {f.stories} stories are at version 1 in this preview edition.</span>
              </p>
              <Button size="sm" onClick={() => openCorrection()}>Report a correction</Button>
            </div>
          </Block>

          <Block n={7} id="advertising" title="Advertising" lede="Adverts and sponsored items are labelled and kept apart from reporting. Sponsors cannot buy favourable coverage.">
            <ul className="text-[15.5px]">{AD_RULES.map((x) => <Tick key={x}>{x}</Tick>)}</ul>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[14.5px]">
                <thead>
                  <tr className="text-left text-[13px] text-muted">
                    {['Format', 'Size', 'Where it appears', 'Label'].map((h) => <th key={h} className="pb-1.5 pr-4 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(AD_FORMATS).map((a) => (
                    <tr key={a.name} className="border-t border-rule align-top">
                      <td className="whitespace-nowrap py-2.5 pr-4 font-semibold">{a.name}</td>
                      <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums">{a.size}</td>
                      <td className="py-2.5 pr-4 text-muted">{a.where}</td>
                      <td className="py-2.5"><AdTag>{a.tag}</AdTag></td>
                    </tr>
                  ))}
                  <tr className="border-t border-rule align-top">
                    <td className="whitespace-nowrap py-2.5 pr-4 font-semibold">Anchor</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums">320 × 50</td>
                    <td className="py-2.5 pr-4 text-muted">Bottom edge of the screen on phones and tablets. Can be closed.</td>
                    <td className="py-2.5"><AdTag /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mb-2 mt-7 text-[13.5px] font-semibold">Specimen: what every advert looks like</p>
            <AdSlot format="leaderboard" slot={0} placement="How we work, as a specimen" />
          </Block>

          <Block n={8} id="live-data" title="Live data and freshness" lede="Every figure names its provider and says how old it is. Old data is flagged, never hidden.">
            <ul className="grid gap-x-8 sm:grid-cols-3">
              {FRESH_LEGEND.map(([state, name, text]) => (
                <li key={state} className="border-t border-ink py-3.5">
                  <Freshness state={state}><b className="font-semibold text-ink">{name}</b></Freshness>
                  <p className="mt-1.5 text-[14.5px] text-muted">{text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[14.5px]">
                <thead>
                  <tr className="text-left text-[13px] text-muted">
                    {['Module', 'Provider', 'State now'].map((h) => <th key={h} className="pb-1.5 pr-4 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(([module, provider, state, note]) => (
                    <tr key={module} className="border-t border-rule">
                      <td className="whitespace-nowrap py-2.5 pr-4 font-semibold">{module}</td>
                      <td className="py-2.5 pr-4 text-muted">{provider}</td>
                      <td className="py-2.5"><Freshness state={state}>{note}</Freshness></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-5"><TextLink to="/live">Open live data</TextLink></p>
          </Block>

          <Block n={9} id="faq" title="Questions readers ask">
            <Faq items={FAQ} />
          </Block>

          <Block n={10} id="status" title="Status and contact" lede="This is a preview edition. These parts are not connected yet, and each one says so on screen where it appears.">
            <dl className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
              {NOT_CONNECTED.map(([t, d]) => (
                <div key={t} className="border-t border-rule py-3">
                  <dt><Freshness state="off"><b className="font-semibold text-ink">{t}</b></Freshness></dt>
                  <dd className="mt-1 text-[14.5px] text-muted">{d}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <ButtonLink to="/legal" size="sm">Legal and contact</ButtonLink>
              <Button size="sm" variant="line" onClick={() => openCorrection()}>Report a correction</Button>
            </div>
          </Block>
        </div>
      </Container>
    </>
  )
}

/* ---------- Parts ---------- */

/** The id of the section currently under the top third of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-25% 0px -65% 0px' }
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [ids.join()])
  return active
}

function Block({ n, id, title, lede, children }: { n: number; id: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-40 pt-12 lg:scroll-mt-20">
      <div className="mb-5 grid items-baseline gap-x-4 sm:grid-cols-[34px_1fr]">
        <span aria-hidden="true" className="font-mono text-xs tabular-nums text-signal">{String(n).padStart(2, '0')}</span>
        <div>
          <h2 className="text-[28px]">{title}</h2>
          {lede && <p className="mt-2 max-w-[62ch] text-[17px] text-muted">{lede}</p>}
        </div>
      </div>
      <div className="sm:pl-[50px]">{children}</div>
    </section>
  )
}

const tierMark = (t: Tier) => (t === 'high' ? 'bg-ink' : t === 'medium' ? 'hatch-x' : 'ring-1 ring-inset ring-ink')

function ActorTag({ actor }: { actor: Actor }) {
  return (
    <span
      className={twMerge(
        'whitespace-nowrap rounded-full border px-2 py-px text-[12px] font-semibold',
        actor === 'Editor' ? 'border-signal bg-signal text-ink' : actor === 'AI' ? 'border-ink bg-ink text-white' : 'border-rule text-muted'
      )}
    >
      {actor}
    </span>
  )
}

/** Small caption shown above a value on phones, where the table has no header row. */
const Label = ({ children }: { children: React.ReactNode }) => <span className="block text-[12.5px] text-muted md:hidden">{children}</span>

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <dd className="text-[34px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{value}</dd>
      <dt className="mt-1.5 text-[13.5px] text-muted">{label}</dt>
    </div>
  )
}

function Tick({ children, no = false }: { children: React.ReactNode; no?: boolean }) {
  return (
    <li className="grid grid-cols-[22px_1fr] border-b border-rule py-2.5 first:border-t">
      <span aria-hidden="true" className={twMerge('font-semibold', no ? 'text-signal' : 'text-ink')}>{no ? '×' : '✓'}</span>
      <span>{no && <span className="sr-only">Not allowed: </span>}{children}</span>
    </li>
  )
}

function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]))
  const all = open.size === items.length
  const toggle = (i: number) =>
    setOpen((s) => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setOpen(all ? new Set() : new Set(items.map((_, i) => i)))} className="text-sm font-semibold text-muted hover:text-ink">
          {all ? 'Close all' : 'Open all'}
        </button>
      </div>
      <div className="border-b border-rule">
        {items.map(([q, a], i) => (
          <div key={q} className="border-t border-rule">
            <button
              type="button"
              aria-expanded={open.has(i)}
              aria-controls={`faq-${i}`}
              onClick={() => toggle(i)}
              className="flex w-full justify-between gap-4 py-3.5 text-left text-[17px] font-semibold"
            >
              {q}
              <span aria-hidden="true" className="font-normal text-signal">{open.has(i) ? '–' : '+'}</span>
            </button>
            {open.has(i) && <p id={`faq-${i}`} className="max-w-[70ch] pb-4 text-[15.5px] text-muted">{a}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Plain table used by the legal page. */
export function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="mt-3.5 overflow-x-auto">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr>{head.map((h) => <th key={h} className="py-1 pr-4 text-left text-[13px] font-medium text-muted">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-rule align-top">
              {r.map((cell, i) => (
                <td key={i} className={i === 0 ? 'whitespace-nowrap py-3.5 pr-4 font-semibold' : 'py-3.5 pr-4'}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
