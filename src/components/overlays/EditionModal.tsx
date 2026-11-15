import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Globe, Languages } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

import { Modal } from '@/components/overlays/Modal'
import { useToast } from '@/components/overlays/Toast'
import { COUNTRIES, storiesNear } from '@/data/countries'
import { useEdition } from '@/lib/edition'
import { useConsent } from '@/lib/consent'
import { useSiteActions } from '@/lib/actions'
import { LANGUAGES, READ_IN, currentLanguage, getLanguage, localePath, preferredLanguage, rememberLanguage, setLanguage, suggestedLanguage } from '@/lib/translate'

/** Choose the country edition and the reading language. */
export function EditionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [country, setCountry, { chosen, reset }] = useEdition()
  const toast = useToast()
  const [lang, setLang] = useState(currentLanguage)
  const { grant } = useConsent()
  const [allLangs, setAllLangs] = useState(false)

  // Suggested languages for this country first, then the rest.
  const suggested = ['en', ...country.langs]
  const langs = allLangs ? LANGUAGES : LANGUAGES.filter((l) => suggested.includes(l.code) || l.code === lang)

  return (
    <Modal open={open} onClose={onClose} title="Edition and language" className="sm:max-w-[640px]">
      <h2 className="flex items-center gap-2.5 pr-8 text-[26px] font-extrabold tracking-[-0.03em]"><Globe className="size-6" /> Your edition</h2>
      <p className="mt-1.5 text-[14.5px] text-muted">
        {chosen ? `You chose ${country.name}.` : country.code === 'INT' ? 'We could not tell where you are, so you have the international edition.' : `Set from your device’s time zone: ${country.name}.`}{' '}
        Stories about your country and region lead your feed.
        {chosen && (
          <button type="button" onClick={reset} className="ml-1 font-semibold text-ink underline decoration-signal decoration-2 underline-offset-4">Detect again</button>
        )}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3" translate="no">
        {COUNTRIES.map((c) => {
          const n = c.code === 'INT' ? 0 : storiesNear(c.code, 99).stories.length
          return (
            <button
              key={c.code}
              type="button"
              aria-pressed={country.code === c.code}
              onClick={() => {
                setCountry(c.code)
                toast(`Edition set to ${c.name}`)
              }}
              className="flex items-baseline justify-between gap-2 border border-rule px-3 py-2 text-left text-[14.5px] transition-colors duration-150 hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
            >
              <span className="truncate font-semibold">{c.name}</span>
              {n > 0 && <span className="flex-none text-[12px] tabular-nums opacity-70">{n}</span>}
            </button>
          )
        })}
      </div>

      <h2 className="mt-7 flex items-center gap-2.5 border-t border-rule pt-5 text-[22px] font-extrabold tracking-[-0.03em]"><Languages className="size-5" /> Language</h2>
      <p className="mt-1.5 text-[13.5px] text-muted">
        MirrorActu is written in English. Other languages are machine translated by Google Translate: choosing one sends the page text to Google, and
        names, figures and quotes may be wrong. Each language has its own address, such as <span className="font-mono text-[12.5px]">{localePath(lang === 'en' ? country.langs[0] ?? 'fr' : lang, '/trends')}</span>.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5" translate="no">
        {langs.map((l) => (
          <button
            key={l.code}
            type="button"
            aria-pressed={lang === l.code}
            onClick={() => {
              setLang(l.code)
              // Choosing a language is the reader asking for translation.
              if (l.code !== 'en') grant('translation')
              setLanguage(l.code)
            }}
            className={twMerge(
              'rounded-full border border-rule px-3.5 py-1.5 text-[14.5px] font-semibold transition-colors duration-150 hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white'
            )}
          >
            {l.native}
            {l.native !== l.name && <span className="ml-1.5 font-normal opacity-70">{l.name}</span>}
          </button>
        ))}
        {!allLangs && (
          <button type="button" onClick={() => setAllLangs(true)} className="px-2 py-1.5 text-[14px] font-semibold underline decoration-signal decoration-2 underline-offset-4">
            All {LANGUAGES.length} languages
          </button>
        )}
      </div>
      {lang !== 'en' && <p className="mt-3 text-[13px] text-muted">Reading in {getLanguage(lang).name}. Choose English to return to the original.</p>}
    </Modal>
  )
}

/**
 * The bar under the masthead when the address asks for another language.
 *  - Translation allowed: says the page is machine translated by Google and offers the original.
 *  - Not allowed (yet): asks before anything is sent to Google, so a shared /fr/ link never
 *    translates a page for someone who has not agreed to it.
 */
export function TranslationBar() {
  const { decided, allows, grant } = useConsent()
  const lang = currentLanguage()
  if (lang === 'en') return null
  const language = getLanguage(lang)
  const on = allows('translation')
  return (
    <div className="border-b border-rule bg-dew/25 text-[13px]" translate="no">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1.5 px-[18px] py-2 sm:px-6 lg:px-10">
        <span className="flex items-center gap-2 font-semibold">
          <Languages className="size-4" />
          {on ? `Machine translated into ${language.native} by Google Translate` : `This address is the ${language.name} edition (${language.native})`}
        </span>
        <span className="text-muted">{on ? 'Names and figures may be wrong.' : 'It is machine translated: the page text would be sent to Google Translate.'}</span>
        <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
          {!on && decided && (
            <button type="button" onClick={() => grant('translation')} className="font-semibold underline decoration-signal decoration-2 underline-offset-4">Translate into {language.native}</button>
          )}
          <button type="button" onClick={() => setLanguage('en')} className="font-semibold underline decoration-signal decoration-2 underline-offset-4">{on ? 'Show original English' : 'Read in English'}</button>
        </span>
      </div>
    </div>
  )
}

/**
 * Asks, once, whether the reader would like the language of the place they are in. It is a
 * question, not a switch: nothing is translated and nothing is sent to Google unless they say
 * yes, and the card says what yes means. Their answer is remembered either way.
 */
export function LanguageOffer({ enabled }: { enabled: boolean }) {
  const [country] = useEdition()
  const { grant } = useConsent()
  const { openEdition } = useSiteActions()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const language = suggestedLanguage(country.langs)
  const eligible = enabled && !!language && currentLanguage() === 'en' && preferredLanguage() === ''

  useEffect(() => {
    if (!eligible) return
    const t = window.setTimeout(() => setOpen(true), 5000)
    return () => window.clearTimeout(t)
  }, [eligible])

  if (!language) return null
  const answer = (code: string) => {
    setOpen(false)
    rememberLanguage(code)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label={`Read MirrorActu in ${language.name}?`}
          data-popup
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ duration: reduce ? 0 : 0.4, ease: [0.23, 1, 0.32, 1] }}
          translate="no"
          className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-[57] border-t-[3px] border-signal bg-white p-5 text-ink shadow-[0_-24px_60px_-20px_rgba(14,20,36,.55)] sm:inset-x-auto sm:left-5 sm:w-[420px] sm:border sm:border-t-[3px] sm:border-rule sm:border-t-signal lg:bottom-5"
        >
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
            <Languages className="size-4" /> {country.code === 'INT' ? 'Your language' : `You are reading from ${country.name}`}
          </p>
          <h2 className="mt-2 font-serif text-[30px] font-normal leading-[1.05]">{READ_IN[language.code] ?? `Read MirrorActu in ${language.native}?`}</h2>
          {READ_IN[language.code] && <p className="mt-1 text-[14.5px] text-muted">Read MirrorActu in {language.name}?</p>}
          <ul className="mt-3 grid gap-1.5 text-[13.5px] text-muted">
            <li className="border-t border-rule pt-1.5">It is machine translation by Google Translate. Names and figures can come out wrong.</li>
            <li className="border-t border-rule pt-1.5">Saying yes sends the text of the pages you open to Google.</li>
            <li className="border-t border-rule pt-1.5">You can go back to English at any time, from the language menu.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                grant('translation')
                setLanguage(language.code)
              }}
              className="flex-1 rounded-full border-2 border-ink bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-ink-2"
            >
              Yes, in {language.native}
            </button>
            <button type="button" onClick={() => answer('en')} className="flex-1 rounded-full border-2 border-ink px-4 py-2.5 text-[14.5px] font-semibold transition-colors hover:bg-paper">
              Keep English
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              openEdition()
            }}
            className="mt-3 text-[13px] font-semibold text-muted underline underline-offset-2 hover:text-ink"
          >
            Another language, or not in {country.code === 'INT' ? 'the right place' : country.name}?
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
