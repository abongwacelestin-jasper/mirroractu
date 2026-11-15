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
public/                    favicon
src/
  main.tsx                 entry: router + render
  App.tsx                  route table; every page except the front page is code-split
  styles/index.css         Tailwind import and theme tokens (colours, fonts, easing)
  pages/                   one file per route
    HomePage  SectionPage  StoryPage  BriefPage  AgendaPage
    LivePage  SavedPage  StandardsPage  LegalPage  NotFoundPage
  components/
    layout/                Layout (owns every modal and popup), Masthead, Footer, SearchDialog
    brand/                 Logo
    loading/               BrandSplash, PageSkeleton, Bone
    ads/                   AdSlot, AnchorAd, AdInfoModal, AdTag
    live/                  LiveFeed (LiveBar, LiveWire, MarketTicker, LiveAlert), LiveHub (data modules)
    overlays/              Modal, Popups (cookies, newsletter, correction), Toast, CorrectionForm
    story/                 StoryParts (cards, rows, Confirmed / Still open ledger), Viz (charts)
    ui/                    Container, Button, TextLink, Pill, PageHeader and other basics
  data/
    index.ts               typed data access and helpers: the seam to swap for a CMS / API
    snapshot.ts            the 15 Nov 2026 story snapshot
  live/
    feed.ts                live feed store (wire + market quotes): the seam to swap for websockets
  lib/
    store.ts               saved stories, followed sections, text size, consent (localStorage)
    actions.ts             useSiteActions(): open search, newsletter, cookie settings, advert info, corrections
    boot.ts                fades out the index.html splash once the app has mounted
    preview.ts             pins a UI state (splash, skeleton, popup) for tests
```

Imports use the `@/` alias for `src/`, e.g. `import { AdSlot } from '@/components/ads/AdSlot'`.

## Routes

| URL | Page |
|---|---|
| `/` | Front page |
| `/:sectionId` | Section: `world`, `africa`, `business`, `tech`, `climate`, `health`, `culture`, `sport` |
| `/story/:storyId` | Story, e.g. `/story/s-cop31` |
| `/brief` | The Brief |
| `/coming-up` | Calendar |
| `/live` | Live data |
| `/saved` | Saved stories (stored in localStorage) |
| `/how-we-work` | Standards: `#about`, `#pipeline`, `#tiers`, `#sources`, `#ai`, `#corrections`, `#advertising`, `#live-data`, `#faq`, `#status` |
| `/legal` | Legal and contact status |

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
- **Ad server**: `Creative` in `components/ads/AdSlot.tsx` renders placeholder sponsors. Replace it with the ad-server render.
- **Email sign-up and corrections form**: validate only; nothing is sent.
- **Exchange rates, legal pages**: waiting on a provider and legal review.
