/**
 * Page titles and share details, kept in step with the route. Each page gets its own browser
 * tab title, description, and the tags social networks and messaging apps read when a link is
 * shared (Open Graph and Twitter cards).
 *
 * Note: these are set in the browser. Crawlers that do not run JavaScript only see the
 * defaults in index.html; for full previews of every story, render these on the server too.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { EDITION_DATE, getCategory, resolveStory } from '@/data'
import { storyMedia } from '@/data/media'
import { OFFER_CATEGORIES, findOffer } from '@/data/offers'
import { localePath } from '@/lib/translate'

const SITE = 'MirrorActu'
const TAGLINE = 'Today, reflected. Tomorrow, remembered.'
const DEFAULT_DESCRIPTION = 'MirrorActu shows what happened, what is confirmed, what is still open and where it came from.'
const DEFAULT_IMAGE = '/brand/share.png'

export type PageMeta = { title: string; description: string; image: string; type: 'website' | 'article'; heading: string }

const STATIC: Record<string, [string, string]> = {
  '/trends': ['Today’s trends', 'What MirrorActu is following most closely today, ranked by coverage, wire activity and readership.'],
  '/brief': ['The Brief', `Eight stories in about two minutes. ${EDITION_DATE}.`],
  '/coming-up': ['Coming up', 'Dates worth knowing, taken from the stories we are following.'],
  '/live': ['Live data', 'The wire, scores, markets and climate figures, each with its provider and its age.'],
  '/saved': ['Saved stories', 'Stories you have saved on this device.'],
  '/search': ['Search', 'Search MirrorActu stories, videos, photos, topics and dates.'],
  '/how-we-work': ['How we work', 'How MirrorActu decides what to publish, credits its sources and corrects its mistakes.'],
  '/legal': ['Legal and contact', 'Privacy, terms, your data and picture credits.'],
  '/offers': ['Offers', 'Fares, stays, events and services from our advertisers. Advertising, kept apart from the newsroom.'],
}

/** Work out the title and share details for an address (without its language prefix). */
export function metaFor(pathname: string, search = ''): PageMeta {
  const page = (heading: string, description = DEFAULT_DESCRIPTION, image = DEFAULT_IMAGE, type: PageMeta['type'] = 'website'): PageMeta => ({ title: `${heading} | ${SITE}`, description, image, type, heading })
  if (pathname === '/') return { title: `${SITE}: ${TAGLINE}`, description: DEFAULT_DESCRIPTION, image: DEFAULT_IMAGE, type: 'website', heading: 'Front page' }

  const [, first, second, third] = pathname.split('/')
  if (first === 'story') {
    const { story } = resolveStory(second)
    return story ? page(story.h, story.st, storyMedia(story.id)?.src ?? DEFAULT_IMAGE, 'article') : page('Story not found')
  }
  if (first === 'offers' && second) {
    const found = findOffer(second, third)
    if (found) return page(`${found.offer.title}, from ${found.advertiser.name}`, `Advertiser offer: ${found.offer.detail}`, found.offer.image.src)
    const cat = OFFER_CATEGORIES.find((c) => c.id === second)
    if (cat) return page(`${cat.name} offers`, `${cat.blurb} Advertising, kept apart from the newsroom.`)
  }
  if (first === 'search') {
    const q = new URLSearchParams(search).get('q')
    if (q) return page(`“${q}”: search results`, `MirrorActu stories, videos and dates matching “${q}”.`)
  }
  if (first === 'newsletter') return page(second === 'unsubscribe' ? 'Unsubscribe from the morning email' : 'Your morning email', 'Confirm or stop the MirrorActu morning email.')
  const fixed = STATIC[`/${first}`]
  if (fixed && !second) return page(fixed[0], fixed[1])
  const section = getCategory(first)
  if (section && !second) return page(`${section.name} news`, section.blurb)
  return page('Page not found')
}

function setTag(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}
const metaName = (name: string, content: string) => setTag(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }), 'content', content)
const metaProp = (property: string, content: string) =>
  setTag(`meta[property="${property}"]`, () => {
    const m = document.createElement('meta')
    m.setAttribute('property', property)
    return m
  }, 'content', content)

/** Keep the document head in step with the current route. Call once, in the layout. */
export function usePageMeta() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    const m = metaFor(pathname, search)
    const url = location.origin + localePath(document.documentElement.lang === 'en' ? 'en' : document.documentElement.lang, pathname)
    const image = location.origin + m.image
    document.title = m.title
    metaName('description', m.description)
    metaProp('og:site_name', SITE)
    metaProp('og:type', m.type)
    metaProp('og:title', m.title)
    metaProp('og:description', m.description)
    metaProp('og:url', url)
    metaProp('og:image', image)
    metaName('twitter:card', 'summary_large_image')
    metaName('twitter:title', m.title)
    metaName('twitter:description', m.description)
    metaName('twitter:image', image)
  }, [pathname, search])
}
