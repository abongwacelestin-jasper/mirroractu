import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Container, PageHeader, TextLink } from '@/components/ui'
import { STORIES, storyPath } from '@/data'
import { MEDIA } from '@/data/media'
import { ADVERTISERS, AIRLINES, FLIGHT_GALLERY, offerPath, offersPath } from '@/data/offers'
import { useSiteActions } from '@/lib/actions'
import { eraseStoredData, storedData } from '@/lib/store'
import { SimpleTable } from '@/pages/StandardsPage'

const ROWS = [
  ['Privacy', 'What reader data is collected and why', 'Draft pending legal review'],
  ['Terms of use', 'Rules for using the site and its content', 'Draft pending legal review'],
  ['Cookies', 'Consent choices for analytics and advertising', 'To be written with the consent tool'],
  ['Accessibility', 'The standard the site meets and how to report a barrier', 'After the accessibility audit'],
  ['Contact', 'Newsroom, corrections and advertising addresses', 'Published at launch'],
]

export function LegalPage() {
  const { openCookieSettings, openCorrection } = useSiteActions()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])
  const flightPictures = [...AIRLINES.map((a) => ({ key: a.id, to: '/offers/flights#airlines', label: a.name, m: a.image })), ...FLIGHT_GALLERY.map((m) => ({ key: m.src, to: '/offers/flights#airlines', label: m.alt, m }))]
  const pictures = STORIES.filter((s) => MEDIA[s.id]).map((s) => ({ key: s.id, to: storyPath(s.id), label: s.h, m: MEDIA[s.id] }))
  // Pictures on the advertiser offers pages, without repeating one already listed.
  const seen = new Set(pictures.map((p) => p.m.src))
  for (const a of ADVERTISERS) {
    for (const x of [{ key: a.id, to: offersPath(a.category), label: a.name, m: a.image }, ...a.offers.map((o) => ({ key: o.id, to: offerPath(a, o), label: o.title, m: o.image }))]) {
      if (!seen.has(x.m.src)) {
        seen.add(x.m.src)
        pictures.push(x)
      }
    }
  }
  pictures.push(...flightPictures)

  return (
    <>
      <PageHeader title="Legal and contact" intro="These pages are being prepared for launch. Here is where each one stands." />
      <Container className="grid gap-x-10 gap-y-10 pb-14 pt-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <SimpleTable head={['Page', 'What it will cover', 'Status']} rows={ROWS} />
          <p className="mt-7 text-lg text-muted">
            In this preview nothing you type is sent or stored on a server. Saved stories, followed sections, reading history and text size stay in your browser.
          </p>
        </div>
        <aside className="min-w-0 lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          <h2 className="border-t-2 border-ink pt-3 text-base tracking-normal">Things you can do now</h2>
          <ul className="mt-1 text-[15.5px]">
            <li className="border-b border-rule py-3"><button type="button" onClick={openCookieSettings} className="font-semibold underline decoration-signal decoration-2 underline-offset-4">Change cookie settings</button><span className="mt-0.5 block text-sm text-muted">Readership measurement and advertising, on or off.</span></li>
            <li className="border-b border-rule py-3"><button type="button" onClick={() => openCorrection()} className="font-semibold underline decoration-signal decoration-2 underline-offset-4">Report a correction</button><span className="mt-0.5 block text-sm text-muted">An editor checks every report against the sources.</span></li>
            <li className="border-b border-rule py-3"><TextLink to="/how-we-work">Read how we work</TextLink><span className="mt-0.5 block text-sm text-muted">Sources, sign-off, AI, corrections and advertising.</span></li>
            <li className="border-b border-rule py-3"><a href="#your-data" className="font-semibold underline decoration-signal decoration-2 underline-offset-4">See or erase your data</a><span className="mt-0.5 block text-sm text-muted">Everything this site keeps is in your browser.</span></li>
            <li className="py-3"><a href="#credits" className="font-semibold underline decoration-signal decoration-2 underline-offset-4">Picture credits</a><span className="mt-0.5 block text-sm text-muted">Who made each photograph, and its licence.</span></li>
          </ul>
        </aside>
      </Container>

      <YourData />

      <section id="credits" className="scroll-mt-24 bg-paper py-[52px]">
        <Container>
          <h2 className="text-[28px]">Picture credits</h2>
          <p className="mt-2 max-w-[70ch] text-muted">
            Photographs on MirrorActu, including those on advertiser offers, are file photos from Wikimedia Commons, used under the licence shown.
            They illustrate a subject and were not taken at the events reported. Each links to its original, where the full licence terms are given.
          </p>
          <ul className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {pictures.map(({ key, to, label, m }) => {
              return (
                <li data-reveal key={key} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-t border-rule pt-4">
                  <Link to={to} aria-label={label}><img src={m.src} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover" /></Link>
                  <div className="text-[13.5px] leading-snug">
                    <p className="font-semibold">{m.alt}</p>
                    <p className="mt-1 text-muted">{m.credit} · {m.licence}</p>
                    <a href={m.page} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline underline-offset-2 hover:text-ink">Original on Wikimedia Commons</a>
                  </div>
                </li>
              )
            })}
          </ul>
        </Container>
      </section>
    </>
  )
}

const LABELS: Record<string, string> = {
  'ma-consent': 'Your privacy choice',
  'ma-country': 'Country edition you chose',
  'ma-country-geo': 'Country found by lookup',
  'ma-follow': 'Desks you follow',
  'ma-saved': 'Saved stories',
  'ma-liked': 'Liked stories',
  'ma-read': 'Stories you have opened',
  'ma-hidden': 'Stories hidden from your feed',
  'ma-size': 'Text size',
  'ma-feed-tab': 'Feed tab last used',
  'ma-searches': 'Recent searches',
  'ma-welcome-seen': 'Welcome shown',
  'ma-nl-seen': 'Newsletter prompt shown',
  'ma-trends-seen': 'Trends popup last shown',
  'ma-promo-seen': 'MirrorActu promo last shown',
  'ma-alerts-muted': 'Live alerts muted',
  'ma-lang-offer': 'Language offer answered',
}

const describe = (value: string) => {
  try {
    const v = JSON.parse(value)
    if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'item' : 'items'}`
    if (v && typeof v === 'object' && 'at' in v) return `Chosen ${new Date(v.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  } catch {
    /* plain text */
  }
  return /^\d{12,}$/.test(value) ? new Date(Number(value)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : value || 'Set'
}

/**
 * The reader's data, in the open: what this site keeps in their browser, a copy to download,
 * and one button to erase it all. Nothing here is on a server, so there is nothing else to ask for.
 */
function YourData() {
  const [data, setData] = useState(storedData)
  const [confirming, setConfirming] = useState(false)
  const keys = Object.keys(data).sort()

  const download = () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), site: 'MirrorActu', data }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'mirroractu-my-data.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section id="your-data" className="scroll-mt-24 border-t border-rule py-[52px]">
      <Container className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="text-[28px]">Your data</h2>
          <p className="mt-2 text-muted">
            MirrorActu has no accounts and keeps nothing about you on a server. Your choices live in this browser, listed here. You can take a copy or erase them.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={download} disabled={!keys.length} className="rounded-full border-2 border-ink px-4 py-2 text-[14.5px] font-semibold transition-colors hover:bg-paper disabled:opacity-40">Download a copy</button>
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    eraseStoredData()
                    setData({})
                    setConfirming(false)
                  }}
                  className="rounded-full border-2 border-signal bg-signal px-4 py-2 text-[14.5px] font-semibold text-ink"
                >
                  Yes, erase everything
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="px-2 text-[14.5px] text-muted hover:text-ink">Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} disabled={!keys.length} className="rounded-full border-2 border-ink px-4 py-2 text-[14.5px] font-semibold transition-colors hover:bg-paper disabled:opacity-40">Erase everything</button>
            )}
          </div>
          {confirming && <p className="mt-3 text-[13.5px] text-muted">This removes your saved stories, likes, followed desks, edition and privacy choice from this browser. You will be asked for your privacy choice again.</p>}
        </div>
        <div className="min-w-0 lg:col-span-8">
          {keys.length ? (
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {keys.map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-t border-rule py-2.5 text-[14.5px]">
                  <dt>{LABELS[k] ?? k}</dt>
                  <dd className="max-w-[45%] truncate text-right text-muted tabular-nums">{describe(data[k])}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="border-t border-rule py-4 text-muted">Nothing is stored in this browser.</p>
          )}
        </div>
      </Container>
    </section>
  )
}
