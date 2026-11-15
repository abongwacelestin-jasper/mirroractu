# MirrorActu

The MirrorActu website: React 18, React Router 6, Tailwind CSS 4, framer-motion, TypeScript, built with Vite.

## Run it

```
npm install
npm run dev         # http://localhost:5173
npm run build       # production build in dist/
npm run typecheck   # TypeScript check
```

When hosting the build, serve `index.html` for unknown paths so deep links such as
`/story/s-cop31` load.

## Folder structure

```
index.html                 page shell and the first-load splash (logo, wordmark, progress bar)
public/                    favicon; media/ holds the photographs and video
src/
  main.tsx                 entry: router + render
  App.tsx                  route table; every page except the front page is code-split
  styles/index.css         Tailwind import and theme tokens (colours, fonts, easing)
  pages/                   one file per route
    HomePage  SectionPage  StoryPage  BriefPage  AgendaPage
    LivePage  SavedPage  StandardsPage  LegalPage  NotFoundPage
  components/
    layout/                Layout (owns every modal and popup), Masthead, LanguageMenu, TabBar (phones), Footer, SearchDialog
    brand/                 Logo, AnimatedLogo
    loading/               BrandSplash, PageSkeleton, Bone
    ads/                   AdSlot, AnchorAd, AdInfoModal, AdTag
    live/                  LiveFeed (LiveBar, LiveWire, MarketTicker, LiveAlert), LiveHub (data modules)
    overlays/              Modal, Popups (cookies, welcome, newsletter, correction), HousePromo, Toast, CorrectionForm
    search/                SearchPanel (shared by the search dialog and /search)
    media/                 VideoPlayer (poster, play, optional Google pre-roll)
    feed/                  Feed (For you / Following / Latest, new-updates prompt, endless scroll),
                           FeedCard, Rails (your edition, desks to follow, happening now)
    story/                 StoryParts (cards, rows, Confirmed / Still open ledger), Viz (charts),
                           StoryImage (photos and video with credits)
    ui/                    Container, Button, TextLink, Pill, PageHeader and other basics
  data/
    index.ts               typed data access and helpers: the seam to swap for a CMS / API
    snapshot.ts            the 15 Nov 2026 story snapshot
    trends.ts              trending subjects and trending videos
    countries.ts           editions, time-zone map, which countries each story is about
    offers.ts              advertisers and their offers, by category (flights, stays, events, banking)
    media.ts               photos and videos per story; media.generated.ts holds the credit list
  live/
    feed.ts                live feed store (wire + market quotes): the seam to swap for websockets
  lib/
    search.ts              search index, scoring, filters and search URLs
    google.ts              Google AdSense and IMA video adverts, switched on by env variables
    edition.ts             the reader's country edition (choice, geo lookup, time zone)
    translate.ts           on-demand Google translation of the page
    store.ts               saved stories, followed desks, read history, text size, consent (localStorage)
    share.ts               share sheet or copy link
    actions.ts             useSiteActions(): open search, newsletter, cookie settings, advert info, corrections
    reveal.ts              scroll-reveal observer for `data-reveal` elements
    boot.ts                fades out the index.html splash once the app has mounted
    preview.ts             pins a UI state (splash, skeleton, popup) for tests
```

Imports use the `@/` alias for `src/`, e.g. `import { AdSlot } from '@/components/ads/AdSlot'`.

## Routes

| URL | Page |
|---|---|
| `/` | Front page |
| `/:sectionId` | Section: `world`, `africa`, `business`, `tech`, `climate`, `health`, `culture`, `sport` |
| `/story/:slug` | Story, e.g. `/story/cop31-opens-in-antalya-as-scientists-warn-of-a-1-5-c-overshoot`. Old id links (`/story/s-cop31`) redirect to the slug |
| `/brief` | The Brief |
| `/coming-up` | Calendar |
| `/live` | Live data |
| `/saved` | Saved stories (stored in localStorage) |
| `/how-we-work` | Standards: `#about`, `#pipeline`, `#tiers`, `#sources`, `#ai`, `#corrections`, `#advertising`, `#live-data`, `#faq`, `#status` |
| `/trends` | Today's trends and video trends. `?v=<video id>#video` opens on a video |
| `/search` | Search results. The address is the search: `?q=cop31&desk=climate&type=videos&from=2026-11-01&sort=newest&open=1` |
| `/offers`, `/offers/:category` | Advertiser offers: `flights`, `stays`, `events`, `banking`. Adverts link here |
| `/offers/:category/:offer` | One offer, e.g. `/offers/flights/kigali-to-nairobi`: photo, details, what is included, enquiry form |
| `/legal` | Legal and contact status, picture credits at `#credits` |

## The feed and the reader's edition

The front page is built to feel personal without accounts. Everything is stored in the browser.

- **Welcome**: first visit, after the cookie choice, readers pick the desks they care about.
- **Feed**: *For you* puts unread stories from followed desks first; *Following* shows only those desks; *Latest* is everything.
- **New updates**: wire items that arrive while reading wait behind a "Show new updates" button.
- **Actions on every story**: Like, Save, Share and Hide. Likes nudge that desk up *For you*; there are no public counts because there are no accounts.
- **Our own promo**: after about 35 seconds `HousePromo` rises from the bottom with the animated logo and offers the one thing the reader has not done yet. It rests for a day once closed.
- **Progress**: stories are marked read when opened; The Brief shows "3 of 8 read"; story pages end with *Keep reading*.

## Pictures and video

Photos are freely licensed file photos from Wikimedia Commons (public domain, CC0, CC BY, CC BY-SA),
stored in `public/media`. Each is captioned "File photo" with its credit and licence, and all are
listed at `/legal#credits`. The video is a public-domain NASA visualisation. To add or change one,
edit `src/data/media.generated.ts` (photos) or `VIDEOS` in `src/data/media.ts`.

## Trends, video and Google adverts

- **Trends** (`/trends`, `src/live/trends.ts`): subjects ranked by stories filed plus live wire activity. It is
  coverage, not audience data: there is no analytics behind it yet. A centred popup offers the top five once a day.
- **Video trends**: public-domain and Creative Commons footage in `public/media`, listed in `src/data/trends.ts`.
- **Google video adverts**: `VideoPlayer` runs one pre-roll through Google's IMA SDK when `VITE_IMA_AD_TAG` is set.
  `npm run dev` uses Google's public *sample* tag (`.env.development`) so it can be seen working; it earns nothing.
  For production put your own Google Ad Manager tag in the host's environment settings.
- **Google display adverts**: set `VITE_ADSENSE_CLIENT` and the four `VITE_ADSENSE_SLOT_*` ids (see `.env.example`)
  and every ad slot is filled by AdSense instead of the placeholder creatives.
- **Consent**: nothing from Google loads before the reader's cookie choice; without advertising consent, adverts
  are requested as non-personalised. If Google's script is blocked, the video just plays and slots fall back.

## Search and addresses

- **Search** (`src/lib/search.ts`, `components/search/SearchPanel.tsx`): one index over stories, photos, videos,
  topics, desks, dates and offers, plus live wire matches. Results update on every keystroke, with type tabs,
  desk / date / order filters, voice input where the browser supports it, recent searches and arrow-key navigation.
  The dialog (press `/`) and the `/search` page share the same panel.
- **Slugs**: story addresses come from `slugify()` in `src/data/index.ts`; ids never appear in links.

## Country editions and language

- **Edition**: `src/lib/edition.ts` works out the reader's country (their own choice, then an optional
  geo lookup, then the device time zone) and `src/data/countries.ts` curates for it: a *Near you*
  strip, a boost in *For you*, and suggested languages. Readers change it from the masthead or footer.
- **IP-accurate detection** needs hosting: have the host write `<meta name="ma-country" content="RW">`
  from its geo header (Vercel `x-vercel-ip-country`, Cloudflare `CF-IPCountry`), or set
  `VITE_GEO_ENDPOINT` to a URL returning `{ "country_code": "RW" }`.
- **Per-country content** today is the same 38-story snapshot, re-ordered. Real country editions
  need the CMS to accept the country code and return stories for it.
- **Language**: `src/lib/translate.ts` loads Google's website translator only when a reader picks a
  language. It is machine translation, labelled as such on screen, with a one-tap way back to English.

## Motion

All motion is switched off for readers who ask their device for reduced motion.

- **Scroll reveal**: put `data-reveal` (or `data-reveal="left"` / `"zoom"`) on any element and it fades in the
  first time it enters the screen, staggered with its neighbours. One observer in `src/lib/reveal.ts` serves every page.
- **Buttons**: every button gives a little when pressed; solid buttons lift and glow on hover (`styles/index.css`, `buttonClass`).
- **Feedback**: the heart pops and bursts on Like, the bookmark pops on Save, the tab-bar marker slides between tabs.
- **Loading**: skeletons shimmer; photos fade in from a blur; page titles rise and the signal axis draws itself.
- **Numbers**: `CountUp` counts figures up as they come into view; market quotes flash when they change.
- **Pages** fade in on navigation.

## Phones first

Below 1024px the utility row is replaced by a bottom tab bar (Home, Brief, Live, Offers, Saved),
the front-page stage is shortened, section stats sit in one row, topic filters scroll sideways,
and the anchor advert is a single slim row above the tab bar. Checked from 320px to 768px.

## Loading states

1. **Splash**: `index.html` draws the logo in plain HTML and CSS, so it shows before JavaScript arrives. `lib/boot.ts` removes it after mount.
2. **Route skeleton**: `Layout` shows `PageSkeleton` shaped like the incoming page while it loads.
3. **Live skeleton**: the wire, live bar and ticker show placeholder rows until the feed connects.
4. **Advert skeleton**: each slot reserves its space and loads its creative only when scrolled near.

## Advertising rules built in

Every slot has a solid "Advertisement" (or "Sponsored") tag, names who paid, and has an
"About this advert" modal with a hide button. `/how-we-work` and `/legal` carry no adverts
(`AD_FREE` in `components/layout/Layout.tsx`); the standards page shows one labelled specimen.

## Not connected yet

Each of these says so on screen:

- **Live feeds**: `src/live/feed.ts` simulates the provider. Replace `connect()` with the real subscription.
- **Ad server and offers**: advertisers, fares, schedules and prices in `src/data/offers.ts` are placeholders (the airports, time zones and places are real). Replace with the ad server and partner feeds.
- **Email sign-up and corrections form**: validate only; nothing is sent.
- **Exchange rates, legal pages**: waiting on a provider and legal review.
