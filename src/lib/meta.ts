/**
 * Page titles and share details, kept in step with the route. Each page gets its own browser
 * tab title, description, and the tags social networks and messaging apps read when a link is
 * shared (Open Graph and Twitter cards).
 *
 * In production the same details are already in the page when it arrives (the web server asks
 * the API for them: server/src/seo.ts), so search engines and messaging apps see them without
 * running any script. This file keeps them right as a reader moves from page to page.
 */
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { getCategory, resolveStory } from '@/data'
import { getCountry } from '@/data/geo'
import { storyMedia } from '@/data/media'
import { OFFER_CATEGORIES, findOffer } from '@/data/offers'
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, HOME_KEYWORDS, HOME_TITLE, NOT_FOUND, SECTION_SEO, SITE_KEYWORDS, SITE_NAME, STATIC_PAGES, clip, keywordList, withSite } from '@/data/seo'

const SITE = SITE_NAME

export type PageMeta = { title: string; description: string; image: string; type: 'website' | 'article'; heading: string; keywords: string[]; noindex?: boolean }

/**
 * Work out the title, description and keywords for an address (without its language prefix).
 * The wording for fixed pages and sections is in src/data/seo.ts, shared with the API, which
 * writes the same details into the page before it is sent (server/src/seo.ts).
 */
export function metaFor(pathname: string, search = ''): PageMeta {
  const page = (heading: string, description = DEFAULT_DESCRIPTION, image = DEFAULT_IMAGE, type: PageMeta['type'] = 'website', keywords: string[] = [], noindex = false): PageMeta => ({ title: withSite(heading), description, image, type, heading, keywords, noindex })
  if (pathname === '/') return { title: HOME_TITLE, description: DEFAULT_DESCRIPTION, image: DEFAULT_IMAGE, type: 'website', heading: 'Front page', keywords: HOME_KEYWORDS }

  const [, first, second, third] = pathname.split('/')
  if (first === 'story') {
    const { story } = resolveStory(second)
    if (!story) return page('Story not found', NOT_FOUND.description, DEFAULT_IMAGE, 'website', [], true)
    const places = ((story as { countries?: string[] }).countries ?? []).map((c) => getCountry(c).name).filter((n) => n !== 'International')
    return page(story.h, clip(`${story.st} ${story.what}`), storyMedia(story.id)?.src ?? DEFAULT_IMAGE, 'article', [story.sub, ...(story.tags ?? '').split(/\s+/), ...places, ...story.cats.map((c) => `${c.charAt(0).toUpperCase()}${c.slice(1)} news`)].filter((t) => t && t.length > 1))
  }
  if (first === 'offers' && second) {
    const found = findOffer(second, third)
    if (found) return page(`${found.offer.title}, from ${found.advertiser.name}`, clip(`Advertiser offer from ${found.advertiser.name}: ${found.offer.detail} ${found.offer.about}`), found.offer.image.src, 'website', [found.offer.title, found.advertiser.name])
    const cat = OFFER_CATEGORIES.find((c) => c.id === second)
    if (cat && !third) return page(`${cat.name} offers from our advertisers`, `${cat.blurb} Advertising, clearly labelled and kept apart from the newsroom.`, DEFAULT_IMAGE, 'website', [`${cat.name.toLowerCase()} offers`, `${cat.name.toLowerCase()} deals`])
    return page(NOT_FOUND.title, NOT_FOUND.description, DEFAULT_IMAGE, 'website', [], true)
  }
  if (first === 'search') {
    const q = new URLSearchParams(search).get('q')
    if (q) return page(`“${q}”: search results`, `MirrorActu stories, videos and dates matching “${q}”.`, DEFAULT_IMAGE, 'website', [], true)
  }
  if (first === 'newsletter') return page(second === 'unsubscribe' ? 'Unsubscribe from the morning email' : 'Your morning email', 'Confirm or stop the MirrorActu morning email.', DEFAULT_IMAGE, 'website', [], true)
  const fixed = STATIC_PAGES[`/${first}`]
  if (fixed && !second) return page(fixed.title, fixed.description, DEFAULT_IMAGE, 'website', fixed.keywords, fixed.noindex)
  const section = getCategory(first)
  if (section && !second) {
    const seo = SECTION_SEO[section.id]
    return page(seo?.title ?? `${section.name} news today`, seo?.description ?? section.blurb, DEFAULT_IMAGE, 'website', seo?.keywords ?? [`${section.name} news`])
  }
  return page(NOT_FOUND.title, NOT_FOUND.description, DEFAULT_IMAGE, 'website', [], true)
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
  const first = useRef(pathname + search)
  useEffect(() => {
    const m = metaFor(pathname, search)
    // Shared links point at the English address: it is the one every reader and crawler can open as written.
    const url = location.origin + pathname
    const image = location.origin + m.image
    // Structured data and article tags written for the page that was first loaded do not describe this one.
    if (first.current !== pathname + search) document.head.querySelectorAll('script[data-seo], meta[property^="article:"], meta[name="news_keywords"], meta[property="og:image:width"], meta[property="og:image:height"], meta[property="og:image:alt"], meta[name="twitter:image:alt"]').forEach((el) => el.remove())
    document.title = m.title
    metaName('description', m.description)
    metaName('keywords', keywordList(m.keywords, SITE_KEYWORDS))
    metaName('robots', m.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
    metaProp('og:site_name', SITE)
    metaProp('og:type', m.type)
    metaProp('og:title', m.heading === 'Front page' ? m.title : m.heading)
    metaProp('og:description', m.description)
    metaProp('og:url', url)
    metaProp('og:image', image)
    metaName('twitter:card', 'summary_large_image')
    metaName('twitter:title', m.heading === 'Front page' ? m.title : m.heading)
    metaName('twitter:description', m.description)
    metaName('twitter:image', image)
  }, [pathname, search])
}
