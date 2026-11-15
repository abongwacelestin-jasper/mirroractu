/**
 * Settings, all from environment variables. Nothing secret is written in the code.
 * `server/.env.example` lists every one with an explanation.
 *
 * Required
 *   DATABASE_URL          Postgres connection string
 *   SITE_ORIGIN           public address of the website (required in production). Requests that
 *                         change data must come from here. Several may be given, comma separated.
 *   ANALYTICS_SALT        long random string that anonymises readers (required in production)
 *   ADMIN_ORIGIN          public address of the staff dashboard, which is a separate website
 *                         (required in production). Sign-in and dashboard changes must come from here.
 *   ADMIN_GATEWAY_KEY     long random string shared only with the dashboard's web server (required
 *                         in production). Sign-in and dashboard requests without it get "not found",
 *                         so they cannot be reached through the public site or any other route.
 *
 * Caching
 *   REDIS_URL             Redis connection string. Optional: without it each API instance caches in
 *                         its own memory. With it, the cache and rate limits are shared.
 *
 * Email, sent through Resend (resend.com). Without RESEND_API_KEY nothing is sent: each email is
 * recorded as "not configured" and, outside production, its links are printed in the log.
 *   RESEND_API_KEY        API key from the Resend dashboard
 *   MAIL_FROM             sender, on a domain verified in Resend: "MirrorActu <news@mirroractu.net>"
 *   MAIL_REPLY_TO         where replies go (optional; defaults to the sender)
 *   MAIL_NEWSROOM_TO      who is told about new corrections and enquiries, comma separated
 *                         (optional; defaults to every administrator)
 *   MAIL_POSTAL_ADDRESS   the publisher's postal address, printed in the footer of the newsletter.
 *                         Anti-spam law in several countries requires one in marketing email.
 *   RESEND_WEBHOOK_SECRET signing secret of a Resend webhook pointed at /api/v1/hooks/resend.
 *                         With it, bounced addresses and spam complaints stop receiving email.
 *
 * Money
 *   RATES_URL             where exchange rates come from (JSON with a "rates" object, base USD).
 *                         Defaults to open.er-api.com. Set to "off" to use the built-in table only.
 *
 * Trending on the web (server/src/webtrends): Google Trends, GDELT and Wikimedia
 *   WEB_TRENDS            "off" stops all fetching. Lists already fetched stay until they age out.
 *   WEB_TRENDS_SOURCES    which sources to use, comma separated   (google,gdelt,wikimedia)
 *   WEB_TRENDS_USER_AGENT how the fetcher names itself to those services. Wikimedia asks for a
 *                         name with a way to reach you, e.g. "MirrorActu/1.0 (https://yourdomain)".
 *   WEB_TRENDS_BUDGET_GOOGLE / _GDELT / _WIKIMEDIA   most requests per day to each source
 *
 * Staff accounts, created automatically on every start (see auth.ts → syncStaff)
 *   ADMIN_EMAILS          administrators, comma separated: "Ada Obi <ada@x.com>, sam@x.com"
 *   EDITOR_EMAILS         editors, same format
 *   ADMIN_PASSWORD        first password given to accounts created this way (12+ characters).
 *                         Each person must choose their own at first sign-in.
 *   ADMIN_EMAIL           older single-administrator form; still honoured
 *   ADMIN_FORCE_RESET     "true" resets the listed accounts to ADMIN_PASSWORD on the next start.
 *                         For recovery when someone is locked out. Remove it afterwards.
 *
 * Tuning (all optional)
 *   PORT                  port to listen on                                   (4000)
 *   NODE_ENV              "production" turns on HTTPS-only cookies
 *   SESSION_DAYS          how long a sign-in lasts                            (7)
 *   LOGIN_MAX_FAILS       wrong passwords before an account locks             (5)
 *   LOGIN_LOCK_MINUTES    how long it stays locked                            (15)
 *   RATE_LIMIT_PER_MINUTE requests allowed per address per minute             (300)
 *   EVENTS_RETENTION_DAYS how long readership events are kept                 (90)
 *   SEED_CONTENT          "false" starts with an empty site instead of the snapshot  (true)
 *   LOG_LEVEL             fatal | error | warn | info | debug                 (info in production, warn otherwise)
 */
const env = process.env

const int = (name: string, fallback: number, min = 1) => {
  const n = Number(env[name])
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback
}
const flag = (name: string, fallback: boolean) => (env[name] === undefined || env[name] === '' ? fallback : /^(1|true|yes|on)$/i.test(env[name]!))

export type StaffEntry = { email: string; name: string; role: 'admin' | 'editor' }

/** "Ada Obi <ada@x.com>, sam@x.com" → [{ name: 'Ada Obi', email: 'ada@x.com' }, { name: 'Sam', email: 'sam@x.com' }] */
function staffList(value: string | undefined, role: StaffEntry['role']): StaffEntry[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/^(.*)<([^>]+)>$/)
      const email = (m ? m[2] : entry).trim().toLowerCase()
      const local = email.split('@')[0].replace(/[._-]+/g, ' ')
      const name = (m ? m[1].trim() : '') || local.replace(/\b\w/g, (c) => c.toUpperCase())
      return { email, name, role }
    })
    .filter((s) => /^\S+@\S+\.\S+$/.test(s.email))
}

/** name@domain.tld, or "Name <name@domain.tld>" */
const validEmail = (v: string | undefined) => /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test((v?.match(/<([^>]+)>/)?.[1] ?? v ?? '').trim())

const production = env.NODE_ENV === 'production'

export const config = {
  databaseUrl: env.DATABASE_URL ?? '',
  port: int('PORT', 4000),
  production,
  siteOrigins: (env.SITE_ORIGIN ?? 'http://localhost:5173,http://localhost:8080').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
  analyticsSalt: env.ANALYTICS_SALT ?? '',
  redisUrl: env.REDIS_URL ?? '',

  resendApiKey: env.RESEND_API_KEY ?? '',
  /** Resend's shared test sender only delivers to the Resend account's own address. */
  mailFrom: env.MAIL_FROM || 'MirrorActu <onboarding@resend.dev>',
  mailFromSet: !!env.MAIL_FROM,
  // A reply address that is not a real address makes Resend refuse every email, so one that
  // does not look right is left out (replies then go to the sender) and reported instead.
  mailReplyTo: validEmail(env.MAIL_REPLY_TO) ? env.MAIL_REPLY_TO!.trim() : '',
  mailReplyToRejected: env.MAIL_REPLY_TO && !validEmail(env.MAIL_REPLY_TO) ? env.MAIL_REPLY_TO.trim() : '',
  mailNewsroomTo: (env.MAIL_NEWSROOM_TO ?? '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^\S+@\S+\.\S+$/.test(s)),
  mailPostalAddress: (env.MAIL_POSTAL_ADDRESS ?? '').trim(),
  resendWebhookSecret: env.RESEND_WEBHOOK_SECRET ?? '',
  webTrends: !/^(off|false|0|no)$/i.test(env.WEB_TRENDS ?? ''),
  webTrendsSources: (env.WEB_TRENDS_SOURCES || 'google,gdelt,wikimedia').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  webTrendsUserAgent: env.WEB_TRENDS_USER_AGENT || 'news-trends-fetcher/1.0',
  webTrendsBudget: { google: int('WEB_TRENDS_BUDGET_GOOGLE', 1500), gdelt: int('WEB_TRENDS_BUDGET_GDELT', 1200), wikimedia: int('WEB_TRENDS_BUDGET_WIKIMEDIA', 200) } as Record<string, number>,
  ratesUrl: env.RATES_URL || 'https://open.er-api.com/v6/latest/USD',
  adminOrigins: (env.ADMIN_ORIGIN ?? 'http://localhost:8081,http://localhost:5173').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
  adminGatewayKey: env.ADMIN_GATEWAY_KEY ?? '',

  /** Everyone who should have an account. Administrators win if an address is in both lists. */
  staff: [...staffList([env.ADMIN_EMAILS, env.ADMIN_EMAIL].filter(Boolean).join(','), 'admin'), ...staffList(env.EDITOR_EMAILS, 'editor')].filter(
    (s, i, all) => all.findIndex((x) => x.email === s.email) === i
  ),
  adminPassword: env.ADMIN_PASSWORD ?? '',
  adminForceReset: flag('ADMIN_FORCE_RESET', false),

  sessionDays: int('SESSION_DAYS', 7),
  loginMaxFails: int('LOGIN_MAX_FAILS', 5),
  loginLockMinutes: int('LOGIN_LOCK_MINUTES', 15),
  rateLimitPerMinute: int('RATE_LIMIT_PER_MINUTE', 300, 10),
  eventsRetentionDays: int('EVENTS_RETENTION_DAYS', 90),
  seedContent: flag('SEED_CONTENT', true),
  logLevel: env.LOG_LEVEL || (production ? 'info' : 'warn'),
}

export function checkConfig() {
  const problems: string[] = []
  if (!config.databaseUrl) problems.push('DATABASE_URL is not set')
  if (config.production && !env.SITE_ORIGIN) problems.push('SITE_ORIGIN must be set in production')
  if (config.production && config.analyticsSalt.length < 16) problems.push('ANALYTICS_SALT must be set (16+ characters) in production')
  if (config.production && !env.ADMIN_ORIGIN) problems.push('ADMIN_ORIGIN must be set in production (the address of the staff dashboard)')
  if (config.production && config.adminGatewayKey.length < 32) problems.push('ADMIN_GATEWAY_KEY must be set (32+ characters) in production')
  if (config.production && config.adminOrigins.some((o) => config.siteOrigins.includes(o))) problems.push('ADMIN_ORIGIN must be a different address from SITE_ORIGIN')
  if (config.staff.length && config.adminPassword.length < 12) problems.push('ADMIN_PASSWORD needs at least 12 characters when ADMIN_EMAILS or EDITOR_EMAILS is set')
  if (config.production && /^(password|changeme|admin)/i.test(config.adminPassword)) problems.push('ADMIN_PASSWORD is too easy to guess')
  if (config.production && config.resendApiKey && !env.MAIL_FROM) console.warn('MAIL_FROM is not set: email is going out from Resend\'s test sender, which only reaches your own Resend address.')
  if (config.mailReplyToRejected) console.warn(`MAIL_REPLY_TO ("${config.mailReplyToRejected}") is not a valid email address and is being ignored. Replies will go to MAIL_FROM.`)
  if (config.resendApiKey && env.MAIL_FROM && !validEmail(env.MAIL_FROM)) console.warn(`MAIL_FROM ("${env.MAIL_FROM}") does not contain a valid email address. Resend will refuse to send.`)
  if (problems.length) {
    console.error('Cannot start:\n - ' + problems.join('\n - '))
    process.exit(1)
  }
}
