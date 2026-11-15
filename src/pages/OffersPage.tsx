import React, { useEffect, useState } from 'react'
import { Plane, BedDouble, CalendarDays, Landmark } from 'lucide-react'
import { NavLink, useLocation, useParams } from 'react-router-dom'

import { AdTag } from '@/components/ads/AdSlot'
import { EmailField } from '@/components/layout/Footer'
import { Modal } from '@/components/overlays/Modal'
import { Button, Container, PageHeader, TextLink } from '@/components/ui'
import { ADVERTISERS, Advertiser, OFFER_CATEGORIES, Offer, OfferCategoryId, offersPath } from '@/data/offers'
import { NotFoundPage } from '@/pages/NotFoundPage'

const ICONS: Record<OfferCategoryId, React.ComponentType<{ className?: string }>> = {
  flights: Plane,
  stays: BedDouble,
  events: CalendarDays,
  banking: Landmark,
}

/**
 * Where adverts lead: paid offers from advertisers, grouped by category. The whole page is
 * advertising and says so at the top; nothing here comes from the newsroom.
 */
export function OffersPage() {
  const { category } = useParams()
  const { hash } = useLocation()
  const [enquiry, setEnquiry] = useState<{ advertiser: Advertiser; offer: Offer } | null>(null)

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, category])

  if (category && !OFFER_CATEGORIES.some((c) => c.id === category)) return <NotFoundPage />
  const advertisers = category ? ADVERTISERS.filter((a) => a.category === category) : ADVERTISERS
  const current = OFFER_CATEGORIES.find((c) => c.id === category)

  return (
    <>
      <PageHeader
        title={current ? current.name : 'Offers'}
        intro={current ? current.blurb : 'Fares, stays, events and services from our advertisers.'}
        aside={
          <p className="max-w-[34ch] border-l-2 border-signal pl-4 text-[14.5px] text-mirror-light">
            <AdTag className="mb-2 bg-white/15">Advertising</AdTag>
            <span className="block">Everything on this page is paid for by the advertiser named. The newsroom has no part in it.</span>
          </p>
        }
      />

      <nav aria-label="Offer categories" className="sticky top-[96px] z-[5] border-b border-rule bg-white lg:top-[68px]">
        <Container className="no-scrollbar flex gap-2 overflow-x-auto py-2.5">
          {[{ id: undefined, name: 'All' }, ...OFFER_CATEGORIES].map((c) => {
            const Icon = c.id ? ICONS[c.id] : null
            return (
              <NavLink
                key={c.name}
                to={offersPath(c.id)}
                end
                className={({ isActive }) =>
                  `flex flex-none items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14.5px] font-semibold transition-colors duration-150 ${isActive ? 'border-ink bg-ink text-white' : 'border-rule hover:border-ink'}`
                }
              >
                {Icon && <Icon className="size-4" />}
                {c.name}
              </NavLink>
            )
          })}
        </Container>
      </nav>

      <Container className="pb-[72px] pt-8">
        <div className="grid gap-8 xl:grid-cols-2">
          {advertisers.map((a) => {
            const Icon = ICONS[a.category]
            return (
              <section data-reveal key={a.id} id={a.id} aria-label={`Offers from ${a.name}`} className="scroll-mt-40 border border-rule">
                <div className="flex items-center gap-4 p-5" style={{ background: a.bg, color: a.fg }}>
                  <span className="flex size-11 flex-none items-center justify-center rounded-full border" style={{ borderColor: a.accent, color: a.accent }}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[12.5px] opacity-80">
                      <AdTag className="bg-black/20 text-[9.5px]">Advertiser</AdTag>
                      {OFFER_CATEGORIES.find((c) => c.id === a.category)?.name}
                    </p>
                    <h2 className="mt-0.5 text-[24px] leading-tight">{a.name}</h2>
                    <p className="mt-0.5 text-[14.5px] opacity-85">{a.line}</p>
                  </div>
                </div>
                <ul>
                  {a.offers.map((o) => (
                    <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-rule p-5">
                      <div className="min-w-0">
                        <h3 className="text-[18px] leading-tight">{o.title}</h3>
                        <p className="mt-1 text-[14.5px] text-muted">{o.detail}</p>
                        <p className="mt-1 text-[12.5px] text-muted">{o.terms}</p>
                      </div>
                      <div className="text-right">
                        <p className="whitespace-nowrap text-[20px] font-extrabold tracking-[-0.02em] tabular-nums">{o.price}</p>
                        <Button size="sm" className="mt-2" onClick={() => setEnquiry({ advertiser: a, offer: o })}>{a.cta}</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        <p className="mt-8 max-w-[76ch] text-[13.5px] text-muted">
          Advertisers and prices shown are placeholders until partner feeds are connected. Offers are sold separately from the newsroom, and
          sponsors cannot buy coverage. <TextLink to="/how-we-work#advertising" className="text-ink">Our advertising rules</TextLink>
        </p>
      </Container>

      <EnquiryModal enquiry={enquiry} onClose={() => setEnquiry(null)} />
    </>
  )
}

function EnquiryModal({ enquiry, onClose }: { enquiry: { advertiser: Advertiser; offer: Offer } | null; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'error' | 'done'>('idle')
  const [last, setLast] = useState(enquiry)
  useEffect(() => {
    if (enquiry) {
      setLast(enquiry)
      setState('idle')
    }
  }, [enquiry])
  const e = enquiry ?? last

  return (
    <Modal open={!!enquiry} onClose={onClose} title="Offer details">
      {e && (
        <>
          <AdTag>Advertiser offer</AdTag>
          <p className="mt-3 text-[13.5px] text-muted">{e.advertiser.name}</p>
          <h2 className="pr-8 text-[28px] font-extrabold leading-tight tracking-[-0.03em]">{e.offer.title}</h2>
          <p className="mt-2 text-[22px] font-extrabold tabular-nums">{e.offer.price}</p>
          <p className="mt-2 text-muted">{e.offer.detail} {e.offer.terms}</p>
          {state === 'done' ? (
            <p role="status" className="mt-5 border-l-[3px] border-signal bg-paper p-4 text-[15px]">
              That address is valid, but nothing was sent. In this preview the advertiser is a placeholder, so there is no booking to make yet.
            </p>
          ) : (
            <form
              noValidate
              className="mt-5"
              onSubmit={(ev) => {
                ev.preventDefault()
                setState(/^\S+@\S+\.\S+$/.test(email.trim()) ? 'done' : 'error')
              }}
            >
              <p className="mb-2 text-sm font-semibold">Email me this offer</p>
              <div className="rounded-full border border-ink/35"><EmailField value={email} onChange={setEmail} /></div>
              <p role="status" className="mt-2 min-h-5 text-sm text-signal">{state === 'error' ? 'Enter an email address such as name@example.com.' : ''}</p>
            </form>
          )}
          <p className="mt-3 border-t border-rule pt-3 text-[13px] text-muted">You would complete this with {e.advertiser.name}, not with MirrorActu.</p>
        </>
      )}
    </Modal>
  )
}
