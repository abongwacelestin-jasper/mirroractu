import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Activity, BarChart3, Eye, EyeOff, ExternalLink, FileText, Inbox, KeyRound, LogOut, Mail, Menu, MoreHorizontal, Plus, Radio, ScrollText, Send, ShieldCheck, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AnimatedLogo } from '@/components/brand/AnimatedLogo'
import { Logo } from '@/components/brand/Logo'
import { CATEGORIES, CategoryId, EDITION_DATE } from '@/data'
import { ApiError, api } from '@/lib/api'
import { dismissBoot } from '@/lib/boot'
import { HAS_SITE_LINK, SITE_URL, adminPath } from '@/lib/target'
import { WIRE_KIND_LABEL, useLiveStatus, useWire, useWireSource } from '@/live/feed'
import { Avatar, Btn, Drawer, Field, Notice, Pill, ago, inputClass } from './ui'
import { Email } from './email'

// The Engagement page carries the map outlines, so it is loaded only when opened.
const Engagement = React.lazy(() => import('./engagement').then((m) => ({ default: m.Engagement })))
import { Account, Audit, InboxView, Overview, Staff, Stories, Subscribers, Wire } from './views'

/**
 * The staff dashboard. In production it is its own website on its own address (see
 * lib/target.ts); the public site contains none of this. Everything here talks to
 * /api/v1/admin, which only answers signed-in staff arriving through the dashboard's own server. Editors manage stories, the wire and the inbox; administrators can also
 * manage staff, export subscribers and read the audit log.
 *
 * Layout: navigation on the left, the page in the middle, and a live "Now" rail on the right.
 * Below 1280px the rail becomes a panel opened from the top bar (it slides up from the bottom
 * on phones); below 1024px the navigation becomes a bottom bar and a menu.
 */

export type User = { id: number; email: string; name: string; role: 'admin' | 'editor'; mustChangePassword?: boolean }
export type Correction = { id: number; story_title: string | null; message: string; email: string | null; status: string; note: string | null; created_at: string; handled_by_name: string | null }
export type OverviewData = {
  counts: Record<string, number>
  days: { day: string; views: number; readers: number }[]
  topStories: { id: string; headline: string; views: number; readers: number }[]
  countries: { key: string; readers: number }[]
  languages: { key: string; readers: number }[]
  trends: { id: string; label: string; rank: number; moved: number; score: number; readers: number; wireCount: number; activeNow: boolean; storyIds: string[]; basis?: 'local' | 'read-here' | 'wider' }[]
  activeCountries: { code: string; name: string; readers: number }[]
}

type Ctx = { user: User; overview: OverviewData | null; corrections: Correction[]; reload: () => void }
const AdminContext = createContext<Ctx>(null as unknown as Ctx)
export const useAdmin = () => useContext(AdminContext)

type TabId = 'overview' | 'engagement' | 'stories' | 'wire' | 'inbox' | 'subscribers' | 'email' | 'staff' | 'audit' | 'account'
type NavItem = { id: TabId; label: string; Icon: typeof BarChart3 }
const NAV: { group: string; admin?: boolean; items: NavItem[] }[] = [
  { group: 'Newsroom', items: [{ id: 'overview', label: 'Overview', Icon: BarChart3 }, { id: 'engagement', label: 'Engagement', Icon: Activity }, { id: 'stories', label: 'Stories', Icon: FileText }, { id: 'wire', label: 'Live wire', Icon: Radio }] },
  { group: 'Readers', items: [{ id: 'inbox', label: 'Inbox', Icon: Inbox }, { id: 'subscribers', label: 'Subscribers', Icon: Mail }, { id: 'email', label: 'Email', Icon: Send }] },
  { group: 'Administration', admin: true, items: [{ id: 'staff', label: 'Staff', Icon: Users }, { id: 'audit', label: 'Audit log', Icon: ScrollText }] },
  { group: 'You', items: [{ id: 'account', label: 'Your account', Icon: KeyRound }] },
]
const TITLES: Record<TabId, [string, string]> = {
  overview: ['Overview', 'How the edition is doing today'],
  engagement: ['Engagement', 'Pages, clicks, searches and where readers are'],
  stories: ['Stories', 'Write, edit and publish'],
  wire: ['Live wire', 'File updates to every open page'],
  inbox: ['Inbox', 'Corrections and enquiries from readers'],
  subscribers: ['Subscribers', 'Morning email sign-ups'],
  email: ['Email', 'The morning email, and every email we send'],
  staff: ['Staff', 'Who can sign in, and as what'],
  audit: ['Audit log', 'Who changed what, and when'],
  account: ['Your account', 'Password and session'],
}

export function AdminApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    document.title = 'MirrorActu dashboard'
    dismissBoot()
    // Keep the dashboard out of search engines.
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    api<{ user: User | null }>('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null))
    return () => meta.remove()
  }, [])

  if (user === undefined) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-ink font-display text-mirror">
        <AnimatedLogo className="size-14" />
        <p className="text-[14px]">Opening the dashboard…</p>
      </div>
    )
  }
  if (!user) return <Login onDone={setUser} />
  // An account on its first, shared password must choose its own before anything else.
  if (user.mustChangePassword) return <FirstPassword user={user} onDone={() => setUser({ ...user, mustChangePassword: false })} />
  return <Shell user={user} onSignOut={() => setUser(null)} />
}

declare const __BUILD_STAMP__: string
/** "Version 15 Nov, 14:02": when the copy of the dashboard on screen was built. */
export const VERSION = `Version ${new Date(__BUILD_STAMP__).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`

/* ---------- Shell ---------- */

function Shell({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { tab = 'overview' } = useParams()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [menu, setMenu] = useState(false)
  const [rail, setRail] = useState(false)

  const groups = NAV.filter((g) => !g.admin || user.role === 'admin')
  const all = groups.flatMap((g) => g.items)
  const current = all.find((t) => t.id === tab) ?? all[0]
  const openCorrections = corrections.filter((c) => c.status === 'open' || c.status === 'checking').length

  const reload = useCallback(() => {
    api<OverviewData>('/admin/overview').then(setOverview).catch(() => {})
    api<{ corrections: Correction[] }>('/admin/corrections').then((d) => setCorrections(d.corrections)).catch(() => {})
  }, [])
  // Refresh the shared figures on arrival, on every page change, and each minute.
  useEffect(() => {
    reload()
    const t = window.setInterval(reload, 60000)
    return () => window.clearInterval(t)
  }, [reload, tab])
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    setMenu(false)
    setRail(false)
    window.scrollTo(0, 0)
    mainRef.current?.scrollTo(0, 0)
    document.title = `${TITLES[current.id][0]} · MirrorActu dashboard`
  }, [current.id])

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    onSignOut()
  }
  const badge = (id: TabId) => (id === 'inbox' && openCorrections ? openCorrections : id === 'stories' && overview?.counts.drafts ? overview.counts.drafts : 0)

  const navList = (onDark: boolean) => (
    <nav aria-label="Dashboard">
      {groups.map((g) => (
        <div key={g.group} className="mb-3.5">
          <p className={twMerge('mb-1.5 px-3 font-mono text-[10.5px] uppercase tracking-[0.14em]', onDark ? 'text-mirror/70' : 'text-muted')}>{g.group}</p>
          {g.items.map(({ id, label, Icon }) => {
            const active = current.id === id
            return (
              <Link
                key={id}
                to={adminPath(id)}
                aria-current={active ? 'page' : undefined}
                className={twMerge(
                  'relative flex items-center gap-3 px-3 py-2 text-[14.5px] font-medium transition-colors duration-150',
                  onDark ? (active ? 'bg-white/10 text-white' : 'text-mirror-light hover:bg-white/5 hover:text-white') : active ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5'
                )}
              >
                {active && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-signal" />}
                <Icon className="size-[18px] flex-none" />
                <span className="flex-1">{label}</span>
                {badge(id) > 0 && <span className="rounded-full bg-signal px-1.5 text-[11.5px] font-bold leading-5 text-ink tabular-nums">{badge(id)}</span>}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )

  const userCard = (onDark: boolean) => (
    <div className={twMerge('flex items-center gap-3 border-t px-3 py-3.5', onDark ? 'border-rule-dark' : 'border-rule')}>
      <Avatar name={user.name} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[14px] font-semibold">{user.name}</p>
        <p className={twMerge('truncate text-[12px]', onDark ? 'text-mirror' : 'text-muted')}>{user.role === 'admin' ? 'Administrator' : 'Editor'}</p>
      </div>
      <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className={twMerge('flex size-9 flex-none items-center justify-center rounded-full transition-colors', onDark ? 'text-mirror hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-ink/5 hover:text-ink')}>
        <LogOut className="size-[18px]" />
      </button>
    </div>
  )

  const [title, sub] = TITLES[current.id]

  return (
    <AdminContext.Provider value={{ user, overview, corrections, reload }}>
      <div className="min-h-[100dvh] bg-paper pt-[var(--safe-top)] font-display text-ink lg:grid lg:h-[100dvh] lg:grid-cols-[250px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden" translate="no">
        <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[71] h-[var(--safe-top)] bg-ink" />
        {/* From 1024px the page itself never scrolls: the menu, the page and the Now rail each scroll on their own. */}
        <aside className="hidden h-full min-h-0 flex-col overflow-hidden bg-ink text-white lg:flex">
          <Link to={adminPath('overview')} className="flex items-center gap-2.5 px-5 pb-1 pt-5">
            <Logo className="size-8" />
            <span className="text-[21px] font-extrabold tracking-[-0.035em]">Mirror<b className="font-extrabold text-signal">Actu</b></span>
          </Link>
          <p className="px-5 pb-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mirror">Newsroom dashboard</p>
          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">{navList(true)}</div>
          {HAS_SITE_LINK && (
            <a href={SITE_URL || '/'} className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-full border border-rule-dark py-2 text-[13.5px] font-semibold text-mirror-light transition-colors hover:border-white hover:text-white">
              <ExternalLink className="size-4" /> View the site
            </a>
          )}
          {userCard(true)}
          <p className="px-5 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-mirror/60">{VERSION}</p>
        </aside>

        <div className="min-w-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
          {/* Top bar */}
          <header className="sticky top-[var(--safe-top)] z-30 border-b border-rule bg-paper/95 backdrop-blur lg:static lg:flex-none">
            <div className="flex h-[60px] items-center gap-2.5 px-4 sm:gap-3 sm:px-6 lg:px-8">
              <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" className="-ml-2 flex size-10 flex-none items-center justify-center rounded-full hover:bg-ink/5 lg:hidden"><Menu className="size-[22px]" /></button>
              <span className="hidden size-8 flex-none items-center justify-center rounded-full bg-ink min-[380px]:flex lg:hidden"><Logo className="size-5" /></span>
              <div className="min-w-0 flex-1 leading-tight">
                <h1 className="truncate text-[19px] font-extrabold tracking-[-0.03em] sm:text-[22px]">{title}</h1>
                <p className="hidden truncate text-[12.5px] text-muted sm:block">{sub} · {EDITION_DATE}</p>
              </div>
              <Btn tone="signal" size="sm" onClick={() => navigate(adminPath('stories?new=1'))} className="flex-none" aria-label="New story"><Plus className="size-4" /><span className="hidden sm:inline">New story</span></Btn>
              <Btn tone="line" size="sm" onClick={() => setRail(true)} className="flex-none xl:hidden" aria-label="Open the Now panel">
                <LiveDot /> Now{openCorrections > 0 && <span className="rounded-full bg-signal px-1.5 text-[11px] font-bold leading-[18px] text-ink">{openCorrections}</span>}
              </Btn>
            </div>
          </header>

          <div className="lg:min-h-0 lg:flex-1 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[minmax(0,1fr)]">
            <main ref={mainRef} className="min-w-0 px-4 pb-28 pt-5 sm:px-6 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:px-8 lg:pb-12 lg:pt-7">
              {current.id === 'overview' && <Overview />}
              {current.id === 'engagement' && <React.Suspense fallback={<div className="shimmer h-[420px] bg-paper-2" />}><Engagement /></React.Suspense>}
              {current.id === 'stories' && <Stories />}
              {current.id === 'wire' && <Wire />}
              {current.id === 'inbox' && <InboxView />}
              {current.id === 'subscribers' && <Subscribers />}
              {current.id === 'email' && <Email />}
              {current.id === 'staff' && <Staff />}
              {current.id === 'audit' && <Audit />}
              {current.id === 'account' && <Account onSignOut={signOut} />}
            </main>

            {/* The Now rail: a fixed column from 1280px */}
            <aside aria-label="Now" className="scroll-quiet hidden h-full overflow-y-auto overscroll-contain border-l border-rule p-5 xl:block">
              <NowRail />
            </aside>
          </div>
        </div>

        {/* Phone and tablet: bottom bar, menu and Now panel */}
        <nav aria-label="Dashboard, quick" className="fixed inset-x-0 bottom-0 z-40 border-t border-rule-dark bg-ink pb-[env(safe-area-inset-bottom)] text-mirror lg:hidden">
          <ul className="mx-auto grid h-[60px] max-w-[560px] grid-cols-5">
            {(['overview', 'stories', 'wire', 'inbox'] as TabId[]).map((id) => {
              const t = all.find((x) => x.id === id)!
              const active = current.id === id
              return (
                <li key={id}>
                  <Link to={adminPath(id)} aria-current={active ? 'page' : undefined} className={twMerge('relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-white' : 'hover:text-white')}>
                    {active && <span aria-hidden="true" className="absolute inset-x-[30%] top-0 h-[3px] rounded-b-full bg-signal" />}
                    <span className="relative">
                      <t.Icon className="size-[21px]" strokeWidth={active ? 2.4 : 1.9} />
                      {badge(id) > 0 && <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-signal px-1 text-center text-[10px] font-bold leading-4 text-ink">{badge(id)}</span>}
                    </span>
                    {t.label.replace('Live wire', 'Wire')}
                  </Link>
                </li>
              )
            })}
            <li>
              <button type="button" onClick={() => setMenu(true)} className={twMerge('flex size-full flex-col items-center justify-center gap-1 text-[11px] font-semibold', ['subscribers', 'staff', 'audit', 'account'].includes(current.id) ? 'text-white' : 'hover:text-white')}>
                <MoreHorizontal className="size-[21px]" /> More
              </button>
            </li>
          </ul>
        </nav>

        <Drawer open={menu} onClose={() => setMenu(false)} title="Menu" side="left">
          <div className="-mx-1">{navList(false)}</div>
          {HAS_SITE_LINK && <a href={SITE_URL || '/'} className="mb-3 flex items-center justify-center gap-2 rounded-full border border-ink/30 bg-white py-2.5 text-[14px] font-semibold"><ExternalLink className="size-4" /> View the site</a>}
          <div className="-mx-1 bg-white">{userCard(false)}</div>
        </Drawer>
        <Drawer open={rail} onClose={() => setRail(false)} title="Now"><NowRail /></Drawer>
      </div>
    </AdminContext.Provider>
  )
}

function LiveDot() {
  const live = useLiveStatus() === 'live'
  return (
    <span className="relative flex size-2.5">
      {live && <span className="absolute inset-0 rounded-full bg-signal opacity-60 motion-safe:animate-ping" />}
      <span className={twMerge('relative size-2.5 rounded-full', live ? 'bg-signal' : 'bg-faint')} />
    </span>
  )
}

/* ---------- The Now rail ---------- */

function RailBlock({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center justify-between gap-3 border-t-2 border-ink pt-2.5">
        <h3 className="text-[14.5px] tracking-normal">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * What is happening right now: the wire as readers see it (with a box to file to it), what
 * needs an editor, today's trends, and whether the services are up. It is the right-hand
 * column on wide screens and a slide-in panel everywhere else.
 */
function NowRail() {
  const { overview, corrections, reload } = useAdmin()
  const { items, status } = useWire({ max: 4 })
  const source = useWireSource()
  const [text, setText] = useState('')
  const [cat, setCat] = useState<CategoryId>('world')
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const open = corrections.filter((c) => c.status === 'open' || c.status === 'checking')

  const file = async () => {
    setNote(null)
    try {
      await api('/admin/wire', { body: { desk: CATEGORIES.find((c) => c.id === cat)!.name, cat, kind: 'update', text: text.trim(), storyId: '' } })
      setText('')
      setNote({ kind: 'ok', text: 'Filed. It is live.' })
      reload()
    } catch (e) {
      setNote({ kind: 'error', text: (e as ApiError).fields?.[0]?.problem ?? (e as ApiError).message })
    }
  }

  const services: [string, string, boolean][] = [
    ['API and database', overview ? 'Answering' : 'Checking…', !!overview],
    ['Live wire stream', status === 'live' ? (source === 'api' ? 'Streaming' : 'Simulated') : 'Connecting…', status === 'live' && source === 'api'],
    ['Email service', 'Not connected', false],
  ]

  return (
    <div>
      <RailBlock title="On the wire" action={<span className="flex items-center gap-2 text-[12px] text-muted"><LiveDot />{status === 'live' ? (source === 'api' ? 'Live' : 'Simulated') : 'Connecting'}</span>}>
        <div className="mb-3 bg-white p-3">
          <label htmlFor="rail-wire" className="sr-only">File an update</label>
          <textarea id="rail-wire" rows={2} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="File a quick update…" className="block w-full resize-none bg-transparent text-[14.5px] outline-none placeholder:text-faint" />
          <div className="mt-2 flex items-center gap-2 border-t border-rule pt-2">
            <select aria-label="Desk" value={cat} onChange={(e) => setCat(e.target.value as CategoryId)} className="min-w-0 flex-1 border border-ink/20 bg-white px-2 py-1.5 text-[13px]">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="text-[11.5px] tabular-nums text-muted">{text.length}/300</span>
            <Btn size="sm" onClick={file} disabled={text.trim().length < 8}>File</Btn>
          </div>
          {note && <p role="status" className={twMerge('mt-2 text-[12.5px] font-semibold', note.kind === 'error' ? 'text-[#b3261e]' : 'text-[#1d5b2c]')}>{note.text}</p>}
        </div>
        <ol>
          {items.map((w) => (
            <li key={w.id} className="grid grid-cols-[40px_minmax(0,1fr)] gap-2.5 border-b border-rule py-2 text-[13.5px] last:border-b-0">
              <span className="pt-0.5 font-mono text-[11px] tabular-nums text-muted">{w.time}</span>
              <span>
                <span className={twMerge('block text-[11.5px] font-semibold', w.kind === 'confirmed' ? 'text-[#a8300f]' : 'text-muted')}>{w.desk} · {WIRE_KIND_LABEL[w.kind]}</span>
                <span className="line-clamp-2 leading-snug">{w.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link to={adminPath('wire')} className="mt-2 inline-block text-[13px] font-semibold underline decoration-signal decoration-2 underline-offset-4">Open the wire desk</Link>
      </RailBlock>

      <RailBlock title="Needs an editor" action={open.length > 0 ? <Pill tone="signal">{open.length} open</Pill> : <Pill tone="good">All clear</Pill>}>
        {open.length === 0 && !overview?.counts.drafts && <p className="text-[13.5px] text-muted">No corrections waiting and nothing unpublished.</p>}
        <ul>
          {open.slice(0, 3).map((c) => (
            <li key={c.id} className="border-b border-rule py-2 last:border-b-0">
              <Link to={adminPath('inbox')} className="group block">
                <span className="flex items-center justify-between gap-2 text-[11.5px] text-muted"><span>Correction</span><span>{ago(c.created_at)}</span></span>
                <span className="line-clamp-2 text-[13.5px] leading-snug decoration-signal decoration-2 underline-offset-4 group-hover:underline">{c.message}</span>
              </Link>
            </li>
          ))}
          {!!overview?.counts.drafts && (
            <li className="py-2">
              <Link to={adminPath('stories')} className="flex items-center justify-between gap-2 text-[13.5px] font-semibold hover:underline"><span>Unpublished stories</span><Pill tone="warn">{overview.counts.drafts}</Pill></Link>
            </li>
          )}
        </ul>
      </RailBlock>

      <RailBlock title="Today’s trends">
        <ol>
          {(overview?.trends ?? []).slice(0, 4).map((t) => (
            <li key={t.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-rule py-2 text-[13.5px] last:border-b-0">
              <span className="font-extrabold tabular-nums">{t.rank}</span>
              <span className="truncate">{t.label}</span>
              {t.activeNow ? <Pill tone="signal">Active</Pill> : <span className="text-[12px] tabular-nums text-muted">{t.score}</span>}
            </li>
          ))}
        </ol>
      </RailBlock>

      <RailBlock title="Services">
        <ul className="text-[13px]">
          {services.map(([name, state, ok]) => (
            <li key={name} className="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0">
              <span className="flex items-center gap-2"><Activity className="size-3.5 text-muted" />{name}</span>
              <Pill tone={ok ? 'good' : 'neutral'}>{state}</Pill>
            </li>
          ))}
        </ul>
      </RailBlock>
    </div>
  )
}

/* ---------- Sign in ---------- */

/** The frame shared by the sign-in and first-password screens: brand on one side, form on the other. */
function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] grid-rows-[auto_1fr] bg-white font-display text-ink lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-1" translate="no">
      <div className="relative flex flex-col justify-between overflow-hidden bg-ink px-5 pb-6 pt-[calc(24px+var(--safe-top))] text-white sm:px-10 sm:py-8 lg:px-14 lg:py-12">
        <div className="flex items-center gap-2.5 self-start">
          <AnimatedLogo className="size-9 lg:size-11" />
          <span className="text-[24px] font-extrabold tracking-[-0.035em] lg:text-[30px]">Mirror<b className="font-extrabold text-signal">Actu</b></span>
        </div>
        <div className="mt-6 lg:mt-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mirror">Newsroom dashboard</p>
          <p className="mt-1.5 font-serif text-[clamp(30px,6vw,64px)] leading-[1.12] tracking-[-0.015em]">
            Behind the <em className="text-mirror">mirror</em><span className="text-signal">.</span>
          </p>
          <ul className="mt-6 hidden gap-2.5 text-[15px] text-mirror-light md:grid lg:mt-8">
            {['Write, check and publish stories', 'File to the live wire in seconds', 'Answer corrections from readers', 'See what is being read, without tracking anyone'].map((t) => (
              <li key={t} className="flex items-center gap-3 border-t border-rule-dark pt-2.5"><span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-signal" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="mt-8 hidden items-center gap-2 text-[12.5px] text-mirror lg:flex"><ShieldCheck className="size-4" /> Staff only. Every change is recorded in the audit log. <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-mirror/60">{VERSION}</span></p>
        <div aria-hidden="true" className="axis-x absolute inset-x-0 bottom-0 h-0.5" />
      </div>
      <div className="flex items-start justify-center px-5 py-8 sm:px-10 sm:py-12 lg:items-center">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  )
}

export function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative block">
      <input type={show ? 'text' : 'password'} autoComplete={autoComplete} required value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} h-12 pr-12 text-[16px]`} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute right-1 top-1 flex size-10 items-center justify-center text-muted hover:text-ink">
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </span>
  )
}

function Login({ onDone }: { onDone: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <AuthFrame>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            onDone((await api<{ user: User }>('/auth/login', { body: { email, password } })).user)
          } catch (err) {
            setError((err as ApiError).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <h1 className="text-[32px] font-extrabold leading-none tracking-[-0.035em] sm:text-[38px]">Sign in</h1>
        <p className="mt-2 text-[15px] text-muted">For MirrorActu editors and administrators.</p>
        <div className="mt-7 grid gap-5">
          <Field label="Email">
            <input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mirroractu.net" className={`${inputClass} h-12 text-[16px]`} />
          </Field>
          <Field label="Password"><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></Field>
          {error && <Notice kind="error">{error}</Notice>}
          <Btn type="submit" tone="signal" disabled={busy || !email || !password} className="h-12 w-full text-[16px]">{busy ? 'Signing in…' : 'Sign in'}</Btn>
        </div>
        <div className="mt-7 grid gap-2 border-t border-rule pt-5 text-[13.5px] text-muted">
          <p>New here? An administrator creates your account and gives you a first password.</p>
          <p>Locked out? Wrong passwords lock an account for a short while. An administrator can reset it.</p>
          {HAS_SITE_LINK && <a href={SITE_URL || '/'} className="mt-1 justify-self-start font-semibold text-ink underline decoration-signal decoration-2 underline-offset-4">Back to the site</a>}
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{VERSION}</p>
        </div>
      </form>
    </AuthFrame>
  )
}

/** Shown once to anyone whose account was created for them: choose a password of your own. */
function FirstPassword({ user, onDone }: { user: User; onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const strength = next.length >= 16 ? 3 : next.length >= 12 ? 2 : next.length >= 6 ? 1 : 0
  return (
    <AuthFrame>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (next.length < 12) return setError('The new password needs at least 12 characters.')
          if (next !== again) return setError('The two new passwords do not match.')
          setBusy(true)
          setError('')
          try {
            await api('/auth/password', { body: { current, next } })
            onDone()
          } catch (err) {
            setError((err as ApiError).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.035em] sm:text-[36px]">Choose your password</h1>
        <p className="mt-2 text-[15px] text-muted">Welcome, {user.name}. Your account came with a first password. Replace it with one only you know.</p>
        <div className="mt-7 grid gap-5">
          <Field label="The password you were given"><PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 12 characters. A few unrelated words work well.">
            <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
            <span aria-hidden="true" className="mt-2 flex gap-1">{[1, 2, 3].map((i) => <i key={i} className={twMerge('block h-1 flex-1', strength >= i ? (strength === 1 ? 'bg-dew' : 'bg-ink') : 'bg-paper-2')} />)}</span>
          </Field>
          <Field label="New password again"><PasswordInput value={again} onChange={setAgain} autoComplete="new-password" /></Field>
          {error && <Notice kind="error">{error}</Notice>}
          <Btn type="submit" tone="signal" disabled={busy} className="h-12 w-full text-[16px]">{busy ? 'Saving…' : 'Save and continue'}</Btn>
        </div>
      </form>
    </AuthFrame>
  )
}
