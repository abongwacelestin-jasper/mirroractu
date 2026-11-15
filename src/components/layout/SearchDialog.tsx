import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { SearchPanel } from '@/components/search/SearchPanel'
import { Container } from '@/components/ui'
import { DEFAULT_FILTERS, SearchFilters } from '@/lib/search'

type Props = { open: boolean; query: string; onQueryChange: (q: string) => void; onClose: () => void }

/** Search as a panel that drops from the top of any page. Opens with "/" and closes with Escape. */
export function SearchDialog({ open, query, onQueryChange, onClose }: Props) {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
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
          className="fixed inset-0 z-[58] bg-ink/55 backdrop-blur-[3px]"
        >
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="max-h-[100dvh] overflow-y-auto overscroll-contain bg-white shadow-[0_30px_60px_-20px_rgba(14,20,36,.5)] sm:max-h-[90vh]"
          >
            <Container className="max-w-[1000px] pb-8 pt-5 sm:pt-7">
              <SearchPanel variant="dialog" query={query} onQuery={onQueryChange} filters={filters} onFilters={setFilters} onOpenResult={onClose} onClose={onClose} />
            </Container>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
