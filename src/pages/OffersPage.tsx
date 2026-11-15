import React, { useEffect, useState } from 'react'
import { CountUp } from '@/components/ui/CountUp'
import { ArrowRight, BedDouble, CalendarDays, Check, Info, Landmark, Plane } from 'lucide-react'
import { Link, NavLink, useLocation, useParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { AdTag } from '@/components/ads/AdSlot'
import { EmailField } from '@/components/layout/Footer'
import { Container, Hl, PageHeader, TextLink } from '@/components/ui'
import type { Media } from '@/data/media'
import { ADVERTISERS, AIRLINES, Advertiser, FLIGHT_GALLERY, OFFER_CATEGORIES, Offer, OfferCategoryId, airlinesOn, findOffer, offerPath, offersPath } from '@/data/offers'
import { api } from '@/lib/api'
import { NotFoundPage } from '@/pages/NotFoundPage'

const ICONS: Record<OfferCategoryId, React.ComponentType<{ className?: string }>> = {
  flights: Plane,
  stays: BedDouble,
  events: CalendarDays,
  banking: Landmark,
}
const categoryName = (id: OfferCategoryId) => OFFER_CATEGORIES.find((c) => c.id === id)!.name

/* ---------- Shared parts ---------- */

function Photo({ image, ratio = 'aspect-[3/2]', credit = false, eager = false, className }: { image: Media; ratio?: string; credit?: boolean; eager?: boolean; className?: string }) {
  return (
    <figure className={className}>
      <div className={twMerge('overflow-hidden bg-paper-2', ratio)}>
        <img src={image.src} alt={image.alt} loading={eager ? 'eager' : 'lazy'} className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
      </div>
      {credit && (
        <figcaption className="mt-1.5 text-[11.5px] leading-snug text-muted">
          File photo: {image.alt}.{' '}
          <a href={image.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{image.credit}, {image.licence}</a>
        </figcaption>
      )}
    </figure>
  )
}

function CategoryTabs() {
  return (
    <nav aria-label="Offer categories" className="sticky top-[96px] z-[5] border-b border-rule bg-white lg:top-[68px]">
      <Container className="no-scrollbar flex gap-2 overflow-x-auto py-2.5">
        {[{ id: undefined, name: 'All offers' }, ...OFFER_CATEGORIES].map((c) => {
          const Icon = c.id ? ICONS[c.id] : null
          return (
            <NavLink
              key={c.name}
              to={offersPath(c.id)}
              end={!c.id}
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
  )
}

/** One offer as a picture card. The whole card opens the offer's page. */
function OfferCard({ advertiser, offer }: { advertiser: Advertiser; offer: Offer }) {
  return (
    <Link to={offerPath(advertiser, offer)} data-reveal className="group flex h-full flex-col border border-rule bg-white transition-shadow duration-200 hover:shadow-[0_18px_36px_-20px_rgba(14,20,36,.45)]">
      <div className="relative">
        <Photo image={offer.image} />
        <span className="absolute left-0 top-3 bg-ink px-2.5 py-1 text-[15px] font-extrabold tabular-nums text-white">{offer.price}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-2 text-[12px] text-muted"><AdTag className="text-[9px]">Ad</AdTag>{advertiser.name}</p>
        <h3 className="mt-1.5 text-[20px] leading-tight"><Hl>{offer.title}</Hl></h3>
        <p className="mt-1 text-[14.5px] text-muted">{offer.detail}</p>
        <p className="mt-2 text-[12.5px] text-muted">{offer.priceNote}</p>
        <span className="mt-auto flex items-center gap-1.5 pt-3.5 text-[14px] font-semibold">
          {advertiser.cta} <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}

/** The advertiser's own panel: who they are, in their colours. Sits in the grid beside their offers. */
function AdvertiserTile({ advertiser, className, wide = false }: { advertiser: Advertiser; className?: string; wide?: boolean }) {
  const Icon = ICONS[advertiser.category]
  return (
    <section id={advertiser.id} aria-label={`About ${advertiser.name}`} data-reveal className={twMerge('flex scroll-mt-40 flex-col overflow-hidden border border-rule', wide && 'md:flex-row', className)} style={{ background: advertiser.bg, color: advertiser.fg }}>
      <Photo image={advertiser.image} ratio={wide ? 'aspect-[3/1] md:aspect-auto md:h-full' : 'aspect-[2/1]'} className={twMerge(wide && 'md:w-[44%] md:flex-none [&>div]:md:h-full')} eager />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[12.5px] opacity-85">
          <AdTag className="bg-black/25 text-[9.5px]">Advertiser</AdTag>
          <Icon className="size-4" /> {categoryName(advertiser.category)}
        </p>
        <h2 className="mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em] sm:text-[32px]">{advertiser.name}</h2>
        <p className="mt-2 text-[15px] opacity-90">{advertiser.about}</p>
        <p className="mt-auto pt-4 text-[13.5px] font-semibold" style={{ color: advertiser.accent }}>{advertiser.offers.length} offers · {advertiser.line}</p>
      </div>
    </section>
  )
}

/** An advertiser with their offers in a four-column grid that always fills its row. */
function AdvertiserBlock({ advertiser }: { advertiser: Advertiser }) {
  const n = advertiser.offers.length
  // 2 offers: tile takes 2 columns. 3 offers: tile takes 1. 4 or more: tile is a full-width banner above.
  const span = n >= 4 ? 'lg:col-span-4' : n === 3 ? 'lg:col-span-1' : 'lg:col-span-2'
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <AdvertiserTile advertiser={advertiser} wide={n >= 4} className={twMerge('sm:col-span-2', span)} />
      {advertiser.offers.map((offer) => <OfferCard key={offer.id} advertiser={advertiser} offer={offer} />)}
    </div>
  )
}

function Disclosure() {
  return (
    <p className="mt-10 flex max-w-[90ch] gap-3 border-t border-rule pt-5 text-[13.5px] text-muted">
      <Info className="mt-0.5 size-4 flex-none" />
      <span>
        Advertisers, prices and schedules shown are placeholders until partner feeds are connected. Offers are sold separately from the newsroom, and
        sponsors cannot buy coverage. <TextLink to="/how-we-work#advertising" className="text-ink">Our advertising rules</TextLink>
      </span>
    </p>
  )
}

const AdNotice = () => (
  <p className="max-w-[34ch] border-l-2 border-signal pl-4 text-[14.5px] text-mirror-light">
    <AdTag className="mb-2 bg-white/15">Advertising</AdTag>
    <span className="block">Everything on this page is paid for by the advertiser named. The newsroom has no part in it.</span>
  </p>
)

/* ---------- /offers and /offers/:category ---------- */

export function OffersPage() {
  const { category } = useParams()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, category])

  if (category && !OFFER_CATEGORIES.some((c) => c.id === category)) return <NotFoundPage />
  const current = OFFER_CATEGORIES.find((c) => c.id === category)
  const advertisers = current ? ADVERTISERS.filter((a) => a.category === current.id) : ADVERTISERS

  return (
    <>
      <PageHeader title={current ? current.name : 'Offers'} intro={current ? current.blurb : 'Fares, stays, events and services from our advertisers.'} aside={<AdNotice />} />
      <CategoryTabs />

      <Container className="pb-[72px] pt-8">
        {current ? (
          <>
            <div className="space-y-12">{advertisers.map((a) => <AdvertiserBlock key={a.id} advertiser={a} />)}</div>
            {advertisers.map((a) => (
              <React.Fragment key={a.id}>
                <Compare advertiser={a} />
                <HowItWorks advertiser={a} />
              </React.Fragment>
            ))}
            {current.id === 'flights' && <Airlines />}
            <OtherCategories except={current.id} />
          </>
        ) : (
          <div className="space-y-14">
            {OFFER_CATEGORIES.map((c) => {
              const Icon = ICONS[c.id]
              const list = ADVERTISERS.filter((a) => a.category === c.id)
              return (
                <section key={c.id} aria-label={c.name}>
                  <div data-reveal="left" className="mb-5 flex items-end justify-between gap-4 border-t-2 border-ink pt-4">
                    <div>
                      <h2 className="flex items-center gap-2.5 text-[30px] font-extrabold tracking-[-0.035em]"><Icon className="size-6" /> {c.name}</h2>
                      <p className="mt-1 text-muted">{c.blurb}</p>
                    </div>
                    <TextLink to={offersPath(c.id)} className="whitespace-nowrap text-[14.5px]">All {c.name.toLowerCase()}</TextLink>
                  </div>
                  <div className="space-y-8">{list.map((a) => <AdvertiserBlock key={a.id} advertiser={a} />)}</div>
                </section>
              )
            })}
          </div>
        )}
        <Disclosure />
      </Container>
    </>
  )
}

/**
 * Reference, not advertising: the real airlines that fly from Kigali, with their aircraft.
 * They have not paid to appear and the placeholder fares on this page are not theirs.
 */
function Airlines() {
  return (
    <section id="airlines" aria-label="Airlines flying from Kigali" className="mt-14 scroll-mt-40">
      <div className="border-t-2 border-ink pt-4">
        <h2 className="text-[26px] font-extrabold tracking-[-0.03em]">Airlines flying from Kigali</h2>
        <p className="mt-1.5 max-w-[80ch] text-[14.5px] text-muted">
          <span className="mr-2 inline-block bg-paper-2 px-1.5 py-[3px] font-mono text-[10.5px] uppercase leading-none tracking-[0.14em] text-ink">Reference</span>
          For information, not an advert. These airlines have not paid to appear and the fares above are not theirs. Routes and timetables change, so check with the airline.
        </p>
      </div>
      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {AIRLINES.map((a) => (
          <li key={a.id} data-reveal className="group flex flex-col border border-rule bg-white">
            <Photo image={a.image} ratio="aspect-[16/9]" />
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-[22px] leading-tight">{a.name}</h3>
              <p className="mt-1 text-[14.5px] text-muted">{a.about}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-rule pt-3 text-[13.5px]">
                <dt className="text-muted">Hub</dt><dd>{a.hub}</dd>
                <dt className="text-muted">From Kigali</dt>
                <dd>{a.routes.length ? ADVERTISERS.flatMap((x) => x.offers).filter((o) => a.routes.includes(o.id)).map((o) => o.title.replace('Kigali to ', '')).join(', ') : a.hub.split(' (')[0]}</dd>
              </dl>
              <p className="mt-auto pt-3 text-[11.5px] leading-snug text-muted">
                File photo: {a.image.alt}. <a href={a.image.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{a.image.credit}, {a.image.licence}</a>
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {FLIGHT_GALLERY.map((m) => <Photo key={m.src} image={m} ratio="aspect-[2/1]" credit className="group" />)}
      </div>
    </section>
  )
}

/** Side-by-side comparison of an advertiser's offers, one row per fact. */
function Compare({ advertiser }: { advertiser: Advertiser }) {
  const labels = [...new Set(advertiser.offers.flatMap((o) => o.facts.map((f) => f[0])))]
  return (
    <section aria-label={`Compare ${advertiser.name} offers`} data-reveal className="mt-14">
      <h2 className="border-t-2 border-ink pt-4 text-[26px] font-extrabold tracking-[-0.03em]">Compare at a glance</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[14.5px]">
          <thead>
            <tr className="align-bottom">
              <th className="w-[130px] pb-2 text-left text-[13px] font-medium text-muted"><span className="sr-only">Detail</span></th>
              {advertiser.offers.map((o) => (
                <th key={o.id} className="pb-2 pl-4 text-left">
                  <Link to={offerPath(advertiser, o)} className="group block text-[16px] font-semibold leading-tight"><Hl>{o.title}</Hl></Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-ink bg-paper/60">
              <th className="py-2.5 pl-2 text-left text-[13px] font-medium text-muted">Price</th>
              {advertiser.offers.map((o) => (
                <td key={o.id} className="py-2.5 pl-4"><b className="text-[18px] font-extrabold tabular-nums"><CountUp value={o.price} /></b><span className="block text-[12px] text-muted">{o.priceNote}</span></td>
              ))}
            </tr>
            {labels.map((label) => (
              <tr key={label} className="border-t border-rule align-top">
                <th className="py-2.5 pl-2 text-left text-[13px] font-medium text-muted">{label}</th>
                {advertiser.offers.map((o) => <td key={o.id} className="py-2.5 pl-4">{o.facts.find((f) => f[0] === label)?.[1] ?? '—'}</td>)}
              </tr>
            ))}
            <tr className="border-t border-rule align-top">
              <th className="py-2.5 pl-2 text-left text-[13px] font-medium text-muted">Conditions</th>
              {advertiser.offers.map((o) => <td key={o.id} className="py-2.5 pl-4 text-[13.5px] text-muted">{o.terms}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function HowItWorks({ advertiser }: { advertiser: Advertiser }) {
  return (
    <section aria-label="How it works" data-reveal className="mt-14">
      <h2 className="border-t-2 border-ink pt-4 text-[26px] font-extrabold tracking-[-0.03em]">How it works</h2>
      <ol className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-3">
        {advertiser.steps.map(([title, text], i) => (
          <li key={title} className="relative border-t border-ink pt-3">
            <span aria-hidden="true" className="absolute -top-[7px] left-0 size-3 rounded-full bg-signal" />
            <b className="text-[18px] font-semibold"><span className="mr-2 font-mono text-xs font-normal text-muted">{i + 1}</span>{title}</b>
            <p className="mt-1 text-[15px] text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function OtherCategories({ except }: { except: OfferCategoryId }) {
  return (
    <section aria-label="More offers" className="mt-14">
      <h2 className="border-t-2 border-ink pt-4 text-[26px] font-extrabold tracking-[-0.03em]">More offers</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {ADVERTISERS.filter((a) => a.category !== except).map((a) => {
          const Icon = ICONS[a.category]
          return (
            <Link key={a.id} to={offersPath(a.category)} data-reveal className="group relative block overflow-hidden bg-ink text-white">
              <Photo image={a.image} ratio="aspect-[16/9]" className="opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink via-ink/40 to-transparent p-4">
                <p className="flex items-center gap-2 text-[12.5px] text-mirror-light"><Icon className="size-4" /> {categoryName(a.category)}</p>
                <p className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{a.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-signal">{a.offers.length} offers <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" /></p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- /offers/:category/:offerId ---------- */

export function OfferPage() {
  const { category, offerId } = useParams()
  const found = findOffer(category, offerId)
  if (!found) return <NotFoundPage />
  const { advertiser, offer } = found
  const Icon = ICONS[advertiser.category]
  const others = advertiser.offers.filter((o) => o.id !== offer.id)

  return (
    <>
      <CategoryTabs />
      <Container className="pb-[72px] pt-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-muted">
          <Link to="/offers" className="hover:text-ink hover:underline">Offers</Link>
          <span aria-hidden="true">/</span>
          <Link to={offersPath(advertiser.category)} className="hover:text-ink hover:underline">{categoryName(advertiser.category)}</Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{offer.title}</span>
        </nav>

        <div className="mt-5 grid gap-x-10 gap-y-8 lg:grid-cols-12">
          <article className="min-w-0 lg:col-span-7">
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <AdTag>Advertiser offer</AdTag>
              <Icon className="size-4" /> {categoryName(advertiser.category)} · Paid for by <b className="font-semibold text-ink">{advertiser.name}</b>
            </p>
            <h1 className="rise mt-3 text-[clamp(34px,4.6vw,60px)] font-extrabold leading-[0.98] tracking-[-0.04em]">{offer.title}</h1>
            <p className="mt-3 max-w-[40em] font-serif text-[22px] leading-[1.25] text-muted sm:text-[25px]">{offer.about}</p>
            <Photo image={offer.image} ratio="aspect-[16/9]" credit eager className="-mx-[18px] mt-6 sm:mx-0 [&_figcaption]:px-[18px] sm:[&_figcaption]:px-0" />

            <h2 className="mt-9 border-t-2 border-ink pt-3 text-[22px]">The details</h2>
            <dl className="mt-2 grid gap-x-8 sm:grid-cols-2">
              {offer.facts.map(([label, value]) => (
                <div key={label} className="border-b border-rule py-3">
                  <dt className="text-[12.5px] text-muted">{label}</dt>
                  <dd className="mt-0.5 text-[16.5px] font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-9 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              <section>
                <h2 className="border-t-2 border-ink pt-3 text-[22px]">What is included</h2>
                <ul className="mt-1.5 text-[15.5px]">
                  {offer.includes.map((x) => (
                    <li key={x} className="flex gap-2.5 border-b border-rule py-2.5"><Check className="mt-0.5 size-[18px] flex-none text-signal" strokeWidth={3} />{x}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="border-t-2 border-ink pt-3 text-[22px]">Good to know</h2>
                <ul className="mt-1.5 text-[15.5px]">
                  {offer.goodToKnow.map((x) => (
                    <li key={x} className="flex gap-2.5 border-b border-rule py-2.5"><Info className="mt-0.5 size-[18px] flex-none text-muted" />{x}</li>
                  ))}
                </ul>
              </section>
            </div>

          </article>

          <aside className="min-w-0 lg:col-span-5">
            <div>
              <div className="p-6" style={{ background: advertiser.bg, color: advertiser.fg }}>
                <p className="text-[13px] opacity-85">{advertiser.name}</p>
                <p className="mt-1 text-[52px] font-extrabold leading-none tracking-[-0.04em] tabular-nums"><CountUp value={offer.price} /></p>
                <p className="mt-1.5 text-[14.5px] opacity-90">{offer.priceNote}</p>
                <p className="mt-4 border-t pt-3 text-[14px]" style={{ borderColor: `${advertiser.accent}55` }}>{offer.terms}</p>
              </div>
              <Enquiry key={offer.id} advertiser={advertiser} offerId={offer.id} />
              <ol aria-label="How it works" className="mt-6 border-t-2 border-ink">
                {advertiser.steps.map(([title, text], i) => (
                  <li key={title} className="grid grid-cols-[28px_minmax(0,1fr)] border-b border-rule py-3">
                    <span className="flex size-5 items-center justify-center rounded-full bg-signal font-mono text-[11px] font-bold text-ink">{i + 1}</span>
                    <span>
                      <b className="block text-[15.5px] font-semibold leading-tight">{title}</b>
                      <span className="mt-0.5 block text-[14px] text-muted">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>

              {airlinesOn(offer.id).length > 0 && (
                <section aria-label="Airlines on this route" className="mt-6">
                  <h2 className="border-t-2 border-ink pt-3 text-base tracking-normal">Airlines that fly this route</h2>
                  <p className="mt-1 text-[12.5px] text-muted">Reference, not an advert. The fare above is not theirs.</p>
                  <ul className="mt-1">
                    {airlinesOn(offer.id).map((a) => (
                      <li key={a.id} className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 border-b border-rule py-2.5">
                        <Photo image={a.image} ratio="aspect-[16/10]" />
                        <span className="min-w-0">
                          <span className="block text-[15.5px] font-semibold leading-tight">{a.name}</span>
                          <span className="block text-[13px] text-muted">Hub: {a.hub}</span>
                          <a href={a.image.page} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted underline underline-offset-2">Photo: {a.image.credit}, {a.image.licence}</a>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2"><TextLink to="/offers/flights#airlines" className="text-[13.5px]">All airlines at Kigali</TextLink></p>
                </section>
              )}

              {others.length > 0 && (
                <section aria-label={`Also from ${advertiser.name}`} className="mt-6">
                  <h2 className="border-t-2 border-ink pt-3 text-base tracking-normal">Also from {advertiser.name}</h2>
                  <ul>
                    {others.map((o) => (
                      <li key={o.id} className="border-b border-rule">
                        <Link to={offerPath(advertiser, o)} className="group grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                          <Photo image={o.image} ratio="aspect-[4/3]" />
                          <span className="min-w-0">
                            <span className="block text-[15.5px] font-semibold leading-tight"><Hl>{o.title}</Hl></span>
                            <span className="block truncate text-[13px] text-muted">{o.detail}</span>
                          </span>
                          <b className="whitespace-nowrap text-[15.5px] font-extrabold tabular-nums">{o.price}</b>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="mt-4 flex gap-2.5 text-[12.5px] text-muted">
                <Info className="mt-0.5 size-4 flex-none" />
                Placeholder advertiser and price: there is nothing to book in this preview. MirrorActu’s newsroom has no part in advertiser offers.
              </p>
            </div>
          </aside>
        </div>

        <OtherCategories except={advertiser.category} />
        <Disclosure />
      </Container>
    </>
  )
}

function Enquiry({ advertiser, offerId }: { advertiser: Advertiser; offerId: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'error' | 'done'>('idle')
  return (
    <div className="border border-t-0 border-rule p-6">
      {state === 'done' ? (
        <p role="status" className="border-l-[3px] border-signal bg-paper p-4 text-[15px]">
          Thank you. Your enquiry is recorded. This advertiser is a placeholder in the preview, so no booking follows yet.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setState('error')
            try {
              await api('/enquiries', { body: { email: email.trim(), advertiserId: advertiser.id, offerId } })
              setState('done')
            } catch {
              setState('error')
            }
          }}
        >
          <h2 className="text-[19px]">{advertiser.cta}</h2>
          <p className="mb-3 mt-1 text-[14px] text-muted">Leave an email address and {advertiser.name} replies with the next step.</p>
          <div className="rounded-full border border-ink/35"><EmailField value={email} onChange={setEmail} submitLabel="Send" /></div>
          <p role="status" className="mt-2 min-h-5 text-sm text-signal">{state === 'error' ? 'Enter an email address such as name@example.com, then try again.' : ''}</p>
        </form>
      )}
    </div>
  )
}
