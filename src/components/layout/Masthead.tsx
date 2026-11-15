import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { CATEGORIES, CategoryId, EDITION_DATE, resolveStory, sectionPath, storiesIn, storyDate, storyPath } from '@/data'
import { useSiteActions } from '@/lib/actions'
import { useEdition } from '@/lib/edition'
import { useSavedStories } from '@/lib/store'
import { Logo } from '@/components/brand/Logo'
import { LanguageMenu } from '@/components/layout/LanguageMenu'
import { Container, Hl, MonoDate, TextLink, buttonClass } from '@/components/ui'

export function Masthead({ onSearch, onSubscribe }: { onSearch: () => void; onSubscribe: () => void }) {
  const [saved] = useSavedStories()
  const [country] = useEdition()
  const { openEdition } = useSiteActions()
  const [menu, setMenu] = useState<CategoryId | null>(null)
  const timer = useRef<number>()
  const { pathname } = useLocation()

  // A story page lights up the nav item of its section.
  const storyMatch = pathname.match(/^\/story\/(.+)$/)
  const activeSection = storyMatch ? resolveStory(storyMatch[1]).story?.cats[0] : pathname.slice(1)

  useEffect(() => setMenu(null), [pathname])

  const hover = (id: CategoryId | null) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMenu(id), id ? 80 : 120)
  }

  return (
    <>
      <div className="hidden border-b border-rule-dark bg-ink text-[13px] text-mirror lg:block">
        <Container className="flex justify-between gap-6 py-[9px]">
          <span className="hidden sm:inline">
            {EDITION_DATE}
            <button type="button" onClick={openEdition} className="ml-4 font-semibold text-mirror-light hover:text-white">
              {country.name} edition ▾
            </button>
          </span>
          <nav aria-label="Reader tools" className="flex gap-6">
            <NavLink to="/saved" className={({ isActive }) => `hover:text-white ${isActive ? 'font-semibold text-white underline decoration-signal decoration-2 underline-offset-[5px]' : ''}`}>Saved stories{saved.length ? ` (${saved.length})` : ''}</NavLink>
            <NavLink to="/trends" className={({ isActive }) => `hidden hover:text-white md:inline ${isActive ? 'font-semibold text-white underline decoration-signal decoration-2 underline-offset-[5px]' : ''}`}>Trends</NavLink>
            <NavLink to="/brief" className={({ isActive }) => `hidden hover:text-white md:inline ${isActive ? 'font-semibold text-white underline decoration-signal decoration-2 underline-offset-[5px]' : ''}`}>The Brief</NavLink>
            <NavLink to="/coming-up" className={({ isActive }) => `hidden hover:text-white md:inline ${isActive ? 'font-semibold text-white underline decoration-signal decoration-2 underline-offset-[5px]' : ''}`}>Coming up</NavLink>
            <NavLink to="/live" className={({ isActive }) => `hidden hover:text-white md:inline ${isActive ? 'font-semibold text-white underline decoration-signal decoration-2 underline-offset-[5px]' : ''}`}>Live data</NavLink>
            <NavLink to="/how-we-work" className={({ isActive }) => `hidden hover:text-white md:inline ${isActive ? 'font-semibold text-white underline decoration-signal decoration-2 underline-offset-[5px]' : ''}`}>How we work</NavLink>
            <NavLink to="/offers" className={({ isActive }) => `hidden hover:text-white md:inline ${isActive ? 'font-semibold text-white underline decoration-signal decoration-2 underline-offset-[5px]' : ''}`}>Offers <span className="ml-1 bg-mirror/20 px-1 py-px font-mono text-[9.5px] uppercase tracking-[0.12em]">Ad</span></NavLink>
          </nav>
        </Container>
      </div>

      <header className="sticky top-0 z-30 bg-ink text-white" onMouseLeave={() => hover(null)}>
        <Container className="flex flex-wrap items-center gap-x-4 pt-2.5 lg:h-[68px] lg:flex-nowrap lg:gap-[22px] lg:pt-0 xl:gap-9">
          <Link to="/" aria-label="MirrorActu, home" className="mr-auto flex items-center gap-2 sm:gap-2.5 lg:mr-0">
            <Logo className="size-7 sm:size-8" />
            <span aria-hidden="true" className="whitespace-nowrap text-[21px] font-extrabold leading-[0.9] tracking-[-0.035em] sm:text-[26px]">
              <span translate="no">Mirror<b className="font-extrabold text-signal">Actu</b></span>
            </span>
          </Link>

          <ul className="no-scrollbar order-last -mx-[18px] mt-1 flex h-10 basis-full overflow-x-auto px-[9px] sm:-mx-6 sm:px-[15px] lg:order-none lg:mx-0 lg:mt-0 lg:h-full lg:min-w-0 lg:flex-1 lg:basis-auto lg:overflow-visible lg:px-0">
            {CATEGORIES.map((c) => (
              <li key={c.id} className="flex" onMouseEnter={() => hover(c.id)} onFocus={() => setMenu(c.id)}>
                <NavLink
                  to={sectionPath(c.id)}
                  aria-current={activeSection === c.id ? 'page' : undefined}
                  className={({ isActive }) =>
                    twMerge(
                      'relative flex items-center whitespace-nowrap px-[9px] text-[14.5px] font-medium text-mirror-light transition-colors duration-150 hover:text-white xl:px-[13px] xl:text-[15px]',
                      'after:absolute after:inset-x-[9px] after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-signal after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 xl:after:inset-x-[13px]',
                      (isActive || activeSection === c.id || menu === c.id) && 'text-white after:scale-x-100'
                    )
                  }
                >
                  {c.name}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={onSearch}
              aria-label="Search stories"
              className="flex items-center gap-2.5 rounded-full border border-transparent bg-mirror/12 px-2.5 py-2 text-sm sm:px-3 text-mirror-light transition-colors duration-150 hover:border-mirror hover:text-white xl:min-w-[190px] xl:pl-3.5"
            >
              <SearchIcon className="size-[15px] flex-none" />
              <span className="hidden xl:inline">Search stories</span>
              <kbd className="ml-auto hidden rounded border border-rule-dark px-1.5 font-mono text-[11px] xl:inline">/</kbd>
            </button>
            <LanguageMenu />
            <button type="button" onClick={onSubscribe} className={buttonClass({ size: 'sm', className: 'px-3 text-[13px] max-[389px]:hidden sm:px-[15px] sm:text-sm' })}>
              Subscribe
            </button>
          </div>
        </Container>

        <AnimatePresence>
          {menu && <MegaMenu key={menu} id={menu} onEnter={() => hover(menu)} />}
        </AnimatePresence>
      </header>
    </>
  )
}

function MegaMenu({ id, onEnter }: { id: CategoryId; onEnter: () => void }) {
  const cat = CATEGORIES.find((c) => c.id === id)!
  const top = storiesIn(id).slice(0, 3)
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      onMouseEnter={onEnter}
      className="absolute inset-x-0 top-full hidden border-b border-rule bg-white text-ink shadow-[0_24px_48px_-24px_rgba(14,20,36,.35)] lg:block"
    >
      <Container className="grid grid-cols-[3fr_9fr] gap-12 pb-10 pt-9">
        <div>
          <h3 className="mb-2.5 text-[34px] font-extrabold tracking-[-0.035em]">{cat.name}</h3>
          <p className="mb-4 max-w-[30ch] text-muted">{cat.blurb}</p>
          <TextLink to={sectionPath(id)}>All {cat.name} stories</TextLink>
        </div>
        <ul className="grid grid-cols-3 gap-8">
          {top.map((s) => (
            <li key={s.id} className="border-t border-ink pt-3">
              <Link to={storyPath(s.id)} className="group block text-lg font-semibold leading-[1.22] tracking-[-0.015em]">
                <MonoDate className="mb-2 block font-normal text-muted">{storyDate(s)}</MonoDate>
                <Hl>{s.h}</Hl>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </motion.div>
  )
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}
