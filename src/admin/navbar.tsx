/**
 * The dashboard's top bar tools: "Go to" (find a page, a story or an action from anywhere,
 * also on Ctrl/⌘ K), a menu of quick actions, and the account menu.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

import { api } from '@/lib/api'
import { Avatar } from './ui'

export type GoItem = { id: string; label: string; hint: string; group: 'Pages' | 'Actions' | 'Stories'; run: () => void }

/** Close a popover when the reader clicks elsewhere or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return ref
}

export function GoTo({ items, onOpenStory }: { items: GoItem[]; onOpenStory: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const [stories, setStories] = useState<{ id: string; h: string; sub: string; published: boolean }[] | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const ref = useDismiss(open, () => setOpen(false))

  // Ctrl/⌘ K from anywhere in the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        window.setTimeout(() => input.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  // Stories are fetched the first time the box is used, not on every page.
  useEffect(() => {
    if (open && !stories) api<{ stories: { id: string; h: string; sub: string; published: boolean }[] }>('/admin/stories').then((d) => setStories(d.stories)).catch(() => setStories([]))
  }, [open])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    const match = (text: string) => !term || text.toLowerCase().includes(term)
    const fixed = items.filter((i) => match(`${i.label} ${i.hint}`))
    const found: GoItem[] = term.length < 2 ? [] : (stories ?? []).filter((s) => match(`${s.h} ${s.sub}`)).slice(0, 6).map((s) => ({ id: `story:${s.id}`, label: s.h, hint: s.published ? `Story · ${s.sub}` : `Story · ${s.sub} · unpublished`, group: 'Stories', run: () => onOpenStory(s.id) }))
    return [...fixed.slice(0, term ? 6 : 20), ...found]
  }, [q, items, stories])
  useEffect(() => setAt(0), [q])
  const go = (item: GoItem | undefined) => {
    if (!item) return
    setOpen(false)
    setQ('')
    input.current?.blur()
    item.run()
  }

  return (
    <div ref={ref} className="relative hidden min-w-0 max-w-[340px] flex-1 md:block">
      <label className="relative block">
        <span className="sr-only">Go to a page, story or action</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          ref={input}
          value={q}
          role="combobox"
          aria-expanded={open}
          aria-controls="goto-list"
          aria-autocomplete="list"
          placeholder="Go to…"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAt((n) => Math.min(results.length - 1, n + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAt((n) => Math.max(0, n - 1)) }
            if (e.key === 'Enter') go(results[at])
          }}
          className="h-10 w-full rounded-full border border-ink/20 bg-white pl-10 pr-14 text-[14px] outline-none transition-colors placeholder:text-muted focus:border-ink"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-ink/20 px-1.5 font-mono text-[10.5px] text-muted">Ctrl K</kbd>
      </label>
      {open && (
        <ul id="goto-list" role="listbox" className="scroll-quiet absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[min(440px,70dvh)] overflow-y-auto border border-rule bg-white py-1.5 shadow-[0_24px_48px_-20px_rgba(14,20,36,.45)]">
          {results.length === 0 && <li className="px-4 py-3 text-[13.5px] text-muted">Nothing matches “{q.trim()}”.</li>}
          {results.map((r, i) => (
            <React.Fragment key={r.id}>
              {(i === 0 || results[i - 1].group !== r.group) && <li role="presentation" className="px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{r.group}</li>}
              <li role="option" aria-selected={i === at}>
                <button type="button" onMouseEnter={() => setAt(i)} onClick={() => go(r)} className={`block w-full px-4 py-2 text-left ${i === at ? 'bg-paper' : ''}`}>
                  <span className="block truncate text-[14.5px] font-semibold">{r.label}</span>
                  <span className="block truncate text-[12.5px] text-muted">{r.hint}</span>
                </button>
              </li>
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A button that opens a short menu. */
export function Menu({ label, icon, items, align = 'right', ariaLabel }: { label?: React.ReactNode; icon?: React.ReactNode; items: { label: string; hint?: string; run: () => void; danger?: boolean }[]; align?: 'left' | 'right'; ariaLabel: string }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative flex-none">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)} className="flex h-10 items-center gap-1.5 rounded-full border border-ink/20 bg-white px-2.5 text-[13.5px] font-semibold transition-colors hover:border-ink">
        {icon}{label}<ChevronDown className={`size-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="menu" className={`absolute top-[calc(100%+6px)] z-40 w-[250px] border border-rule bg-white py-1.5 shadow-[0_24px_48px_-20px_rgba(14,20,36,.45)] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((i) => (
            <li key={i.label} role="none">
              <button type="button" role="menuitem" onClick={() => { setOpen(false); i.run() }} className={`block w-full px-4 py-2 text-left hover:bg-paper ${i.danger ? 'text-[#b3261e]' : ''}`}>
                <span className="block text-[14px] font-semibold">{i.label}</span>
                {i.hint && <span className="block text-[12px] text-muted">{i.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AccountMenu({ name, role, onAccount, onSignOut }: { name: string; role: string; onAccount: () => void; onSignOut: () => void }) {
  return <Menu ariaLabel={`Account: ${name}`} icon={<Avatar name={name} className="size-7 text-[12px]" />} items={[{ label: 'Your account', hint: `${name} · ${role}`, run: onAccount }, { label: 'Sign out', run: onSignOut, danger: true }]} />
}
