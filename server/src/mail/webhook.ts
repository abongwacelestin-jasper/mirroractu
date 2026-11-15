/**
 * Resend's webhook. When an address bounces for good, or a reader marks one of our emails as
 * spam, Resend posts here and we stop writing to that address. Without this, a list keeps
 * mailing dead and unwilling addresses, and mail providers start treating the sender as spam.
 *
 * Requests are signed (Resend uses Svix): the signature is checked against
 * RESEND_WEBHOOK_SECRET before anything is believed. Without the secret the route does not exist.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'

import { config } from '../config'
import { q } from '../db'

function signed(headers: Record<string, unknown>, body: string) {
  const id = String(headers['svix-id'] ?? '')
  const at = String(headers['svix-timestamp'] ?? '')
  const given = String(headers['svix-signature'] ?? '')
  if (!id || !at || !given) return false
  // Refuse anything older than five minutes, so a captured request cannot be replayed later.
  if (Math.abs(Date.now() / 1000 - Number(at)) > 300) return false
  const key = Buffer.from(config.resendWebhookSecret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${at}.${body}`).digest()
  return given.split(' ').some((part) => {
    const sig = Buffer.from(part.split(',')[1] ?? '', 'base64')
    return sig.length === expected.length && timingSafeEqual(sig, expected)
  })
}

export async function resendWebhook(app: FastifyInstance) {
  // The signature covers the exact bytes sent, so this route reads the body as text.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body))

  app.post('/hooks/resend', async (req, reply) => {
    if (!config.resendWebhookSecret) return reply.code(404).send({ error: 'Not found.' })
    const raw = typeof req.body === 'string' ? req.body : ''
    if (!signed(req.headers, raw)) return reply.code(401).send({ error: 'Bad signature.' })
    let event: any
    try {
      event = JSON.parse(raw)
    } catch {
      return reply.code(400).send({ error: 'Bad request.' })
    }
    const to: string[] = (Array.isArray(event?.data?.to) ? event.data.to : [event?.data?.to]).filter((x: unknown) => typeof x === 'string').map((x: string) => x.toLowerCase())
    if (to.length) {
      // A temporary bounce (full mailbox, server busy) is not a reason to drop someone.
      if (event.type === 'email.bounced' && event.data?.bounce?.type !== 'Transient') await q("UPDATE subscribers SET status = 'bounced' WHERE email = ANY($1)", [to])
      if (event.type === 'email.complained') await q("UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = now() WHERE email = ANY($1) AND status <> 'bounced'", [to])
    }
    return { ok: true }
  })
}
