import React, { useState } from 'react'
import { Link } from 'react-router-dom'

import { useSiteActions } from '@/lib/actions'
import { useEdition } from '@/lib/edition'
import { CATEGORIES, sectionPath } from '@/data'
import { Container } from '@/components/ui'

const NEWS_TOPICS: [string, string][] = [
  ['COP31', 'cop31'],
  ['AGOA and trade', 'agoa'],
  ['Elections', 'election'],
  ['AI', 'ai'],
  ['Box office', 'box office'],
  ['African football', 'caf'],
]

type Props = { formRef: React.RefObject<HTMLFormElement>; onSearch: (q?: string) => void; onTop: () => void }

export function Footer({ formRef, onSearch, onTop }: Props) {
  const { openCookieSettings, openCorrection, openEdition } = useSiteActions()
  const [country] = useEdition()
  return (
    <footer className="border-t border-rule-dark bg-ink text-mirror">
      <Container>
        <div className="grid items-end gap-8 border-b border-rule-dark pb-9 pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-12 lg:pt-16">
          <div className="min-w-0">
            <div className="whitespace-nowrap text-[clamp(44px,6vw,76px)] font-extrabold leading-[0.9] tracking-[-0.035em] text-white">
              <span translate="no">Mirror<b className="font-extrabold text-signal">Actu</b></span>
            </div>
            <p className="mb-5 mt-[18px] font-serif text-[26px] leading-[1.15] text-white">
              Today, reflected. <span className="text-mirror">Tomorrow, remembered.</span>
            </p>
            <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em]">
              <i className="size-2 rounded-full bg-dew" />
              Powered by <b className="font-medium normal-case tracking-[0.02em]">TheGoodMorningDewPub</b>
            </div>
          </div>
          <SignupForm formRef={formRef} />
        </div>

        <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-8 sm:py-9 lg:grid-cols-5 lg:py-12">
          <Column title="Sections" defaultOpen>
            {CATEGORIES.map((c) => <li key={c.id}><FootLink to={sectionPath(c.id)}>{c.name}</FootLink></li>)}
          </Column>
          <Column title="In the news">
            {NEWS_TOPICS.map(([label, q]) => (
              <li key={q}><button type="button" onClick={() => onSearch(q)} className="text-left hover:text-white">{label}</button></li>
            ))}
          </Column>
          <Column title="Read">
            <li><FootLink to="/brief">The Brief</FootLink></li>
            <li><FootLink to="/coming-up">Coming up</FootLink></li>
            <li><FootLink to="/live">Live data</FootLink></li>
            <li><FootLink to="/saved">Saved stories</FootLink></li>
            <li><FootLink to="/offers">Offers (advertising)</FootLink></li>
            <li><button type="button" onClick={() => onSearch()} className="hover:text-white">Search</button></li>
          </Column>
          <Column title="Trust">
            <li><FootLink to="/how-we-work">How we work</FootLink></li>
            <li><FootLink to="/how-we-work#sources">Sources and attribution</FootLink></li>
            <li><FootLink to="/how-we-work#corrections">Corrections</FootLink></li>
            <li><button type="button" onClick={() => openCorrection()} className="text-left hover:text-white">Report a correction</button></li>
            <li><FootLink to="/how-we-work#ai">How we use AI</FootLink></li>
            <li><FootLink to="/how-we-work#advertising">Advertising</FootLink></li>
          </Column>
          <Column title="Company">
            <li><FootLink to="/how-we-work">About MirrorActu</FootLink></li>
            <li><FootLink to="/legal">Contact</FootLink></li>
            <li><FootLink to="/legal">Privacy</FootLink></li>
            <li><FootLink to="/legal">Terms of use</FootLink></li>
            <li><FootLink to="/legal#credits">Picture credits</FootLink></li>
            <li><button type="button" onClick={openCookieSettings} className="text-left hover:text-white">Cookie settings</button></li>
          </Column>
        </div>

        <div className="flex flex-col items-start justify-between gap-x-10 gap-y-5 border-t border-rule-dark py-[22px] text-sm sm:flex-row sm:flex-wrap sm:items-center">
          <dl className="flex flex-col gap-x-10 gap-y-3 sm:flex-row sm:flex-wrap">
            <div><dt className="text-[12.5px] text-faint">Edition</dt><dd><button type="button" onClick={openEdition} className="text-white underline decoration-signal decoration-2 underline-offset-4">{country.name}. Change edition or language</button></dd></div>
            <div><dt className="text-[12.5px] text-faint">Status</dt><dd className="text-white">Preview, compiled 15 November 2026</dd></div>
            <div><dt className="text-[12.5px] text-faint">Website</dt><dd className="text-white">mirroractu.net</dd></div>
          </dl>
          <button
            type="button"
            onClick={onTop}
            className="w-full rounded-full border border-rule-dark px-[18px] py-[9px] text-sm font-semibold text-white transition-colors duration-150 hover:border-white sm:w-auto"
          >
            Back to top
          </button>
        </div>

        <div className="flex flex-col justify-between gap-x-8 gap-y-3.5 border-t border-rule-dark pb-[30px] pt-[22px] text-[13.5px] sm:flex-row sm:flex-wrap">
          <span>© 2026 TheGoodMorningDewPub. Stories link to their original sources.</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
            {['Privacy', 'Terms', 'Accessibility'].map((l) => <FootLink key={l} to="/legal">{l}</FootLink>)}
            <button type="button" onClick={openCookieSettings} className="hover:text-white">Cookie settings</button>
          </nav>
        </div>
      </Container>
    </footer>
  )
}

function FootLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="hover:text-white">{children}</Link>
}

/** A link column: always open from 640px up, an accordion on phones. */
function Column({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="min-w-0 border-b border-rule-dark last:border-b-0 sm:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-[17px] text-base font-semibold text-white sm:pointer-events-none sm:mb-4 sm:py-0 sm:text-sm"
      >
        {title}
        <span aria-hidden="true" className="text-xl font-normal text-mirror sm:hidden">{open ? '–' : '+'}</span>
      </button>
      <ul className={`${open ? 'grid' : 'hidden'} gap-3.5 pb-5 text-base sm:grid sm:gap-2.5 sm:pb-0 sm:text-[15px]`}>{children}</ul>
    </div>
  )
}

function SignupForm({ formRef }: { formRef: React.RefObject<HTMLFormElement> }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  return (
    <form
      ref={formRef}
      noValidate
      className="min-w-0"
      onSubmit={(e) => {
        e.preventDefault()
        setMessage(
          /^\S+@\S+\.\S+$/.test(email.trim())
            ? 'That address is valid. Sign-up opens at launch, so nothing was sent or stored.'
            : 'Enter an email address such as name@example.com.'
        )
      }}
    >
      <h4 className="mb-1.5 text-xl font-semibold tracking-[-0.01em] text-white">Get the morning email</h4>
      <p className="mb-4 max-w-[44ch] text-[15px]">What happened, what is confirmed and why it matters. One email a day, free.</p>
      <EmailField value={email} onChange={setEmail} />
      <p role="status" className="mt-2.5 min-h-5 text-[13.5px] text-mirror-light">{message}</p>
    </form>
  )
}

export function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex max-w-[460px] rounded-full bg-white p-[5px] focus-within:ring-[3px] focus-within:ring-signal">
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
        className="min-w-0 flex-1 bg-transparent px-[18px] py-[11px] text-base text-ink outline-none"
      />
      <button type="submit" className="rounded-full border border-signal bg-signal px-5 py-2.5 text-[15px] font-semibold text-ink transition-colors duration-150 hover:bg-signal-hover">
        Sign up
      </button>
    </div>
  )
}
