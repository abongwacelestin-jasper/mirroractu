/**
 * Search engines and link previews.
 *
 * The website is drawn in the browser, but crawlers for search, chat apps and social networks
 * mostly read the page as it arrives. So the web server asks this file for two fragments for
 * every page it serves and stitches them in (see deploy/nginx.site.conf.template):
 *   head  the title, description, keywords, canonical address, share tags and structured data
 *   body  the page's content as plain HTML inside <noscript>, for anything that runs no script
 * It also writes robots.txt, the sitemaps and the RSS feed.
 *
 * Everything said here is taken from the story or page itself. Offers are adverts with
 * placeholder prices, so they get titles and descriptions but no price markup.
 */
import { getCountry } from '../../src/data/geo'
import { MEDIA_LIST } from '../../src/data/media.generated'
import { ADVERTISERS, OFFER_CATEGORIES } from '../../src/data/offers'
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, HOME_KEYWORDS, HOME_TITLE, NOT_FOUND, PUBLISHER, PageSeo, SECTION_SEO, SITE_KEYWORDS, SITE_NAME, STATIC_PAGES, TAGLINE, clip, keywordList, stripLocale, withSite } from '../../src/data/seo'
import { cached } from './cache'
import { one, q } from './db'
import { siteUrl } from './mail/send'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const xml = (s: unknown) => esc(s).replace(/'/g, '&apos;')
/** JSON that is safe inside a <script> tag. */
const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '')
const abs = (path: string) => (/^https?:/.test(path) ? path : siteUrl() + path)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type StoryRow = { id: string; slug: string; data: any; version: number; updated_at: Date; story_date: string }
type Category = { id: string; name: string; blurb: string }
type Crumb = [name: string, path: string]
type Link = { h: string; url: string; note?: string }
type Page = {
  seo: PageSeo
  path: string
  type: 'website' | 'article'
  image: { url: string; alt: string; width?: number; height?: number }
  crumbs: Crumb[]
  jsonld: object[]
  article?: { published: string; modified: string; section: string; tags: string[] }
  /** Plain content for <noscript>: a heading, paragraphs, and links */
  content: { h1: string; lead?: string; paras?: [label: string, text: string][]; lists?: [label: string, items: string[]][]; links?: [label: string, items: Link[]][] }
}

const published = (r: StoryRow) => String(r.data.d ?? r.story_date).slice(0, 10)
/** The day a story was last edited. An untouched story has only its publication date. */
const modified = (r: StoryRow) => (r.version > 1 ? new Date(r.updated_at).toISOString() : published(r))
const storyUrl = (r: { slug: string }) => `/story/${r.slug}`
const storyImage = (r: StoryRow) => MEDIA_LIST[r.id] ?? null
const storyTags = (r: StoryRow): string[] => [
  ...new Set(
    [r.data.sub, ...String(r.data.tags ?? '').split(/\s+/), ...(r.data.countries ?? []).map((c: string) => getCountry(c).name).filter((n: string) => n !== 'International'), ...(r.data.cats ?? []).map((c: string) => `${cap(c)} news`)]
      .map((t) => String(t ?? '').trim())
      .filter((t) => t.length > 1)
  ),
]

const organization = () => ({
  '@type': 'NewsMediaOrganization',
  '@id': `${siteUrl()}/#organization`,
  name: SITE_NAME,
  url: siteUrl(),
  slogan: TAGLINE,
  description: DEFAULT_DESCRIPTION,
  logo: { '@type': 'ImageObject', url: abs('/icons/icon-512.png'), width: 512, height: 512 },
  parentOrganization: { '@type': 'Organization', name: PUBLISHER },
  publishingPrinciples: abs('/how-we-work'),
  correctionsPolicy: abs('/how-we-work'),
  ethicsPolicy: abs('/how-we-work'),
})
const breadcrumbs = (crumbs: Crumb[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
})
const itemList = (rows: StoryRow[]) => ({
  '@type': 'ItemList',
  itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(storyUrl(r)), name: r.data.h })),
})
const storyLinks = (rows: StoryRow[]): Link[] => rows.map((r) => ({ h: r.data.h, url: storyUrl(r), note: r.data.st }))

async function categories(): Promise<Category[]> {
  return ((await one<{ data: Category[] }>("SELECT data FROM content WHERE key = 'categories'"))?.data ?? []) as Category[]
}
const stories = (where = '', params: unknown[] = [], limit = 200) =>
  q<StoryRow>(`SELECT id, slug, data, version, updated_at, to_char(story_date, 'YYYY-MM-DD') AS story_date FROM stories WHERE published ${where} ORDER BY story_date DESC, CASE tier WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id LIMIT ${limit}`, params)

const defaultImage = () => ({ url: abs(DEFAULT_IMAGE), alt: `${SITE_NAME}: ${TAGLINE}`, width: 1200, height: 630 })
const webPage = (seo: PageSeo, path: string, extra: object = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: seo.title,
  description: seo.description,
  url: abs(path),
  inLanguage: 'en',
  isPartOf: { '@id': `${siteUrl()}/#website` },
  publisher: { '@id': `${siteUrl()}/#organization` },
  ...extra,
})

/** Work out everything about one address. `raw` may carry a language prefix. */
async function describe(raw: string): Promise<Page> {
  const { path: stripped } = stripLocale(raw.split('?')[0] || '/')
  const path = stripped.length > 1 ? stripped.replace(/\/+$/, '') : '/'
  const [, first, second, third] = path.split('/')
  const cats = await categories()
  const sectionLinks: Link[] = cats.map((c) => ({ h: `${c.name} news`, url: `/${c.id}`, note: c.blurb }))
  const base = { path, type: 'website' as const, image: defaultImage() }
  const notFound = (): Page => ({ ...base, seo: NOT_FOUND, crumbs: [], jsonld: [], content: { h1: 'Page not found', lead: 'There is no page at this address.', links: [['Sections', sectionLinks]] } })

  /* Front page */
  if (path === '/') {
    const latest = await stories('', [], 12)
    const seo: PageSeo = { title: HOME_TITLE, description: DEFAULT_DESCRIPTION, keywords: HOME_KEYWORDS }
    return {
      ...base,
      seo,
      crumbs: [],
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@graph': [
            organization(),
            {
              '@type': 'WebSite',
              '@id': `${siteUrl()}/#website`,
              name: SITE_NAME,
              alternateName: PUBLISHER,
              url: siteUrl(),
              description: DEFAULT_DESCRIPTION,
              inLanguage: 'en',
              publisher: { '@id': `${siteUrl()}/#organization` },
              potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl()}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
            },
            { ...itemList(latest), name: 'Latest stories' },
          ],
        },
      ],
      content: { h1: `${SITE_NAME}: Africa and world news, verified and live`, lead: DEFAULT_DESCRIPTION, links: [['Latest stories', storyLinks(latest)], ['Sections', sectionLinks], ['More', [{ h: 'Trending news today', url: '/trends' }, { h: 'The Brief: today’s news in two minutes', url: '/brief' }, { h: 'Live news wire, scores and markets', url: '/live' }, { h: 'Coming up', url: '/coming-up' }, { h: 'How we work', url: '/how-we-work' }]]] },
    }
  }

  /* A story */
  if (first === 'story' && second && !third) {
    const [r] = await stories('AND (slug = $1 OR id = $1)', [second], 1)
    if (!r) return notFound()
    const d = r.data
    const cat = cats.find((c) => c.id === d.cats?.[0])
    const media = storyImage(r)
    const tags = storyTags(r)
    const related = (await stories('AND cats && $1 AND id <> $2', [d.cats ?? [], r.id], 6)) as StoryRow[]
    const url = storyUrl(r)
    const crumbs: Crumb[] = [['Home', '/'], ...(cat ? ([[`${cat.name} news`, `/${cat.id}`]] as Crumb[]) : []), [d.h, url]]
    return {
      path: url,
      type: 'article',
      seo: { title: d.h, description: clip(`${d.st} ${d.what}`), keywords: tags },
      image: media ? { url: abs(media.src), alt: media.alt } : defaultImage(),
      crumbs,
      article: { published: published(r), modified: modified(r), section: cat?.name ?? 'News', tags },
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          '@id': `${abs(url)}#article`,
          mainEntityOfPage: { '@type': 'WebPage', '@id': abs(url) },
          headline: clip(d.h, 110),
          alternativeHeadline: clip(d.st, 200),
          description: clip(`${d.st} ${d.what}`, 300),
          articleBody: [d.what, `Why it matters: ${d.why}`, `What we know: ${(d.ok ?? []).join(' ')}`, (d.un ?? []).length ? `What we do not know yet: ${d.un.join(' ')}` : ''].filter(Boolean).join('\n\n'),
          image: media ? [abs(media.src)] : [abs(DEFAULT_IMAGE)],
          datePublished: published(r),
          dateModified: modified(r),
          articleSection: cat?.name ?? 'News',
          keywords: tags.join(', '),
          inLanguage: 'en',
          isAccessibleForFree: true,
          author: { '@type': 'Organization', name: `${SITE_NAME} ${d.desk ?? 'newsroom'}`, url: abs('/how-we-work') },
          publisher: organization(),
          ...((d.countries ?? []).length ? { about: d.countries.map((c: string) => ({ '@type': 'Country', name: getCountry(c).name })) } : {}),
          ...((d.src ?? []).some((s: string[]) => s[2]) ? { isBasedOn: d.src.filter((s: string[]) => s[2]).map((s: string[]) => s[2]) } : {}),
        },
        breadcrumbs(crumbs),
      ],
      content: {
        h1: d.h,
        lead: d.st,
        paras: [['What happened', d.what], ['Why it matters', d.why]],
        lists: [['What we know', d.ok ?? []], ['What we do not know yet', d.un ?? []], ['Sources', (d.src ?? []).map((s: string[]) => `${s[0]}: ${s[1]}`)]],
        links: [[`More ${cat?.name ?? ''} news`.replace('  ', ' '), storyLinks(related)], ['Sections', sectionLinks]],
      },
    }
  }

  /* Offers: advertising */
  if (first === 'offers') {
    const all = ADVERTISERS.flatMap((a) => a.offers.map((o) => ({ a, o })))
    if (!second) {
      const seo = STATIC_PAGES['/offers']
      return { ...base, seo, crumbs: [['Home', '/'], ['Offers', '/offers']], jsonld: [webPage(seo, path), breadcrumbs([['Home', '/'], ['Offers', '/offers']])], content: { h1: seo.title, lead: seo.description, links: [['Categories', OFFER_CATEGORIES.map((c) => ({ h: `${c.name} offers`, url: `/offers/${c.id}`, note: c.blurb }))], ['Offers (advertising)', all.map(({ a, o }) => ({ h: `${o.title}, from ${a.name}`, url: `/offers/${a.category}/${o.id}`, note: o.detail }))]] } }
    }
    const category = OFFER_CATEGORIES.find((c) => c.id === second)
    if (!category) return notFound()
    const inCat = all.filter((x) => x.a.category === category.id)
    if (!third) {
      const seo: PageSeo = { title: `${category.name} offers from our advertisers`, description: clip(`${category.blurb} ${inCat.map((x) => x.o.title).join(', ')}. Advertising, clearly labelled and kept apart from the newsroom.`), keywords: [`${category.name.toLowerCase()} offers`, `${category.name.toLowerCase()} deals`, ...inCat.map((x) => x.o.title), ...new Set(inCat.map((x) => x.a.name))] }
      const crumbs: Crumb[] = [['Home', '/'], ['Offers', '/offers'], [category.name, path]]
      return { ...base, seo, crumbs, jsonld: [webPage(seo, path), breadcrumbs(crumbs)], content: { h1: seo.title, lead: seo.description, links: [[`${category.name} (advertising)`, inCat.map(({ a, o }) => ({ h: `${o.title}, from ${a.name}`, url: `/offers/${a.category}/${o.id}`, note: o.detail }))]] } }
    }
    const found = inCat.find((x) => x.o.id === third)
    if (!found) return notFound()
    const seo: PageSeo = { title: `${found.o.title}, from ${found.a.name}`, description: clip(`Advertiser offer from ${found.a.name}: ${found.o.detail} ${found.o.about}`), keywords: [found.o.title, found.a.name, `${category.name.toLowerCase()} offers`, ...found.o.facts.map((f) => f[1]).filter((v) => v.length < 30)] }
    const crumbs: Crumb[] = [['Home', '/'], ['Offers', '/offers'], [category.name, `/offers/${category.id}`], [found.o.title, path]]
    return { ...base, seo, image: { url: abs(found.o.image.src), alt: found.o.image.alt }, crumbs, jsonld: [webPage(seo, path), breadcrumbs(crumbs)], content: { h1: seo.title, lead: `Advertisement. ${found.o.detail}`, paras: [['About this offer', found.o.about], ['Conditions', found.o.terms]], lists: [['Included', found.o.includes], ['Good to know', found.o.goodToKnow]] } }
  }

  /* Pages that are private to a reader or that repeat other pages */
  if (first === 'newsletter') return { ...base, seo: { title: 'Your morning email', description: 'Confirm or stop the MirrorActu morning email.', keywords: [], noindex: true }, crumbs: [], jsonld: [], content: { h1: 'Your morning email' } }
  if (first === 'search' && !second) {
    const seo = { ...STATIC_PAGES['/search'], noindex: raw.includes('?') }
    return { ...base, seo, crumbs: [['Home', '/'], ['Search', '/search']], jsonld: [], content: { h1: seo.title, lead: seo.description, links: [['Sections', sectionLinks]] } }
  }

  /* Fixed pages */
  const fixed = STATIC_PAGES[`/${first}`]
  if (fixed && !second) {
    const crumbs: Crumb[] = [['Home', '/'], [fixed.title.split(':')[0], path]]
    const latest = ['trends', 'brief', 'live', 'coming-up'].includes(first) ? await stories('', [], 8) : []
    return { ...base, seo: fixed, crumbs, jsonld: fixed.noindex ? [] : [webPage(fixed, path, latest.length ? { mainEntity: itemList(latest) } : first === 'how-we-work' ? { about: { '@id': `${siteUrl()}/#organization` } } : {}), breadcrumbs(crumbs)], content: { h1: fixed.title, lead: fixed.description, links: [...(latest.length ? ([['Stories we are following', storyLinks(latest)]] as [string, Link[]][]) : []), ['Sections', sectionLinks]] } }
  }

  /* A section */
  const section = cats.find((c) => c.id === first)
  if (section && !second) {
    const rows = await stories('AND $1 = ANY(cats)', [section.id], 30)
    const seo: PageSeo = SECTION_SEO[section.id] ?? { title: `${section.name} news today`, description: section.blurb, keywords: [`${section.name} news`] }
    const topical = [...new Set(rows.flatMap((r) => [r.data.sub, ...(r.data.countries ?? []).map((c: string) => getCountry(c).name)]).filter((t) => t && t !== 'International'))].slice(0, 14) as string[]
    const crumbs: Crumb[] = [['Home', '/'], [`${section.name} news`, path]]
    return {
      ...base,
      seo: { ...seo, keywords: [...seo.keywords, ...topical] },
      image: rows[0] && storyImage(rows[0]) ? { url: abs(storyImage(rows[0])!.src), alt: storyImage(rows[0])!.alt } : defaultImage(),
      crumbs,
      jsonld: [{ ...webPage(seo, path), '@type': 'CollectionPage', mainEntity: itemList(rows) }, breadcrumbs(crumbs)],
      content: { h1: seo.title, lead: seo.description, links: [[`Latest ${section.name} stories`, storyLinks(rows)], ['Other sections', sectionLinks.filter((l) => l.url !== path)]] },
    }
  }
  return notFound()
}

const page = (raw: string) => {
  const key = raw.split('?')[0].toLowerCase().slice(0, 300) + (raw.includes('?') ? '?' : '')
  return cached('content', `seo:${key}`, 120, () => describe(raw))
}

/** The tags for <head>. */
export async function headHtml(raw: string): Promise<string> {
  const p = await page(raw)
  const title = p.path === '/' ? p.seo.title : withSite(p.seo.title)
  const url = abs(p.path)
  const keywords = keywordList(p.seo.keywords, p.path === '/' ? [] : [], SITE_KEYWORDS)
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(p.seo.description)}" />`,
    `<meta name="keywords" content="${esc(keywords)}" />`,
    p.article ? `<meta name="news_keywords" content="${esc(p.article.tags.slice(0, 10).join(', '))}" />` : '',
    `<meta name="robots" content="${p.seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}" />`,
    `<meta name="author" content="${esc(SITE_NAME)}" />`,
    `<meta name="publisher" content="${esc(PUBLISHER)}" />`,
    // The English address is the one to index: translated addresses show the same text until the reader's browser translates it.
    p.seo.noindex ? '' : `<link rel="canonical" href="${esc(url)}" data-locale />`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}: latest stories" href="${esc(abs('/feed.xml'))}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta property="og:type" content="${p.type}" />`,
    `<meta property="og:title" content="${esc(p.seo.title)}" />`,
    `<meta property="og:description" content="${esc(p.seo.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(p.image.url)}" />`,
    p.image.width ? `<meta property="og:image:width" content="${p.image.width}" /><meta property="og:image:height" content="${p.image.height}" />` : '',
    `<meta property="og:image:alt" content="${esc(p.image.alt)}" />`,
    ...(p.article
      ? [
          `<meta property="article:published_time" content="${esc(p.article.published)}" />`,
          `<meta property="article:modified_time" content="${esc(p.article.modified)}" />`,
          `<meta property="article:section" content="${esc(p.article.section)}" />`,
          `<meta property="article:publisher" content="${esc(siteUrl())}" />`,
          ...p.article.tags.slice(0, 8).map((t) => `<meta property="article:tag" content="${esc(t)}" />`),
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(p.seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.seo.description)}" />`,
    `<meta name="twitter:image" content="${esc(p.image.url)}" />`,
    `<meta name="twitter:image:alt" content="${esc(p.image.alt)}" />`,
    ...p.jsonld.map((j) => `<script type="application/ld+json" data-seo>${json(j)}</script>`),
  ]
  return tags.filter(Boolean).join('\n    ')
}

/** The page's content as plain HTML, shown only where scripts do not run. */
export async function bodyHtml(raw: string): Promise<string> {
  const p = await page(raw)
  const c = p.content
  const a = (l: Link) => `<li><a href="${esc(l.url)}">${esc(l.h)}</a>${l.note ? `: ${esc(l.note)}` : ''}</li>`
  return [
    '<noscript>',
    '<div style="max-width:760px;margin:0 auto;padding:32px 20px;background:#fff;color:#0e1424;font:17px/1.6 system-ui,sans-serif">',
    `<p><a href="/"><strong>${esc(SITE_NAME)}</strong></a>: ${esc(TAGLINE)}</p>`,
    p.crumbs.length > 1 ? `<nav aria-label="Breadcrumb"><p>${p.crumbs.map(([name, path], i) => (i === p.crumbs.length - 1 ? esc(name) : `<a href="${esc(path)}">${esc(name)}</a>`)).join(' › ')}</p></nav>` : '',
    p.article ? '<article>' : '<main>',
    `<h1>${esc(c.h1)}</h1>`,
    c.lead ? `<p><strong>${esc(c.lead)}</strong></p>` : '',
    p.article ? `<p><time datetime="${esc(p.article.published)}">${esc(p.article.published)}</time> · ${esc(p.article.section)}</p>` : '',
    p.type === 'article' && p.image.url !== abs(DEFAULT_IMAGE) ? `<p><img src="${esc(p.image.url)}" alt="${esc(p.image.alt)}" style="max-width:100%;height:auto" loading="lazy" /></p>` : '',
    ...(c.paras ?? []).map(([label, text]) => `<h2>${esc(label)}</h2><p>${esc(text)}</p>`),
    ...(c.lists ?? []).filter(([, items]) => items.length).map(([label, items]) => `<h2>${esc(label)}</h2><ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`),
    p.article ? '</article>' : '</main>',
    ...(c.links ?? []).filter(([, items]) => items.length).map(([label, items]) => `<nav aria-label="${esc(label)}"><h2>${esc(label)}</h2><ul>${items.map(a).join('')}</ul></nav>`),
    '<p>The full site, with live updates, video and search, needs JavaScript turned on.</p>',
    '</div>',
    '</noscript>',
  ]
    .filter(Boolean)
    .join('\n')
}

/* ---------- robots.txt, sitemaps, feed ---------- */

export function robotsTxt() {
  return [
    '# MirrorActu. News pages are open to every search engine.',
    'User-agent: *',
    'Allow: /',
    '# Not pages: the API, and pages private to one reader.',
    'Disallow: /api/',
    'Disallow: /saved',
    'Disallow: /newsletter/',
    'Disallow: /search?',
    '',
    `Sitemap: ${abs('/sitemap.xml')}`,
    `Sitemap: ${abs('/news-sitemap.xml')}`,
    '',
  ].join('\n')
}

export const sitemap = () =>
  cached('content', 'seo:sitemap', 300, async () => {
    const rows = await stories('', [], 5000)
    const cats = await categories()
    const newest = rows[0] ? published(rows[0]) : undefined
    const url = (path: string, lastmod?: string, image?: { src: string; alt: string } | null) =>
      `  <url><loc>${xml(abs(path))}</loc>${lastmod ? `<lastmod>${xml(lastmod)}</lastmod>` : ''}${image ? `<image:image><image:loc>${xml(abs(image.src))}</image:loc></image:image>` : ''}</url>`
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      url('/', newest),
      ...cats.map((c) => url(`/${c.id}`, rows.find((r) => (r.data.cats ?? []).includes(c.id)) ? published(rows.find((r) => (r.data.cats ?? []).includes(c.id))!) : undefined)),
      ...Object.entries(STATIC_PAGES).filter(([p, s]) => !s.noindex && p !== '/search').map(([p]) => url(p, ['/trends', '/brief', '/live', '/coming-up'].includes(p) ? newest : undefined)),
      ...OFFER_CATEGORIES.map((c) => url(`/offers/${c.id}`)),
      ...ADVERTISERS.flatMap((a) => a.offers.map((o) => url(`/offers/${a.category}/${o.id}`, undefined, o.image))),
      ...rows.map((r) => url(storyUrl(r), modified(r), storyImage(r))),
      '</urlset>',
      '',
    ].join('\n')
  })

/** Google News reads this one: only stories from the last two days, as it asks. */
export const newsSitemap = () =>
  cached('content', 'seo:news-sitemap', 300, async () => {
    const rows = await stories("AND story_date >= current_date - 2", [], 1000)
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
      ...rows.map((r) => `  <url><loc>${xml(abs(storyUrl(r)))}</loc><news:news><news:publication><news:name>${xml(SITE_NAME)}</news:name><news:language>en</news:language></news:publication><news:publication_date>${xml(published(r))}</news:publication_date><news:title>${xml(r.data.h)}</news:title></news:news></url>`),
      '</urlset>',
      '',
    ].join('\n')
  })

export const feed = () =>
  cached('content', 'seo:feed', 300, async () => {
    const rows = await stories('', [], 40)
    const date = (r: StoryRow) => new Date(`${published(r)}T00:00:00Z`).toUTCString()
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '<channel>',
      `<title>${xml(SITE_NAME)}: latest stories</title>`,
      `<link>${xml(siteUrl())}</link>`,
      `<description>${xml(DEFAULT_DESCRIPTION)}</description>`,
      '<language>en</language>',
      `<atom:link href="${xml(abs('/feed.xml'))}" rel="self" type="application/rss+xml" />`,
      rows[0] ? `<lastBuildDate>${date(rows[0])}</lastBuildDate>` : '',
      ...rows.map((r) => `<item><title>${xml(r.data.h)}</title><link>${xml(abs(storyUrl(r)))}</link><guid isPermaLink="true">${xml(abs(storyUrl(r)))}</guid><pubDate>${date(r)}</pubDate>${(r.data.cats ?? []).map((c: string) => `<category>${xml(cap(c))}</category>`).join('')}<description>${xml(`${r.data.st} ${r.data.what}`)}</description></item>`),
      '</channel>',
      '</rss>',
      '',
    ].join('\n')
  })
