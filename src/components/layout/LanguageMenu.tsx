import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

import { useToast } from '@/components/overlays/Toast'
import { useSiteActions } from '@/lib/actions'
import { useEdition } from '@/lib/edition'
import { LANGUAGES, Language, currentLanguage, setLanguage } from '@/lib/translate'

const EASE = [0.23, 1, 0.32, 1] as const

/**
 * Language dropdown in the masthead. Lists the languages suggested for the reader's country
 * first, then the rest. Picking one machine-translates the site through Google Translate; the
 * foot of the menu leads to the country edition picker.
 */
export function LanguageMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState(currentLanguage)
  const [country] = useEdition()
  const { openEdition } = useSiteActions()
  const toast = useToast()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const suggestedCodes = ['en', ...country.langs]
  const suggested = suggestedCodes.map((c) => LANGUAGES.find((l) => l.code === c)).filter(Boolean) as Language[]
  const others = LANGUAGES.filter((l) => !suggestedCodes.includes(l.code))

  const choose = (l: Language) => {
    setLang(l.code)
    setOpen(false)
    if (l.code !== 'en') toast(`Translating into ${l.name}`)
    setLanguage(l.code)
  }

  const row = (l: Language, i: number) => (
    <motion.li key={l.code} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.018, ease: EASE }}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={lang === l.code}
        onClick={() => choose(l)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14.5px] text-ink transition-colors duration-100 hover:bg-paper aria-checked:font-semibold"
      >
        <span className="min-w-0 flex-1 truncate">
          {l.native}
          {l.native !== l.name && <span className="ml-2 text-[13px] font-normal text-muted">{l.name}</span>}
        </span>
        {lang === l.code && <Check className="size-4 flex-none text-signal" strokeWidth={3} />}
      </button>
    </motion.li>
  )

  return (
    <div ref={box} className={twMerge('relative', className)} translate="no">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${LANGUAGES.find((l) => l.code === lang)?.name ?? 'English'}. Change language`}
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-1 rounded-full bg-mirror/12 px-2 text-[12px] sm:gap-1.5 sm:px-3 sm:text-[12.5px] font-bold uppercase tracking-wide text-mirror-light transition-colors duration-150 hover:text-white aria-expanded:bg-white aria-expanded:text-ink sm:px-3"
      >
        <Globe className="size-[15px]" />
        {lang.split('-')[0]}
        <ChevronDown className={twMerge('hidden size-3.5 transition-transform duration-200 sm:block', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Language"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            style={{ transformOrigin: 'top right' }}
            className="fixed inset-x-[18px] top-[52px] z-40 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[290px] bg-white text-ink shadow-[0_24px_48px_-16px_rgba(14,20,36,.5)] ring-1 ring-rule"
          >
            <div className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain py-2">
              <p className="px-4 pb-1 pt-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Suggested for {country.name}</p>
              <ul>{suggested.map(row)}</ul>
              <p className="mt-2 border-t border-rule px-4 pb-1 pt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">All languages</p>
              <ul>{others.map((l, i) => row(l, i + suggested.length))}</ul>
            </div>
            <div className="border-t border-rule bg-paper px-4 py-3">
              <p className="text-[12px] leading-snug text-muted">Written in English. Other languages are machine translated by Google Translate.</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  openEdition()
                }}
                className="mt-2 text-[13.5px] font-semibold underline decoration-signal decoration-2 underline-offset-4"
              >
                Country edition: {country.name}. Change
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
