/**
 * Search-engine and link-preview details for every kind of page: titles, descriptions and
 * keywords. Shared by the website (src/lib/meta.ts) and the API (server/src/seo.ts), which
 * writes the same details into the page before it is sent, so search engines and messaging
 * apps see them without running any JavaScript. This file imports nothing.
 *
 * Writing rules: a title says what the page is in the words people search with, in about 60
 * characters. A description is one or two honest sentences, about 150 characters. Keywords
 * are phrases the page is genuinely about; nothing is listed that the page does not deliver.
 */
export const SITE_NAME = 'MirrorActu'
export const PUBLISHER = 'TheGoodMorningDewPub'
export const TAGLINE = 'Today, reflected. Tomorrow, remembered.'
export const HOME_TITLE = 'MirrorActu: Africa and world news, verified and live'
export const DEFAULT_DESCRIPTION =
  'News from Africa and the world that shows its work: what happened, what is confirmed, what is still unknown and where it came from. Live updates, daily trends and a two-minute brief.'
export const DEFAULT_IMAGE = '/brand/share.png'

/** On every page, after the page's own keywords. */
export const SITE_KEYWORDS = ['MirrorActu', 'news', 'Africa news', 'world news', 'breaking news', 'verified news', 'fact-checked news', 'live news updates', 'news today']

export const HOME_KEYWORDS = [
  'Africa news today', 'world news today', 'latest news', 'breaking news Africa', 'East Africa news', 'Rwanda news', 'Kenya news', 'Nigeria news', 'South Africa news',
  'news with sources', 'what is confirmed', 'trusted news', 'independent news', 'news headlines', 'top stories', 'today’s trends', 'live news', 'daily news brief', 'morning newsletter',
]

/** Language prefixes an address may carry (/en, /fr, /sw …). Translation happens in the reader's browser, so the address without a prefix is the one search engines should index. */
export const LOCALES = ['en', 'fr', 'rw', 'sw', 'ar', 'am', 'ha', 'yo', 'ig', 'zu', 'xh', 'af', 'sn', 'lg', 'ln', 'om', 'ak', 'pt', 'es', 'de', 'tr', 'hi', 'zh-CN', 'ja', 'ko', 'mi']

export type PageSeo = { title: string; description: string; keywords: string[]; /** Keep out of search results (private or duplicate pages) */ noindex?: boolean }

export const STATIC_PAGES: Record<string, PageSeo> = {
  '/trends': {
    title: 'Trending news today: by country, region and worldwide',
    description: 'What is trending in the news today where you are, across your region and around the world, ranked by coverage, live wire activity and what readers are opening.',
    keywords: ['trending news', 'trending today', 'news trends', 'what is trending', 'trending in Africa', 'trending in Rwanda', 'trending in Kenya', 'trending topics', 'top news topics', 'most read news', 'viral news today'],
  },
  '/brief': {
    title: 'The Brief: today’s news in two minutes',
    description: 'Eight stories, each in two lines: what happened and why it matters. The fastest way to catch up on today’s news from Africa and the world.',
    keywords: ['news brief', 'daily news summary', 'news in two minutes', 'today’s headlines', 'quick news', 'news roundup', 'morning briefing', 'news digest', 'top stories today'],
  },
  '/coming-up': {
    title: 'Coming up: news dates, summits, votes and fixtures',
    description: 'The dates worth knowing this week and next: elections, summits, court rulings, launches and fixtures, each linked to the story we are following.',
    keywords: ['news calendar', 'upcoming events', 'what is happening this week', 'election dates', 'summit dates', 'key dates', 'news agenda', 'fixtures this week', 'week ahead'],
  },
  '/live': {
    title: 'Live: news wire, scores, markets and climate data',
    description: 'Live news updates as they are filed, with football and basketball scores, market prices and climate figures. Every number shows its source and its age.',
    keywords: ['live news', 'live updates', 'news wire', 'live blog', 'live scores', 'Premier League table', 'NBA scores', 'oil price today', 'gold price today', 'market data', 'climate data', 'breaking news live'],
  },
  '/how-we-work': {
    title: 'How we work: sources, corrections and editorial standards',
    description: 'How MirrorActu decides what to publish, credits every source, labels what is not yet known, separates advertising from news and corrects its mistakes in the open.',
    keywords: ['editorial standards', 'editorial policy', 'corrections policy', 'news sources', 'fact checking', 'media ethics', 'how news is verified', 'journalism standards', 'advertising policy', 'trust in news'],
  },
  '/legal': {
    title: 'Legal, privacy and contact',
    description: 'Privacy, cookies, terms of use, your data rights, picture credits and how to contact MirrorActu.',
    keywords: ['privacy policy', 'cookie policy', 'terms of use', 'contact MirrorActu', 'data rights', 'picture credits'],
  },
  '/offers': {
    title: 'Offers: flights, stays, events and banking from our advertisers',
    description: 'Fares, stays, events and services from MirrorActu’s advertisers, with prices in your currency. Advertising, clearly labelled and kept apart from the newsroom.',
    keywords: ['flight deals', 'cheap flights from Kigali', 'Kigali to Nairobi flights', 'East Africa flights', 'hotel deals', 'lodge stays', 'events in Kigali', 'business banking', 'travel offers', 'airline fares'],
  },
  '/search': {
    title: 'Search MirrorActu: stories, videos, photos and dates',
    description: 'Search MirrorActu stories, videos, photos, topics and dates.',
    keywords: ['search news', 'find a story', 'news archive'],
  },
  '/saved': { title: 'Saved stories', description: 'Stories you have saved on this device.', keywords: [], noindex: true },
}

/** Sections: a searchable title, a fuller description than the on-page blurb, and what the desk covers. */
export const SECTION_SEO: Record<string, PageSeo> = {
  world: {
    title: 'World news today: elections, diplomacy and global affairs',
    description: 'World news with its sources shown: elections, diplomacy, conflict and the decisions that cross borders. What is confirmed, what is not, and why it matters.',
    keywords: ['world news', 'international news', 'global news', 'world news today', 'elections', 'diplomacy', 'United Nations', 'foreign affairs', 'geopolitics', 'world headlines'],
  },
  africa: {
    title: 'Africa news today: politics, trade and daily life',
    description: 'Africa news from across the continent: politics, trade, elections and daily life in Rwanda, Kenya, Nigeria, South Africa, Egypt and beyond, with every source credited.',
    keywords: ['Africa news', 'African news today', 'East Africa news', 'West Africa news', 'Southern Africa news', 'Rwanda news', 'Kenya news', 'Nigeria news', 'South Africa news', 'Egypt news', 'Sudan news', 'African Union', 'AGOA', 'African politics', 'African economy'],
  },
  business: {
    title: 'Business news today: markets, companies and prices',
    description: 'Business and economy news: markets, companies, trade, oil and the cost of living, with the figures and where they come from.',
    keywords: ['business news', 'economy news', 'markets today', 'stock market news', 'oil price', 'gold price', 'trade news', 'African business', 'company news', 'cost of living', 'inflation', 'finance news'],
  },
  tech: {
    title: 'Tech news today: AI, platforms and the systems behind them',
    description: 'Technology news: artificial intelligence, big tech, regulation, space and cyber fraud. What was announced, what is confirmed and what it changes.',
    keywords: ['tech news', 'technology news', 'AI news', 'artificial intelligence', 'OpenAI', 'big tech', 'AI regulation', 'EU AI Act', 'data centres', 'space launch', 'cyber fraud', 'startups'],
  },
  climate: {
    title: 'Climate news today: science, COP talks and extreme weather',
    description: 'Climate news: the science, the UN climate talks and the weather on the ground, with the temperature, emissions and finance figures sourced.',
    keywords: ['climate news', 'climate change', 'COP31', 'UN climate talks', 'global warming', 'extreme weather', 'climate finance', 'fossil fuels', 'emissions', 'adaptation', '1.5 degrees', 'environment news'],
  },
  health: {
    title: 'Health news today: outbreaks, medicines and public health',
    description: 'Health news: disease outbreaks, vaccines, medicines and public health decisions, reported from official figures and named sources.',
    keywords: ['health news', 'public health', 'disease outbreak', 'cholera outbreak', 'vaccines', 'medicines', 'WHO', 'Africa CDC', 'global health', 'health policy'],
  },
  culture: {
    title: 'Culture news today: film, box office and entertainment',
    description: 'Culture and entertainment news: film releases, box office figures, streaming and what audiences are choosing.',
    keywords: ['culture news', 'entertainment news', 'box office', 'film news', 'movie releases', 'weekend box office', 'streaming', 'cinema', 'arts'],
  },
  sport: {
    title: 'Sport news today: scores, tables, results and fixtures',
    description: 'Sport news: Premier League and African football, AFCON qualifiers, CAF competitions and the NBA, with tables, results and the week ahead.',
    keywords: ['sport news', 'football news', 'Premier League table', 'Premier League results', 'African football', 'AFCON qualifiers', 'CAF Champions League', 'NBA scores', 'NBA results', 'fixtures', 'live scores'],
  },
}

export const NOT_FOUND: PageSeo = { title: 'Page not found', description: 'There is no page at this address.', keywords: [], noindex: true }

/** A browser-tab and search-result title: the page first, then the site. */
export const withSite = (title: string) => `${title} | ${SITE_NAME}`

/** Join keyword lists into one tag value: no repeats, the page's own first. */
export const keywordList = (...lists: string[][]) => [...new Set(lists.flat().map((k) => k.trim()).filter(Boolean))].join(', ')

/** Cut a description at a word, at about the length search results show. */
export const clip = (text: string, max = 158) => {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30))}…`
}

/** Split an address into its language prefix (if any) and the page path. */
export function stripLocale(pathname: string): { locale: string | null; path: string } {
  const [, first, ...rest] = pathname.split('/')
  const match = LOCALES.find((l) => l.toLowerCase() === (first ?? '').toLowerCase())
  return match ? { locale: match, path: `/${rest.join('/')}` } : { locale: null, path: pathname || '/' }
}
