/**
 * Create (or reset) one staff account from the command line and print a one-time password.
 *
 *   docker compose exec api node /opt/mirroractu/api/dist/create-admin.js ada@example.com "Ada Obi" admin
 *
 * The password is shown once and never stored in readable form. The person must choose
 * their own at first sign-in.
 */
import { randomBytes } from 'node:crypto'

import { audit, hashPassword } from './auth'
import { checkConfig } from './config'
import { migrate, one, pool, q, waitForDb } from './db'

const [email, name, role = 'admin'] = process.argv.slice(2)
if (!email || !/^\S+@\S+\.\S+$/.test(email) || !name || !['admin', 'editor'].includes(role)) {
  console.error('Usage: node dist/create-admin.js <email> "<name>" [admin|editor]')
  process.exit(1)
}

checkConfig()
await waitForDb()
await migrate()

const password = randomBytes(15).toString('base64url')
const hash = await hashPassword(password)
const address = email.trim().toLowerCase()
const existing = await one('SELECT id FROM users WHERE email = $1', [address])
if (existing) {
  await q('UPDATE users SET name = $2, role = $3, password_hash = $4, must_change_password = true, disabled = false, failed_logins = 0, locked_until = NULL WHERE id = $1', [existing.id, name, role, hash])
  await q('DELETE FROM sessions WHERE user_id = $1', [existing.id])
  await audit(null, 'user.reset.from_cli', String(existing.id), { email: address })
} else {
  const row = await one('INSERT INTO users (email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, true) RETURNING id', [address, name, role, hash])
  await audit(null, 'user.created.from_cli', String(row!.id), { email: address, role })
}

console.log(`\n${existing ? 'Reset' : 'Created'} ${role}: ${address}\nOne-time password: ${password}\nThey must choose their own password at first sign-in. This password is not shown again.\n`)
await pool.end()
