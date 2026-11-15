import React, { useState } from 'react'
import { Globe, Languages } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

import { Modal } from '@/components/overlays/Modal'
import { useToast } from '@/components/overlays/Toast'
import { COUNTRIES, storiesNear } from '@/data/countries'
import { useEdition } from '@/lib/edition'
import { useConsent } from '@/lib/consent'
import { useStoredValue } from '@/lib/store'
import { LANGUAGES, READ_IN, currentLanguage, getLanguage, localePath, setLanguage, suggestedLanguage } from '@/lib/translate'

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
      <div className="mt-4 grid max-h-[38vh] grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3" translate="no">
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
 * Offers the reader's own language once, in that language where we can. It only offers:
 * nothing is translated, and nothing goes to Google, unless they say yes.
 */
export function LanguageSuggestion({ enabled }: { enabled: boolean }) {
  const [country] = useEdition()
  const { grant } = useConsent()
  const [dismissed, setDismissed] = useStoredValue('ma-lang-offer', '')
  if (!enabled || dismissed || currentLanguage() !== 'en') return null
  const language = suggestedLanguage(country.langs)
  if (!language) return null
  return (
    <div className="border-b border-rule bg-paper text-[13.5px]" translate="no">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1.5 px-[18px] py-2 sm:px-6 lg:px-10">
        <span className="flex items-center gap-2 font-semibold"><Languages className="size-4" /> {READ_IN[language.code] ?? `Read MirrorActu in ${language.native}?`}</span>
        <span className="text-muted">Machine translated by Google Translate.</span>
        <span className="ml-auto flex gap-4">
          <button
            type="button"
            onClick={() => {
              setDismissed('1')
              grant('translation')
              setLanguage(language.code)
            }}
            className="font-semibold underline decoration-signal decoration-2 underline-offset-4"
          >
            {language.native}
          </button>
          <button type="button" onClick={() => setDismissed('1')} className="text-muted hover:text-ink">No thanks</button>
        </span>
      </div>
    </div>
  )
}
