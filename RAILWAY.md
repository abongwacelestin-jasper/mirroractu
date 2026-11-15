# Deploying MirrorActu on Railway

This is the full setup: every service, how they connect, and every variable.

> Status: the same containers and settings are tested locally with Docker Compose. They have
> not been run on Railway itself, so treat the Railway-specific parts (menu names, the
> `${{…}}` references, private networking) as unverified and check them as you go.

## What you are building

Five services in one Railway project. Two are public, three are private.

```
                    readers                                  staff
                       │                                       │
        https://mirroractu.net                    https://desk.mirroractu.net
                       │                                       │
              ┌────────▼────────┐                    ┌─────────▼─────────┐
              │  web  (public)  │                    │  admin  (public)  │
              │  public site    │                    │  staff dashboard  │
              │  no dashboard   │                    │  adds gateway key │
              └────────┬────────┘                    └─────────┬─────────┘
                       │  /api/*  (never /api/v1/admin         │  /api/*
                       │           or /api/v1/auth)            │
                       └──────────────┬────────────────────────┘
                                      │ private network
                             ┌────────▼────────┐
                             │  api (private)  │
                             │  no public URL  │
                             └────────┬────────┘
                                      │ private network
                    ┌─────────────────┴─────────────────┐
           ┌────────▼────────┐                 ┌────────▼────────┐
           │ Postgres (priv.)│                 │  Redis (priv.)  │
           │  the database   │                 │  cache, limits  │
           └─────────────────┘                 └─────────────────┘
```

| Service | What it is | Public address? | `APP_TARGET` |
|---|---|---|---|
| `Postgres` | The database | No | (Railway's PostgreSQL) |
| `Redis` | The cache: the edition, each country's trends, request limits | No | (Railway's Redis) |
| `api` | The API: stories, trends, wire, forms, sign-in, dashboard data | **No** | `api` |
| `web` | The public website | Yes | not set (or `site`) |
| `admin` | The staff dashboard, a separate website | Yes, its own | `admin` |

**All three app services are built from the same repository and the same `Dockerfile`, with no build settings
to change.** The image contains all three roles, and the `APP_TARGET` variable decides which one a service runs
when it starts. The first line of every deploy log says which: `MirrorActu starting as: api` (or `site`, `admin`).
If that line names the wrong role, the variable is wrong on that service.

### Why the dashboard is a separate service

- The public site (`web`) contains **no dashboard**: no page, no code, no link. `/admin` there is "Page not found".
- `web`'s server **refuses** every `/api/v1/auth/…` and `/api/v1/admin/…` request with 404, and strips any gateway key a visitor tries to send.
- The API only answers sign-in and dashboard requests that carry a secret **gateway key**. Only the `admin` service knows that key and adds it. Without it the API says "not found", as if those routes did not exist.
- Sign-in and dashboard changes must also come from the dashboard's own address (`ADMIN_ORIGIN`), and the session cookie belongs to that address only.
- The API and the database have no public address at all.

So the only way in is: the `admin` address → its server → the API. Knowing the public site's address gets you nowhere.

## Before you start

1. The code is on GitHub at `kelvintawe13/mirroractu`, branch `main`.
2. Generate three secrets on your computer and keep them somewhere safe (a password manager):

   ```
   openssl rand -hex 32        # ADMIN_GATEWAY_KEY
   openssl rand -base64 32     # ANALYTICS_SALT
   openssl rand -base64 18     # ADMIN_PASSWORD (a first password; everyone replaces it)
   ```

3. Decide the two addresses. To start you can use Railway's generated ones; later use your own, for example
   `mirroractu.net` for the site and `desk.mirroractu.net` for the dashboard. Pick a dashboard name that is
   not guessable from the site's name if you want it harder to find.

## Step 1: the project and the database

1. Railway → **New Project** → **Deploy PostgreSQL**.
2. Leave the service name as **`Postgres`**. The variables below refer to it by that name.
3. In the Postgres service, turn on **backups**. Nothing in the code backs up the database.

## Step 1b: Redis

1. In the same project: **New** → **Database** → **Add Redis**.
2. Leave the service name as **`Redis`**.
3. No domain, no backups, nothing to configure. It only holds cached answers that the API can rebuild.

What it is for: the API keeps the edition (30 seconds) and each country's trends (20 seconds) in Redis instead
of asking the database on every visit, and counts requests per address there so the limit holds across restarts
and across several `api` instances. Publishing or editing a story clears the affected cache at once.

It is **optional by design**. Without `REDIS_URL`, or if Redis goes down, the API caches in its own memory and
keeps answering. The `api` deploy log says which is in use: `Cache: Redis connected` or `Cache: in memory`.

## Step 2: the API (`api`)

1. **New** → **GitHub Repo** → `kelvintawe13/mirroractu`.
2. Rename the service to **`api`** (Settings → Service Name).
3. **Settings → Build**: nothing to change. If you set a *Config file path* or a `RAILWAY_DOCKERFILE_PATH`
   variable earlier, remove them (they are harmless, but no longer needed).
4. **Settings → Networking**: do **not** generate a domain. It must stay private.
5. **Variables**:

| Variable | Value | Notes |
|---|---|---|
| `APP_TARGET` | `api` | **Makes this service the API.** Without it the service starts as the website and its health check fails |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Connects to the database over the private network |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Connects to the cache over the private network |
| `PORT` | `4000` | Set it so the other services can refer to it |
| `NODE_ENV` | `production` | Turns on HTTPS-only cookies and the checks below |
| `SITE_ORIGIN` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` | The public site. Reader forms are only accepted from here |
| `ADMIN_ORIGIN` | `https://${{admin.RAILWAY_PUBLIC_DOMAIN}}` | The dashboard. Sign-in is only accepted from here. Must differ from `SITE_ORIGIN` |
| `ADMIN_GATEWAY_KEY` | your `openssl rand -hex 32` value | 32+ characters. Shared with `admin` only |
| `ANALYTICS_SALT` | your `openssl rand -base64 32` value | Anonymises readers in readership counts |
| `ADMIN_EMAILS` | e.g. `Kelvin Tawe <you@example.com>` | Administrators, comma separated. Created automatically |
| `ADMIN_PASSWORD` | your first password | 12+ characters. Each person must replace it at first sign-in |
| `EDITOR_EMAILS` | optional | Editors, same format as `ADMIN_EMAILS` |

The API refuses to start in production if `SITE_ORIGIN`, `ADMIN_ORIGIN`, `ADMIN_GATEWAY_KEY` (32+) or
`ANALYTICS_SALT` (16+) is missing, or if the two origins are the same. The deploy log says which.

## Step 3: the public site (`web`)

1. **New** → **GitHub Repo** → the same repository.
2. Rename the service to **`web`**.
3. No build settings to change.
4. **Variables**:

| Variable | Value | Notes |
|---|---|---|
| `API_UPSTREAM` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` | Where `/api/` requests are sent, privately |

   Do **not** set `PORT` (Railway provides it) or `ADMIN_GATEWAY_KEY` on this service. `APP_TARGET` can be left unset.
5. **Settings → Networking → Generate Domain**. This is the public address.

## Step 4: the staff dashboard (`admin`)

1. **New** → **GitHub Repo** → the same repository, a third time.
2. Rename the service to **`admin`**.
3. No build settings to change. The variable `APP_TARGET` below is what makes it run the dashboard instead of the site.
4. **Variables**:

| Variable | Value | Notes |
|---|---|---|
| `APP_TARGET` | `admin` | Run the dashboard, with its own locked-down web server |
| `API_UPSTREAM` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` | Same private address as `web` uses |
| `ADMIN_GATEWAY_KEY` | `${{api.ADMIN_GATEWAY_KEY}}` | A reference, so the two can never drift apart |
| `VITE_SITE_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` | Optional. For the dashboard's "View the site" links |

5. **Settings → Networking → Generate Domain**. This is the dashboard's address. Do not publish it.

## Step 5: deploy order and first sign-in

1. Deploy in this order: `Postgres` and `Redis` → `api` → `web` and `admin`. If `api` was deployed before the other two
   had domains, redeploy it once so `SITE_ORIGIN` and `ADMIN_ORIGIN` pick up the real addresses.
2. Open the **dashboard's** address. You should see the sign-in page.
3. Sign in with an address from `ADMIN_EMAILS` and the `ADMIN_PASSWORD`.
4. Choose your own password when asked. Until you do, nothing else opens.
5. Add other staff from **Staff** in the dashboard, or by adding them to `ADMIN_EMAILS` / `EDITOR_EMAILS` and redeploying `api`.

## How the services connect

| From | To | How | Set by |
|---|---|---|---|
| `web` | `api` | Private network, `http://api.railway.internal:4000` | `API_UPSTREAM` on `web` |
| `admin` | `api` | Private network, same address, plus the gateway key header | `API_UPSTREAM` and `ADMIN_GATEWAY_KEY` on `admin` |
| `api` | `Postgres` | Private network | `DATABASE_URL` on `api` |
| `api` | `Redis` | Private network | `REDIS_URL` on `api` |
| Reader's browser | `web` | HTTPS, public | Railway domain / your domain |
| Staff browser | `admin` | HTTPS, public but unadvertised | Railway domain / your domain |
| Anyone | `api`, `Postgres`, `Redis` | **Not reachable** | No public domain |

## Email (Resend)

MirrorActu sends its email through [Resend](https://resend.com). Until `RESEND_API_KEY` is set **nothing is
sent**: each email is listed in the dashboard (**Email → Sent**) as “Not connected”, and you can preview all
of them there.

1. **Create a Resend account** and, under **Domains**, add the domain you will send from (for example
   `mirroractu.net`). Resend shows DNS records (SPF, DKIM); add them at your DNS host and wait for “Verified”.
2. **API Keys → Create API key**, with *Sending access*. Copy it.
3. On the **`api`** service, set:

| Variable | Value | Notes |
|---|---|---|
| `RESEND_API_KEY` | the key from step 2 | Turns email on |
| `MAIL_FROM` | `MirrorActu <news@yourdomain>` | Must be on the verified domain. Without it Resend's test sender is used, which only reaches your own Resend address |
| `MAIL_REPLY_TO` | e.g. `newsroom@yourdomain` | Optional. Where replies go |
| `MAIL_NEWSROOM_TO` | addresses, comma separated | Optional. Who hears about new corrections and enquiries. Default: every administrator |
| `MAIL_POSTAL_ADDRESS` | the publisher's postal address | Printed at the foot of the newsletter. Anti-spam law in several countries requires it |
| `RESEND_WEBHOOK_SECRET` | `whsec_…` from step 4 | Stops email to bounced addresses and to readers who mark it as spam |

4. **Webhooks → Add webhook** in Resend: URL `https://YOUR-PUBLIC-SITE/api/v1/hooks/resend`, events
   `email.bounced` and `email.complained`. Copy its signing secret into `RESEND_WEBHOOK_SECRET`.
5. Redeploy `api`. Its log should say `Email: Resend connected, sending as …`.
6. In the dashboard open **Email**, pick any template under **All emails** and press **Send this one to me**.

The links in emails use the **first** address in `SITE_ORIGIN` (and `ADMIN_ORIGIN` for staff email), so put
your real domain first once you have one.

What is sent, and when:

| Email | To | When |
|---|---|---|
| Confirm your address | Reader | They sign up. Nothing else is sent until they confirm |
| Welcome | Reader | They confirm (once) |
| The morning email | Confirmed subscribers | An administrator sends it from **Email**. Each reader gets the trends for their own country |
| Correction received / outcome | Reader who left an address | They report; then when an editor marks it Corrected or No change needed, with the editor's note |
| Offer enquiry received | Reader | They ask about an advertiser offer |
| New correction / new enquiry | Newsroom | Every report and enquiry |
| Account created | New member of staff | An administrator adds them. The first password is never emailed |
| Password changed | Member of staff | Every time their password changes |

### If email lands in spam

Open **Email** in the dashboard: the **Inbox or spam** panel looks up your sending domain's records and says what
to fix. The usual causes, most likely first:

1. **No DMARC record.** Resend only asks for SPF and DKIM, but Gmail and Yahoo expect DMARC too. At your DNS host
   add a TXT record named `_dmarc.yourdomain` with value `v=DMARC1; p=none; rua=mailto:you@yourdomain`.
2. **Links go to a different domain than the sender.** If email comes from `news@yourdomain` but links point to
   `…up.railway.app`, filters read it as phishing. Give `web` a custom domain on the same domain and put it first
   in `SITE_ORIGIN`.
3. **A new domain.** Providers trust a sender only after some weeks of wanted email. Send to real sign-ups, start
   small, and ask early readers to move the email to their inbox and reply once.
4. **No webhook.** Without `RESEND_WEBHOOK_SECRET`, bounced addresses and people who pressed “spam” keep getting
   email, which damages the domain.
5. **Tracking turned on in Resend.** Open and click tracking rewrite links through another domain. Leave both off
   in Resend's domain settings (the app does not use them).

## Search engines (SEO)

Nothing to set: `web` asks `api` for each page's title, description, keywords and structured data, and serves
`/robots.txt`, `/sitemap.xml`, `/news-sitemap.xml` and `/feed.xml` from it. Two things to do once you are live:

1. Put your real domain **first** in `SITE_ORIGIN` on `api`. Canonical addresses, the sitemap and share links
   are all built from it. While it is the `…up.railway.app` address, that is what search engines will index.
2. Add the site in **Google Search Console** and **Bing Webmaster Tools**, verify it, and submit
   `https://YOUR-DOMAIN/sitemap.xml` and `https://YOUR-DOMAIN/news-sitemap.xml`.

## Prices in the reader's currency

Advertiser prices are in US dollars and are shown in the currency of the reader's country, marked as approximate,
with the dollar price beside them. The `api` service fetches exchange rates twice a day from open.er-api.com
(free, no key; it needs outbound internet, which Railway services have) and keeps them in Redis. If the source
cannot be reached a built-in table is used and the site says the rate is indicative. Set `RATES_URL=off` to
use only the built-in table, or to another URL that returns `{ "rates": { "RWF": 1450, … } }` for a base of USD.

## Country trends and where the reader is

`GET /api/v1/trends?country=RW` answers with three lists: the country, its region, and global. The site asks for
the reader's country and shows them in that order.

Railway does **not** tell the app which country a visitor is in. So, on Railway alone, the site works it out from
the device's time zone, and the reader can change it. For detection by network address, put **Cloudflare** in
front of the `web` domain (proxied, orange cloud): it adds a `CF-IPCountry` header, which the API reads at
`/api/v1/geo` and uses to label readership by country. Nothing else needs to be set.

A country's own list fills in as readers there (who allowed measurement) open stories, and as editors tag
stories with the countries they are about (the **Countries** field in the dashboard's story form).

## Your own domains

1. On `web`: Settings → Networking → **Custom Domain** → `mirroractu.net` (and `www` if you want). Add the DNS record Railway shows.
2. On `admin`: the same, with `desk.mirroractu.net` (or the name you chose).
3. On `api`, update the two origins so both the Railway and the custom addresses are accepted (comma separated), then redeploy `api`:

   ```
   SITE_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}},https://mirroractu.net
   ADMIN_ORIGIN=https://${{admin.RAILWAY_PUBLIC_DOMAIN}},https://desk.mirroractu.net
   ```

4. On `admin`, set `VITE_SITE_URL=https://mirroractu.net` and redeploy (it is used at build time).

If you skip step 3, sign-in and the reader forms are refused from the custom addresses.

## Check that it is locked

Replace the addresses with yours. Each line says what you should get.

```
# The public site has no dashboard and no sign-in
curl -s -o /dev/null -w '%{http_code}\n' https://SITE/api/v1/auth/me            # 404
curl -s -o /dev/null -w '%{http_code}\n' https://SITE/api/v1/admin/overview     # 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://SITE/api/v1/auth/login \
     -H 'Content-Type: application/json' -d '{"email":"x","password":"y"}'      # 404

# The public API still works
curl -s -o /dev/null -w '%{http_code}\n' https://SITE/api/v1/bootstrap          # 200

# The dashboard answers, and refuses a sign-in that claims to come from elsewhere
curl -s -o /dev/null -w '%{http_code}\n' https://DESK/healthz                   # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://DESK/api/v1/auth/login \
     -H 'Content-Type: application/json' -H 'Origin: https://SITE' \
     -d '{"email":"x","password":"y"}'                                          # 403
```

Also open `https://SITE/admin` in a browser: it should be the site's "Not found" page.

## All variables in one place

### `api`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `APP_TARGET` | Yes | | `api` |
| `DATABASE_URL` | Yes | | Postgres connection |
| `REDIS_URL` | Recommended | | Redis connection. Without it the API caches in its own memory |
| `RESEND_API_KEY` | For email | | Resend API key. Without it no email is sent |
| `MAIL_FROM` | For email | Resend test sender | Sender on your verified domain: `MirrorActu <news@yourdomain>` |
| `MAIL_REPLY_TO` | No | `MAIL_FROM` | Where replies go |
| `MAIL_NEWSROOM_TO` | No | administrators | Who hears about new corrections and enquiries |
| `MAIL_POSTAL_ADDRESS` | Before sending newsletters | | Publisher's postal address in the newsletter footer |
| `RESEND_WEBHOOK_SECRET` | Recommended | | Signing secret of the Resend webhook |
| `RATES_URL` | No | open.er-api.com | Exchange-rate source, or `off` |
| `NODE_ENV` | Yes | | `production` |
| `PORT` | Yes on Railway | `4000` | Port to listen on |
| `SITE_ORIGIN` | Yes | | Public site address(es), comma separated |
| `ADMIN_ORIGIN` | Yes | | Dashboard address(es), comma separated |
| `ADMIN_GATEWAY_KEY` | Yes | | Secret shared with `admin` |
| `ANALYTICS_SALT` | Yes | | Anonymises readership |
| `ADMIN_EMAILS` | First deploy | | Administrators to create |
| `ADMIN_PASSWORD` | With the lists | | First password for created accounts |
| `EDITOR_EMAILS` | No | | Editors to create |
| `ADMIN_FORCE_RESET` | No | | `true` puts listed accounts back on `ADMIN_PASSWORD`. For lockouts. Remove afterwards |
| `SESSION_DAYS` | No | `7` | How long a sign-in lasts |
| `LOGIN_MAX_FAILS` | No | `5` | Wrong passwords before a lock |
| `LOGIN_LOCK_MINUTES` | No | `15` | Length of the lock |
| `RATE_LIMIT_PER_MINUTE` | No | `300` | Requests per address per minute |
| `EVENTS_RETENTION_DAYS` | No | `90` | How long readership events are kept |
| `SEED_CONTENT` | No | `true` | `false` starts with an empty site instead of the 38 sample stories |
| `LOG_LEVEL` | No | `info` | `fatal`, `error`, `warn`, `info`, `debug` |

### `web`

| Variable | Required | Purpose |
|---|---|---|
| `API_UPSTREAM` | Yes | Private address of `api` |
| `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT_LEADERBOARD`, `VITE_ADSENSE_SLOT_MPU`, `VITE_ADSENSE_SLOT_HALFPAGE`, `VITE_ADSENSE_SLOT_INFEED` | No | Google display adverts |
| `VITE_IMA_AD_TAG` | No | Google video advert tag |
| `VITE_GEO_ENDPOINT` | No | Country lookup URL |

The `VITE_…` values are used while building, so changing one rebuilds the service.

### `admin`

| Variable | Required | Purpose |
|---|---|---|
| `APP_TARGET` | Yes | `admin` |
| `API_UPSTREAM` | Yes | Private address of `api` |
| `ADMIN_GATEWAY_KEY` | Yes | `${{api.ADMIN_GATEWAY_KEY}}` |
| `VITE_SITE_URL` | Optional | The public site's address, for the dashboard's "View the site" links. Used while building |

## If something does not work

| What you see | Likely cause |
|---|---|
| The `api` service's log shows `MirrorActu starting as: site`, `nginx` lines and `api could not be resolved`, and its health check fails | `APP_TARGET=api` is not set on that service, so it started as the website. Add the variable and redeploy. A correct API log starts `MirrorActu starting as: api` and ends `MirrorActu API listening on :4000` |
| `web` or `admin` log says `api could not be resolved` | `API_UPSTREAM` is not set on that service, so it is using the Docker default `http://api:4000`. Set it to `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |
| `api` crashes on start with "Cannot start: …" | A required variable is missing or too short. The log lists which |
| Site loads but shows the built-in sample edition and the wire says "Simulated" | `web` cannot reach `api`. Check `API_UPSTREAM` on `web`, and `PORT=4000` on `api` |
| Dashboard sign-in says "Not found" or nothing happens | `ADMIN_GATEWAY_KEY` on `admin` does not match `api`, or `API_UPSTREAM` is wrong on `admin` |
| Dashboard sign-in says "Request did not come from the MirrorActu dashboard" | The address in the browser is not in `ADMIN_ORIGIN` on `api` (common after adding a custom domain) |
| Reader forms say "Request did not come from the MirrorActu site" | The site's address is not in `SITE_ORIGIN` on `api` |
| The dashboard shows the public site, or the site shows the dashboard | `APP_TARGET` is wrong on that service: `admin` for the dashboard, unset or `site` for the public site, `api` for the API. The first log line shows what it started as |
| "Wrong email or password" for a brand-new account | The account already existed, so `ADMIN_PASSWORD` was not applied. Use `ADMIN_FORCE_RESET=true` once |
| Locked out completely | Set `ADMIN_FORCE_RESET=true` on `api`, redeploy, sign in with `ADMIN_PASSWORD`, then remove the variable |

## Stronger locks, if you want them later

The setup above keeps the dashboard off the public site and behind a key, an origin check and a password.
The dashboard's address is still reachable by anyone who learns it, where they meet the sign-in page. To close that too:

- Put **Cloudflare Access** (or another identity-aware proxy) in front of the dashboard's domain, so only named
  email addresses even reach the sign-in page.
- Or restrict the dashboard's domain to your office or VPN addresses at the DNS/CDN layer.

Not built yet, and worth knowing: two-factor sign-in, password reset by email, and an email service for subscribers.
