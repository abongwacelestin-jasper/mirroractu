/**
 * Sign-in for dashboard staff.
 *
 *  - Passwords are hashed with scrypt and a random salt. The password itself is never stored.
 *  - A session is a random 256-bit token in an httpOnly cookie; the database keeps only its
 *    SHA-256 hash, so a copy of the database cannot be used to sign in.
 *  - Five wrong passwords lock the account for fifteen minutes.
 *  - Sign-in and the dashboard are only reachable through the dashboard's own web server,
 *    which is a different address from the public site (see throughAdminGateway).
 *  - Requests that change data must come from the dashboard's address (Origin check) and carry
 *    the session cookie, which browsers do not send on cross-site form posts (SameSite=Strict).
 */
import { publish } from './bus'
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { config } from './config'
import { one, q } from './db'

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>
export const COOKIE = 'ma_session'

export type User = { id: number; email: string; name: string; role: 'admin' | 'editor'; mustChangePassword: boolean }

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, key] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(expected, actual)
}

const toUser = (row: any): User => ({ id: Number(row.id), email: row.email, name: row.name, role: row.role, mustChangePassword: !!row.must_change_password })

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Check an email and password. Returns the user, or a reason it failed. */
export async function login(email: string, password: string): Promise<{ user: User } | { error: string; status: number }> {
  const row = await one('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()])
  // Hash anyway when the user is unknown, so timing does not reveal which emails exist.
  if (!row) {
    await hashPassword(password)
    return { error: 'Wrong email or password.', status: 401 }
  }
  if (row.disabled) return { error: 'This account is switched off.', status: 403 }
  if (row.locked_until && new Date(row.locked_until) > new Date()) return { error: `Too many wrong passwords. Try again in ${config.loginLockMinutes} minutes.`, status: 429 }
  if (!(await verifyPassword(password, row.password_hash))) {
    const fails = row.failed_logins + 1
    await q('UPDATE users SET failed_logins = $2, locked_until = $3 WHERE id = $1', [row.id, fails >= config.loginMaxFails ? 0 : fails, fails >= config.loginMaxFails ? new Date(Date.now() + config.loginLockMinutes * 60000) : null])
    return { error: 'Wrong email or password.', status: 401 }
  }
  await q('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [row.id])
  return { user: toUser(row) }
}

export async function startSession(reply: FastifyReply, userId: number, userAgent?: string) {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + config.sessionDays * 86400000)
  await q('INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, $3, $4)', [sha256(token), userId, expires, userAgent?.slice(0, 300) ?? null])
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'strict', secure: config.production, expires })
}

export async function endSession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE]
  if (token) await q('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
  reply.clearCookie(COOKIE, { path: '/' })
}

export async function currentUser(req: FastifyRequest): Promise<User | null> {
  const token = req.cookies[COOKIE]
  if (!token) return null
  const row = await one(
    `SELECT u.id, u.email, u.name, u.role, u.must_change_password FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.disabled`,
    [sha256(token)]
  )
  return row ? toUser(row) : null
}

/**
 * True if a data-changing request came from the right website: the public site for reader
 * forms, the staff dashboard for sign-in and dashboard changes. The two are different addresses.
 */
export function sameOrigin(req: FastifyRequest, audience: 'site' | 'admin' = 'site') {
  const origin = (req.headers.origin ?? '').replace(/\/$/, '')
  if (origin) return (audience === 'admin' ? config.adminOrigins : config.siteOrigins).includes(origin)
  // No Origin header: allow only non-browser clients that say so explicitly.
  return req.headers['x-requested-with'] === 'mirroractu'
}

/**
 * The gate in front of sign-in and the dashboard API. Only the dashboard's own web server knows
 * ADMIN_GATEWAY_KEY and adds it to the requests it forwards; the public site's server strips
 * the header and refuses these paths outright. Anything arriving without the key is answered
 * "not found", exactly as if the route did not exist.
 */
export function throughAdminGateway(req: FastifyRequest) {
  if (!config.adminGatewayKey) return !config.production
  const given = Buffer.from(String(req.headers['x-admin-gateway-key'] ?? ''))
  const expected = Buffer.from(config.adminGatewayKey)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Route guard: signed in, optionally as an administrator. */
export function requireUser(role?: 'admin', allowPending = false) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== 'GET' && !sameOrigin(req, 'admin')) return reply.code(403).send({ error: 'Request did not come from the MirrorActu dashboard.' })
    const user = await currentUser(req)
    if (!user) return reply.code(401).send({ error: 'Sign in to continue.' })
    // An account still on its first, shared password can do nothing until it has its own.
    if (user.mustChangePassword && !allowPending) return reply.code(403).send({ error: 'Choose your own password first.', code: 'password_change_required' })
    if (role === 'admin' && user.role !== 'admin') return reply.code(403).send({ error: 'Administrators only.' })
    ;(req as any).user = user
  }
}

export const userOf = (req: FastifyRequest) => (req as any).user as User

export async function audit(user: User | null, action: string, target?: string, detail?: unknown) {
  // Every change staff make is also a nudge to the other open dashboards (see live.ts).
  publish(action.startsWith('user') ? 'staff' : action.startsWith('correction') || action.startsWith('enquir') ? 'inbox' : action.startsWith('subscriber') ? 'subscribers' : action.startsWith('newsletter') || action.startsWith('mail') ? 'mail' : action.startsWith('webtrends') ? 'engine' : action.startsWith('wire') ? 'wire.changed' : 'audit')
  await q('INSERT INTO audit_log (user_id, action, target, detail) VALUES ($1, $2, $3, $4)', [user?.id ?? null, action, target ?? null, detail ? JSON.stringify(detail) : null])
}

/**
 * Create staff accounts from the environment. Runs on every start and is safe to repeat:
 *
 *  - Anyone in ADMIN_EMAILS / EDITOR_EMAILS who has no account gets one, with ADMIN_PASSWORD as
 *    a first password that they must replace at their first sign-in.
 *  - Existing accounts are left alone: their passwords are never touched and a role is only
 *    ever raised (editor → admin), never lowered, so removing an address from the list does
 *    not lock anyone out or demote them. Switch accounts off in the dashboard instead.
 *  - ADMIN_FORCE_RESET=true puts the listed accounts back on ADMIN_PASSWORD, unlocked and
 *    switched on, and signs them out. It is the way back in when someone is locked out.
 */
export async function syncStaff() {
  if (!config.staff.length) {
    const { n } = (await one<{ n: string }>('SELECT count(*) AS n FROM users'))!
    if (Number(n) === 0) console.warn('No staff accounts exist. Set ADMIN_EMAILS and ADMIN_PASSWORD (12+ characters) and restart to create them.')
    return
  }
  const hash = await hashPassword(config.adminPassword)
  for (const s of config.staff) {
    const existing = await one('SELECT id, role FROM users WHERE email = $1', [s.email])
    if (!existing) {
      const row = await one('INSERT INTO users (email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, true) RETURNING id', [s.email, s.name, s.role, hash])
      await audit(null, 'user.created.from_env', String(row!.id), { email: s.email, role: s.role })
      console.log(`Created ${s.role} ${s.email} (must choose a password at first sign-in)`)
      continue
    }
    if (config.adminForceReset) {
      await q('UPDATE users SET password_hash = $2, must_change_password = true, disabled = false, failed_logins = 0, locked_until = NULL, role = CASE WHEN $3 = \'admin\' THEN \'admin\' ELSE role END WHERE id = $1', [existing.id, hash, s.role])
      await q('DELETE FROM sessions WHERE user_id = $1', [existing.id])
      await audit(null, 'user.reset.from_env', String(existing.id), { email: s.email })
      console.log(`Reset ${s.email} to the first password (ADMIN_FORCE_RESET). Remove ADMIN_FORCE_RESET now.`)
    } else if (s.role === 'admin' && existing.role !== 'admin') {
      await q("UPDATE users SET role = 'admin' WHERE id = $1", [existing.id])
      await audit(null, 'user.promoted.from_env', String(existing.id), { email: s.email })
      console.log(`Promoted ${s.email} to administrator`)
    }
  }
}

/** A visitor id that cannot be turned back into an IP address and changes every day. */
export function visitorHash(req: FastifyRequest) {
  const day = new Date().toISOString().slice(0, 10)
  return sha256(`${config.analyticsSalt}|${day}|${req.ip}|${req.headers['user-agent'] ?? ''}`).slice(0, 24)
}
