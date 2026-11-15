import React from 'react'
import { Bookmark, Home, Newspaper, Radio, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'

import { useSavedStories } from '@/lib/store'

const TABS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/trends', label: 'Trends', Icon: TrendingUp },
  { to: '/brief', label: 'Brief', Icon: Newspaper },
  { to: '/live', label: 'Live', Icon: Radio },
  { to: '/saved', label: 'Saved', Icon: Bookmark },
]

/** Height the bar takes, for anything that must sit above it. */
export const TAB_BAR_PX = 60

/** Thumb-reach navigation for phones and tablets. Hidden from 1024px, where the masthead has room. */
export function TabBar() {
  const [saved] = useSavedStories()
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[53] border-t border-rule-dark bg-ink pb-[env(safe-area-inset-bottom)] text-mirror lg:hidden">
      <ul className="mx-auto grid h-[60px] max-w-[560px] grid-cols-5">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-150 ${isActive ? 'text-white' : 'hover:text-white'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="tab-bar-mark" aria-hidden="true" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-x-[30%] top-0 h-[3px] rounded-b-full bg-signal" />}
                  <span className="relative">
                    <Icon key={String(isActive)} className={`size-[21px] ${isActive ? 'pop' : ''}`} strokeWidth={isActive ? 2.4 : 1.9} />
                    {label === 'Saved' && saved.length > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold leading-4 text-ink">{saved.length}</span>
                    )}
                    {label === 'Live' && <span aria-hidden="true" className="absolute -right-1 -top-0.5 size-1.5 rounded-full bg-signal" />}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
