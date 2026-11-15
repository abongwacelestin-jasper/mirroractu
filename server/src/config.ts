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

const production = env.NODE_ENV === 'production'

export const config = {
  databaseUrl: env.DATABASE_URL ?? '',
  port: int('PORT', 4000),
  production,
  siteOrigins: (env.SITE_ORIGIN ?? 'http://localhost:5173,http://localhost:8080').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
  analyticsSalt: env.ANALYTICS_SALT ?? '',
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
  if (problems.length) {
    console.error('Cannot start:\n - ' + problems.join('\n - '))
    process.exit(1)
  }
}
