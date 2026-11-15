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

## The backend

The site has its own API and database. `server/` is a Node (Fastify) API backed by Postgres; the website loads
its edition from it at start-up and falls back to the bundled snapshot if it cannot be reached.

```
docker compose up -d db api      # database + API on http://localhost:4000
npm run dev                      # the site on :5173, with /api forwarded to the API
```

The first start creates the tables, loads the 15 November 2026 snapshot, and creates the first administrator
from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The dashboard is at **`/admin`**.

### Getting in

- **Readers** need no account. Everything personal (saved stories, likes, edition) stays in their browser.
- **Staff** sign in at the **dashboard, which is a separate website** with its own address (locally
  `http://localhost:8081`; in development also `http://localhost:5173/admin`). The public site has no dashboard,
  no sign-in and no link to one. See *The dashboard is a separate site* below.
- **Accounts are created for you.** List people in `ADMIN_EMAILS` and `EDITOR_EMAILS` and give a first password
  in `ADMIN_PASSWORD`. Each time the API starts, anyone listed who has no account gets one. At their first
  sign-in the dashboard makes them choose their own password before anything else opens.
- Existing accounts are never changed by a restart: passwords are left alone and nobody is demoted or removed.
- **Locked out?** Set `ADMIN_FORCE_RESET=true`, restart, sign in with `ADMIN_PASSWORD`, then remove the variable.
- **One account by hand**, with a one-time password printed once:
  `docker compose exec api node /opt/mirroractu/api/dist/create-admin.js ada@example.com "Ada Obi" admin`
- Administrators can also add staff from the dashboard (**Staff**).

Every API setting is listed with its default in `server/.env.example`.

### The dashboard is a separate site

One codebase builds two websites, chosen by `APP_TARGET` at build time (`src/lib/target.ts`):

| Build | Contains | Server config |
|---|---|---|
| `site` (default) | The public site only. No dashboard route, code or link; `/admin` is "Not found" | `deploy/nginx.site.conf.template`: answers 404 to `/api/v1/auth/*` and `/api/v1/admin/*` and strips any gateway key a visitor sends |
| `admin` | The dashboard only, at the root of its own address | `deploy/nginx.admin.conf.template`: adds `ADMIN_GATEWAY_KEY` to forwarded requests, strict content policy, no framing, no indexing |

The API answers sign-in and dashboard requests only if they carry `ADMIN_GATEWAY_KEY` (otherwise "not found") and,
for changes, only from `ADMIN_ORIGIN`. So the single way in is dashboard address → its server → API.
With no `APP_TARGET` (`npm run dev`) both run together, with the dashboard under `/admin`.

### API (`/api/v1`)

| Endpoint | What it does |
|---|---|
| `GET /bootstrap` | The whole edition in one request: stories, sections, graphics, calendar, trend topics |
| `GET /stories`, `GET /stories/:slug` | Stories, filterable by `desk` and `q` |
| `GET /trends?country=RW` | Today's trends at three levels: the country, its region, global. Ranked by stories about the place, wire activity and what measured readers there open. Without a country: global only |
| `GET /geo` | The reader's country, when the host or CDN supplies it (`CF-IPCountry`, `x-vercel-ip-country`, `x-country-code`) |
| `GET /wire`, `GET /wire/stream` | The live wire; the stream pushes each update the moment it is filed |
| `POST /subscribe`, `/corrections`, `/enquiries` | The three reader forms. Each sends email (see *Email*) |
| `POST /subscribe/confirm`, `/unsubscribe`, `GET /subscription` | Used by the page the email links open; the token in the link is the proof |
| `POST /unsubscribe/one-click` | The mail program's own Unsubscribe button (RFC 8058) |
| `POST /hooks/resend` | Signed webhook from Resend: bounces and spam complaints |
| `GET /rates` | Exchange rates against the US dollar, for prices in the reader's currency |
| `POST /events` | A story view, sent only for readers who allowed measurement |
| `POST /auth/login`, `/auth/logout`, `GET /auth/me`, `POST /auth/password` | Staff sign-in |
| `/admin/…` | Dashboard: overview and analytics, stories, wire, corrections, enquiries, subscribers, staff, audit log |

### Dashboard

Layout: navigation on the left, the page in the middle, and a live **Now** rail on the right (the wire with a
quick-file box, what needs an editor, today's trends, service status). Below 1280px the rail opens from the *Now*
button in the top bar, sliding up from the bottom on phones; below 1024px navigation becomes a bottom bar and a menu.
The code is in `src/admin/`: `AdminApp.tsx` (sign-in, shell, rail), `views.tsx` (the pages), `ui.tsx` (the design kit).

- **Overview**: readers and views, a 14-day chart, most-read stories, readers by country and language, and the trends ranking with its score.
- **Stories**: create, edit, publish and unpublish. A story's address never changes when its headline does.
- **Live wire**: file an update and it reaches every open page at once.
- **Inbox**: corrections from readers (with a status for each) and offer enquiries.
- **Subscribers**: morning-email sign-ups; administrators can export a CSV.
- **Staff** and **Audit log** (administrators): add or switch off accounts, and see who changed what.

Two roles: **editor** (stories, wire, inbox) and **administrator** (everything).

### Security

- Passwords are hashed with scrypt; sessions are random tokens in an httpOnly cookie and only their hash is stored.
- Five wrong passwords lock an account for fifteen minutes; sign-in and the forms are rate limited.
- Requests that change data must come from the site's own address (`SITE_ORIGIN`), which stops other websites acting for a signed-in editor.
- Every input is validated, every query is parameterised, request bodies are capped at 64 KB, and errors never expose internals.
- The database is not exposed outside the container network. The API and web containers run as non-root on read-only file systems.
- Readership stores no IP address: visitors are a daily hash that cannot be reversed, events are dropped after 90 days, and Global Privacy Control is honoured.
- Every dashboard change is written to the audit log.

Not built yet: an email service (so no confirmation emails are sent and subscribers stay "pending"), password reset by
email, two-factor sign-in, and automatic database backups. Market quotes still tick locally.

## Deploy with Docker

Four containers: `web` (the public site, port 8080), `admin` (the staff dashboard, port 8081), `api` (Node) and `db` (Postgres).

```
cp deploy/env.example .env          # set the passwords and SITE_ORIGIN
docker compose up -d --build        # build and start on http://localhost:8080
docker compose logs -f web          # watch it
docker compose down                 # stop it
```

Or without Compose: `docker build -t mirroractu .` then `docker run -d -p 8080:8080 mirroractu` (add `-e APP_TARGET=admin` or `-e APP_TARGET=api` for the other roles).

| File | What it does |
|---|---|
| `Dockerfile` | One image for the site, the dashboard and the API. `APP_TARGET` (`site`, `admin` or `api`) chooses the role when a container starts; `deploy/start.sh` does the choosing |
| `deploy/nginx.site.conf.template`, `deploy/nginx.admin.conf.template` | Sends every page address (including `/fr/…`) to the app, caches hashed assets for a year and media for a week, never caches `index.html`, adds security headers, answers `/healthz` |
| `docker-compose.yml` | The three services, on read-only file systems with no extra privileges, restarting unless stopped |
| `railway.json` | Tells Railway to build from the Dockerfile and check `/healthz` |
| `deploy/env.example` | The settings, all optional. They are baked in at build time, so rebuild after changing them |

On a server:

1. Install Docker, clone the repository, `cp deploy/env.example .env`, then `docker compose up -d --build`.
2. Put HTTPS in front of port 8080: a managed load balancer, Cloudflare, or a reverse proxy such as Caddy or Traefik
   on the same machine. The container itself speaks plain HTTP.
3. To update: `git pull && docker compose up -d --build`.

### Railway

**The complete Railway guide is in [`RAILWAY.md`](RAILWAY.md)**: five services (Postgres, Redis, `api`, `web`, `admin`),
every variable, how the services connect, custom domains, a check that the dashboard is locked, and troubleshooting.

Railway does not tell the app which country a reader is in, so editions use the device time zone there. For
IP-accurate editions put Cloudflare in front of the Railway domain (it sends `CF-IPCountry`), or set `VITE_GEO_ENDPOINT`.

**Reader's country**: if the proxy or CDN in front sends `CF-IPCountry`, `X-Vercel-IP-Country` or `X-Country-Code`,
nginx passes it to the app and editions become IP-accurate. Without it, the device time zone is used.

## Folder structure

```
index.html                 page shell and the first-load splash (logo, wordmark, progress bar)
public/                    favicon, manifest, service worker, offline page; brand/ (logo), icons/ (app icons), media/ (photos, video)
Dockerfile, docker-compose.yml, deploy/   container build, web server config, settings template
server/                    the API: Fastify + Postgres (routes, sign-in, migrations, first-run content)
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
    sport/                 SportHub (scoreboard: competitions, table, results, fixtures, sport wire)
    story/                 StoryParts (cards, rows, Confirmed / Still open ledger), Viz (charts),
                           StoryImage (photos and video with credits)
    ui/                    Container, Button, TextLink, Pill, PageHeader and other basics
  admin/                   the staff dashboard at /admin
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
    consent.ts             the reader's privacy choice and what it gates
    google.ts              Google AdSense and IMA video adverts, switched on by env variables
    edition.ts             the reader's country edition (choice, geo lookup, time zone)
    translate.ts           language in the address (/fr/…), hreflang links, Google translation
    store.ts               saved stories, followed desks, read history, text size, consent (localStorage)
    share.ts               share sheet or copy link
    api.ts                 client for the MirrorActu API (/api/v1)
    meta.ts                page title and share tags for each route
    pwa.ts                 service worker registration, install and update state
    actions.ts             useSiteActions(): open search, newsletter, cookie settings, advert info, corrections
    reveal.ts              scroll-reveal observer for `data-reveal` elements
    boot.ts                fades out the index.html splash once the app has mounted
    preview.ts             pins a UI state (splash, skeleton, popup) for tests
```

Imports use the `@/` alias for `src/`, e.g. `import { AdSlot } from '@/components/ads/AdSlot'`.

## Routes

Every route below also exists under a language prefix: `/fr/trends`, `/sw/story/…`, `/en/brief`.
An address with no prefix is English. See *Language in the address*.

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
- **Consent**: Google adverts load only for readers who allowed *Advertising by Google*. Everyone else sees the
  house adverts and videos play with no pre-roll. If Google's script is blocked, the same fallback applies.
- **Flights reference**: `AIRLINES` in `src/data/offers.ts` lists real airlines at Kigali with aircraft photos. It is
  labelled as reference, not advertising, and carries no prices.

## The app (PWA)

MirrorActu installs to a phone or computer like an app, from the browser.

- **Files**: `public/manifest.webmanifest` (name, colours, icons, four shortcuts, two screenshots), `public/sw.js`
  (the service worker), `public/offline.html`, icons in `public/icons/`.
- **Offline**: the last edition, pages already opened, photos and fonts are kept on the device, so the site
  opens and reads without a connection. The dashboard, sign-in, forms and Google services are never cached.
- **Install**: `InstallPrompt` (in `components/overlays/AppPrompts.tsx`) is our own invitation, shown after a
  reader has spent a little time on the site, and from *Get the app* in the footer. iPhone and iPad get the
  two-tap instructions, since they have no install dialog.
- **Updates**: when a new version has downloaded, a bar offers *Refresh now*.
- The service worker only runs in a production build, so test it on the Docker site (port 8080), not `npm run dev`.

## Logo

The symbol is one file, `public/brand/mark.svg`. Replace it and the logo changes across the masthead, footer,
dialogs, dashboard and offline page. `public/brand/` also has `mark-on-light.svg`, `logo.svg` (symbol and
wordmark) and `share.png` (the image shown when a link is shared). The app icons in `public/icons/` and the
animated splash are drawn from the same shape; regenerate them if the shape itself changes.

## Page titles and link previews

`src/lib/meta.ts` gives every route its own browser title, description and share tags (story headline and
photo, section name, search term and so on). The masthead's top links underline the page you are on.

## Search and addresses

- **Search** (`src/lib/search.ts`, `components/search/SearchPanel.tsx`): one index over stories, photos, videos,
  topics, desks, dates and offers, plus live wire matches. Results update on every keystroke, with type tabs,
  desk / date / order filters, voice input where the browser supports it, recent searches and arrow-key navigation.
  The dialog (press `/`) and the `/search` page share the same panel.
- **Slugs**: story addresses come from `slugify()` in `src/data/index.ts`; ids never appear in links.

## Privacy and ethics

- **Consent** (`src/lib/consent.ts`, `ConsentModal`): a centred dialog on first visit that stays until the reader
  chooses. *Deny all* and *Accept all* are identical in size and colour, no purpose is pre-ticked, the choice is
  asked again after six months, and the browser's Global Privacy Control signal is honoured. Reopen it from
  *Cookie settings* in the footer.
- **What it gates**: `ads` (Google AdSense and Google video adverts; denied means house adverts only and no
  pre-roll), `translation` (Google Translate), `measurement` (nothing loads for it yet).
- **Your data** (`/legal#your-data`): lists everything stored in the browser, with *Download a copy* and
  *Erase everything*. There are no accounts and nothing is kept on a server.
- **Stated in public**: `/how-we-work#ethics` lists these commitments for readers.

## Language in the address

- `src/lib/translate.ts` reads the language from the first part of the address and `main.tsx` mounts the router
  on it, so every link keeps the reader in their language. Changing language is a move to the same page under
  another prefix.
- Each page carries `hreflang` links for all 26 languages and a canonical link, for search engines.
- Translation is machine translation by Google, and only runs if the reader allowed it. Someone who opens a
  shared `/fr/…` link without having allowed it sees the English page and a bar asking first.
- A one-time bar offers the reader's own language (from their browser language, then their country).
- When real translated editions exist, serve them at these same addresses and drop the widget.

## Country editions and language

- **Edition**: `src/lib/edition.ts` works out the reader's country (their own choice, then an optional
  geo lookup, then the device time zone) and `src/data/countries.ts` curates for it: a *Near you*
  strip, a boost in *For you*, and suggested languages. Readers change it from the masthead or footer.
- **IP-accurate detection** needs hosting: have the host write `<meta name="ma-country" content="RW">`
  from its geo header (Vercel `x-vercel-ip-country`, Cloudflare `CF-IPCountry`), or set
  `VITE_GEO_ENDPOINT` to a URL returning `{ "country_code": "RW" }`.
- **Country trends**: `server/src/trends.ts` ranks topics three times: for the country, for its region,
  and globally. A story counts for a country when an editor tagged it (the **Countries** field in the
  dashboard; existing stories are tagged once at start-up), and readership counts where measured readers
  are. The Trends page shows the three as tabs; the trends popup uses the nearest level.
- **Language is asked, not assumed**: a reader whose country has another main language gets one
  question ("Lire MirrorActu en français ?"). *Yes* is their consent to Google Translate and moves them
  to `/fr`; *Keep English* is remembered and the question is not asked again. The choice
  (`ma-lang-pref`) is honoured on later visits only while translation consent stands.
  `src/lib/translate.ts` never loads Google's translator before that consent.

## Search engines and link previews (SEO)

The site is drawn in the browser, so crawlers would otherwise see one generic page. Instead the web
server asks the API for each page's details and stitches them in before sending it
(`server/src/seo.ts`, the two `include` lines in `index.html`, `/__seo/` in
`deploy/nginx.site.conf.template`). No script has to run for a crawler or a chat app to see them.

- **Per page:** title, description, keywords, canonical address, robots rule, Open Graph and
  Twitter tags (with the story's own picture), and for stories the publish date, section and tags.
- **Structured data:** `NewsArticle` + breadcrumbs on stories; `NewsMediaOrganization`, `WebSite`
  (with site search) and the latest stories on the front page; `CollectionPage` on sections.
- **Readable without scripts:** each page's headline, summary, facts, sources and links are in a
  `<noscript>` block.
- **`/robots.txt`, `/sitemap.xml`** (every page and story, with pictures), **`/news-sitemap.xml`**
  (last two days, for Google News) and **`/feed.xml`** (RSS) are generated from what is published.
- **One address per page.** `/fr/…`, `/en/…` and id-style story links all name the plain English
  address as canonical. Saved stories, search results, the email pages and unknown addresses are
  marked `noindex`. The dashboard refuses all crawlers.
- **Wording** for the front page, fixed pages and sections is in `src/data/seo.ts`. Story keywords
  come from the story's own subject, tags, countries and sections.
- If the API is down the page still loads at once, with the front page's details.

Links are built from the **first** address in `SITE_ORIGIN`, so put the real domain first. After
going live, add the site in Google Search Console and Bing Webmaster Tools and submit
`/sitemap.xml` and `/news-sitemap.xml`.

## Engagement and the heat map

The dashboard's **Engagement** page (`src/admin/engagement.tsx`, `GET /admin/engagement`) shows, for
24 hours, 7 days or 30 days: pages opened, readers, clicks and searches against the period before;
a heat map of Africa or the world with requests or readers per country; load by hour or day with
the busiest hour; where readers arrive from; the most opened pages; what gets clicked; and what
readers search for, with a mark where a search found nothing.

- **What is recorded** (`src/lib/track.ts` → `POST /events`): the page path with nothing after `?`;
  on the first page of a visit, the *host name* of the site the reader came from (or `utm_source`);
  a short label for clicks on links leaving the site, offers, promotions and story actions (add
  `data-track="name"` to any element to count it); and search words, up to 60 characters.
- **Only with consent.** Nothing is sent unless the reader allowed "Readership measurement", and
  never when the browser sends Global Privacy Control. No IP address is stored and events are
  deleted after `EVENTS_RETENTION_DAYS`. Because measurement now covers more than story views,
  the consent version was raised: every reader is asked again.
- **Country** comes from the CDN header when there is one (Cloudflare), otherwise from the
  reader's edition. The map counts measured readers, not all traffic.
- Map outlines are Natural Earth (public domain), pre-projected in `src/admin/maps.generated.ts`.

## Email (Resend)

`server/src/mail/`: `send.ts` talks to Resend's HTTP API and logs every attempt (never the body),
`templates.ts` holds all eleven emails as HTML plus plain text, `service.ts` runs the sign-up flow and
builds editions, `webhook.ts` verifies Resend's signed bounce and complaint reports.

- **Double opt-in.** A sign-up gets one confirmation email and nothing else until the link is
  followed. Unanswered sign-ups are deleted after 30 days. Every edition carries an unsubscribe link
  and the one-click header mail programs use; bounced and complaining addresses stop automatically.
- **The morning email** is written in the dashboard under **Email**: subject, opening note, up to
  eight stories (the first leads), live preview for desktop and phone, a test to yourself, then send.
  Only administrators can send to readers. Each reader gets the trends block for their own country.
- **No abuse through the forms.** Receipts to an address a stranger typed never repeat what was
  typed, name a story only if it is a real one, and are rate limited.
- **Not tracked.** No open pixels, no click tracking.
- Without `RESEND_API_KEY` nothing is sent; in development the first link of each email is printed
  in the API log so the flow can be followed by hand. Variables: `server/.env.example`.

## Currency

`src/data/currency.ts` maps each country edition to its currency; `src/lib/money.ts` converts the
dollar prices on offers (cards, offer pages, comparison tables, search) using `GET /rates`, rounds
them, and always shows the dollar price they came from. Readers on the US or international edition
see dollars unchanged.

## iPhone safe area

`--safe-top` in `src/styles/index.css` is the height of the notch and status-bar strip when the app
is installed to the home screen. The page, the sticky header, sticky tab bars, the search sheet and
the dashboard all start below it, and a fixed ink bar fills the strip itself.

## Renewberry promotion

`src/components/overlays/PartnerPromo.tsx` shows a labelled promotion for Renewberry at a random
moment (50 to 150 seconds into a page, about two visits in three, then not again for eight hours),
never over another popup and never on advert-free pages. Its words and link are in
`src/data/partner.ts`.

## Caching (Redis)

`server/src/cache.ts`. With `REDIS_URL` set, the edition (`/bootstrap`, 30 s) and each country's trends
(20 s) are served from Redis, and request limits are counted there. Saving a story or filing a wire
update bumps a version number, so readers see the change at once and old entries expire on their own.
Without `REDIS_URL`, or while Redis is down, each API instance caches in memory and keeps working.
`GET /api/v1/health` reports which is in use (`"cache": "redis"` or `"memory"`). Docker Compose starts
Redis for you.

## Motion

All motion is switched off for readers who ask their device for reduced motion.

- **Scroll reveal**: put `data-reveal` (or `data-reveal="left"` / `"zoom"`) on any element and it fades in the
  first time it enters the screen, staggered with its neighbours. One observer in `src/lib/reveal.ts` serves every page.
- **Buttons**: every button gives a little when pressed; solid buttons lift and glow on hover (`styles/index.css`, `buttonClass`).
- **Feedback**: the heart pops and bursts on Like, the bookmark pops on Save, the tab-bar marker slides between tabs.
- **Loading**: skeletons shimmer; photos fade in from a blur; page titles rise and the signal axis draws itself.
- **Numbers**: `CountUp` counts any figure up from zero as it scrolls into view ("52%", "$4,074", "+1.75°C"); dates and times are left alone. Market quotes flash when they change.
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

- **Market quotes**: they still tick locally in `src/live/feed.ts`. The wire itself is real, from the API.
- **Email**: sign-ups are stored but no email service is connected, so nothing is sent.
- **Ad server and offers**: advertisers, fares, schedules and prices in `src/data/offers.ts` are placeholders (the airports, time zones and places are real). Replace with the ad server and partner feeds.
- **Exchange rates, legal pages**: waiting on a provider and legal review.
