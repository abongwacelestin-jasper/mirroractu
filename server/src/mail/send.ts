/**
 * Sending email through Resend (https://resend.com), over its HTTP API.
 *
 * Every attempt is written to the `emails` table: what kind of email, to whom, and whether
 * Resend accepted it. Bodies are not stored. Without RESEND_API_KEY nothing leaves the server.
 * Sending never throws: a form must not fail because an email could not be sent.
 */
import { config } from '../config'
import { q } from '../db'
import { publish } from '../bus'

export type Mail = { subject: string; html: string; text: string }
export type Outgoing = { to: string; kind: string; mail: Mail; headers?: Record<string, string>; replyTo?: string }

export const mailConfigured = () => !!config.resendApiKey
export const siteUrl = () => config.siteOrigins[0] ?? 'http://localhost:8080'
export const deskUrl = () => config.adminOrigins[0] ?? 'http://localhost:8081'

const payload = (m: Outgoing) => ({
  from: config.mailFrom,
  to: [m.to],
  subject: m.mail.subject,
  html: m.mail.html,
  text: m.mail.text,
  ...(m.replyTo || config.mailReplyTo ? { reply_to: m.replyTo || config.mailReplyTo } : {}),
  ...(m.headers ? { headers: m.headers } : {}),
  tags: [{ name: 'kind', value: m.kind.replace(/[^a-zA-Z0-9_-]/g, '_') }],
})

async function record(m: Outgoing, status: 'sent' | 'failed' | 'not_configured', providerId?: string, error?: string) {
  await q('INSERT INTO emails (kind, recipient, subject, status, provider_id, error) VALUES ($1, $2, $3, $4, $5, $6)', [m.kind, m.to, m.mail.subject.slice(0, 300), status, providerId ?? null, error?.slice(0, 500) ?? null]).catch(() => {})
  publish('mail')
}

async function resend(path: string, body: unknown): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://api.resend.com${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const data: any = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: `${res.status} ${data?.message ?? data?.name ?? res.statusText}` }
    return { ok: true, data }
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'Resend did not answer in 15 seconds' : String(e?.message ?? e) }
  }
}

function notConfigured(m: Outgoing) {
  if (!config.production) {
    const link = m.mail.text.match(/https?:\/\/\S+/)?.[0]
    console.log(`Mail not sent (RESEND_API_KEY is not set): ${m.kind} to ${m.to}: "${m.mail.subject}"${link ? `\n  first link: ${link}` : ''}`)
  }
  return record(m, 'not_configured')
}

/** Send one email. Resolves to whether Resend accepted it. */
export async function sendMail(m: Outgoing): Promise<boolean> {
  if (!mailConfigured()) {
    await notConfigured(m)
    return false
  }
  const r = await resend('/emails', payload(m))
  if (r.ok) await record(m, 'sent', r.data?.id)
  else {
    console.warn(`Mail failed: ${m.kind}: ${r.error}`)
    await record(m, 'failed', undefined, r.error)
  }
  return r.ok
}

/** Send without waiting. For forms: the reader gets their answer at once. */
export const sendLater = (m: Outgoing) => void sendMail(m).catch(() => {})

/**
 * Send many emails, 100 per request (Resend's batch limit), pausing between requests to stay
 * inside its rate limit. Returns how many were accepted and how many were not.
 */
export async function sendMany(all: Outgoing[], onProgress?: (sent: number, failed: number) => Promise<void> | void) {
  let sent = 0
  let failed = 0
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100)
    if (!mailConfigured()) {
      for (const m of chunk) await notConfigured(m)
      failed += chunk.length
    } else {
      const r = await resend('/emails/batch', chunk.map(payload))
      if (r.ok) {
        const ids: any[] = r.data?.data ?? []
        await Promise.all(chunk.map((m, n) => record(m, 'sent', ids[n]?.id)))
        sent += chunk.length
      } else {
        console.warn(`Mail batch failed: ${r.error}`)
        await Promise.all(chunk.map((m) => record(m, 'failed', undefined, r.error)))
        failed += chunk.length
      }
      if (i + 100 < all.length) await new Promise((r) => setTimeout(r, 600))
    }
    await onProgress?.(sent, failed)
  }
  return { sent, failed }
}

/** Who is told about new corrections and enquiries. */
export async function newsroomAddresses(): Promise<string[]> {
  if (config.mailNewsroomTo.length) return config.mailNewsroomTo
  return (await q<{ email: string }>("SELECT email FROM users WHERE role = 'admin' AND NOT disabled ORDER BY id LIMIT 10")).map((r) => r.email)
}
