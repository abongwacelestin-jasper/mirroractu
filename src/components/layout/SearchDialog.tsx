import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { CATEGORIES, CategoryId, SEARCH_TOPICS, categoryName, searchStories, storyDate, storyPath } from '@/data'
import { SearchIcon } from '@/components/layout/Masthead'
import { Button, Container, MonoDate, Pill } from '@/components/ui'

type Props = { open: boolean; query: string; onQueryChange: (q: string) => void; onClose: () => void }

export function SearchDialog({ open, query, onQueryChange, onClose }: Props) {
  const [category, setCategory] = useState<CategoryId | 'all'>('all')
  const input = useRef<HTMLInputElement>(null)
  const results = searchStories(query, category)

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-[3px]"
        >
          <motion.div
            initial={{ y: -12 }}
            animate={{ y: 0 }}
            exit={{ y: -12 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="max-h-[86vh] overflow-auto bg-white shadow-[0_30px_60px_-20px_rgba(14,20,36,.5)]"
          >
            <Container className="max-w-[920px] pb-9 pt-7">
              <div className="flex items-center gap-4 border-b-2 border-ink pb-3">
                <SearchIcon className="size-6 flex-none" />
                <input
                  ref={input}
                  type="search"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Search a story, place or topic"
                  aria-label="Search a story, place or topic"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-[-0.02em] outline-none placeholder:font-normal placeholder:text-[#9aa0b0] sm:text-[30px]"
                />
                <Button variant="line" size="sm" onClick={onClose}>Close</Button>
              </div>

              <div className="mb-1 mt-3.5 flex flex-wrap gap-2">
                {(['all', ...CATEGORIES.map((c) => c.id)] as const).map((id) => (
                  <Pill key={id} selected={category === id} onClick={() => setCategory(id)}>
                    {id === 'all' ? 'All sections' : categoryName(id)}
                  </Pill>
                ))}
              </div>
              <div className="mb-1.5 mt-[18px] flex flex-wrap items-center gap-2 text-sm text-muted">
                Try
                {SEARCH_TOPICS.map(([label, q]) => (
                  <Pill key={q} onClick={() => onQueryChange(q)}>{label}</Pill>
                ))}
              </div>

              <div aria-live="polite">
                {results.length ? (
                  results.map((s) => (
                    <Link
                      key={s.id}
                      to={storyPath(s.id)}
                      onClick={onClose}
                      className="group grid items-baseline gap-1 border-b border-rule py-4 sm:grid-cols-[110px_1fr] sm:gap-[18px]"
                    >
                      <span className="text-[13.5px] font-semibold">
                        {categoryName(s.cats[0])}
                        <MonoDate className="mt-0.5 block font-normal text-muted">{storyDate(s)}</MonoDate>
                      </span>
                      <span>
                        <strong className="block text-[19px] font-semibold leading-tight tracking-[-0.015em] decoration-signal decoration-2 underline-offset-4 group-hover:underline">
                          {s.h}
                        </strong>
                        <span className="mt-0.5 block text-[14.5px] text-muted">{s.st}</span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="py-7 text-muted">No stories match “{query}”. Try a place, a name or one of the topics above.</p>
                )}
              </div>
            </Container>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
