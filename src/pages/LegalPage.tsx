import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Container, PageHeader, TextLink } from '@/components/ui'
import { STORIES, storyPath } from '@/data'
import { MEDIA } from '@/data/media'
import { useSiteActions } from '@/lib/actions'
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
  const pictures = STORIES.filter((s) => MEDIA[s.id])

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
            <li className="py-3"><a href="#credits" className="font-semibold underline decoration-signal decoration-2 underline-offset-4">Picture credits</a><span className="mt-0.5 block text-sm text-muted">Who made each photograph, and its licence.</span></li>
          </ul>
        </aside>
      </Container>

      <section id="credits" className="scroll-mt-24 bg-paper py-[52px]">
        <Container>
          <h2 className="text-[28px]">Picture credits</h2>
          <p className="mt-2 max-w-[70ch] text-muted">
            Photographs on MirrorActu are file photos from Wikimedia Commons, used under the licence shown. They illustrate the subject of a story and
            were not taken at the events reported. Each links to its original, where the full licence terms are given.
          </p>
          <ul className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {pictures.map((s) => {
              const m = MEDIA[s.id]
              return (
                <li data-reveal key={s.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-t border-rule pt-4">
                  <Link to={storyPath(s.id)} aria-label={s.h}><img src={m.src} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover" /></Link>
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
