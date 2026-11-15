/**
 * Why email lands in spam is almost always about the sending domain, not the email itself.
 * This looks up the public DNS records mail providers check, and compares the sender's domain
 * with the domain the links point to, so the dashboard can say what is missing in plain words.
 * It only reads public DNS records for our own sending domain.
 */
import { resolveTxt } from 'node:dns/promises'

import { config } from '../config'
import { siteUrl } from './send'

export type Check = { id: string; label: string; /** true: fine. false: a problem. null: could not tell */ ok: boolean | null; detail: string; fix?: string }

const txt = async (name: string): Promise<string[] | null> => {
  try {
    return (await resolveTxt(name)).map((parts) => parts.join(''))
  } catch (e: any) {
    return e?.code === 'ENOTFOUND' || e?.code === 'ENODATA' ? [] : null
  }
}
/** a.b.example.com → [a.b.example.com, b.example.com, example.com] */
const parents = (domain: string) => domain.split('.').map((_, i, all) => all.slice(i).join('.')).filter((d) => d.split('.').length >= 2)
const shared = (host: string) => /(\.up\.railway\.app|\.vercel\.app|\.netlify\.app|\.onrender\.com|\.herokuapp\.com|^localhost)$/.test(host)

export async function deliverability(): Promise<{ domain: string; checks: Check[] }> {
  const address = (config.mailFrom.match(/<([^>]+)>/)?.[1] ?? config.mailFrom).trim().toLowerCase()
  const [local, domain = ''] = address.split('@')
  const siteHost = new URL(siteUrl()).hostname.toLowerCase()
  const checks: Check[] = []

  const own = !!domain && !domain.endsWith('resend.dev')
  checks.push({
    id: 'sender',
    label: 'Sending from your own domain',
    ok: own,
    detail: own ? `Sending as ${address}.` : 'Sending from Resend’s shared test address.',
    fix: own ? undefined : 'Verify your domain in Resend (Domains → Add domain) and set MAIL_FROM to an address on it, such as "MirrorActu <news@yourdomain>".',
  })
  if (!own) return { domain, checks }

  const dkim = await txt(`resend._domainkey.${domain}`)
  checks.push({
    id: 'dkim',
    label: 'DKIM signature',
    ok: dkim === null ? null : dkim.some((r) => r.includes('p=')),
    detail: dkim === null ? 'Could not look it up just now.' : dkim.some((r) => r.includes('p=')) ? `Found at resend._domainkey.${domain}. It proves the email really comes from ${domain}.` : `No DKIM record at resend._domainkey.${domain}.`,
    fix: dkim && !dkim.some((r) => r.includes('p=')) ? `In Resend, open Domains → ${domain} and add the DKIM record it shows at your DNS host. Without it most providers send your email to spam.` : undefined,
  })

  const spf = await txt(`send.${domain}`)
  const spfOk = spf?.some((r) => /^v=spf1/i.test(r)) ?? null
  checks.push({
    id: 'spf',
    label: 'SPF record',
    ok: spf === null ? null : spfOk ? true : null,
    detail: spf === null ? 'Could not look it up just now.' : spfOk ? `Found at send.${domain}.` : `None found at send.${domain}, where Resend normally puts it. If Resend shows this domain as “Verified”, you use a different return path and this is fine.`,
    fix: spf && !spfOk ? `Check that Domains → ${domain} in Resend says “Verified”. If not, add the SPF and MX records it lists.` : undefined,
  })

  let dmarc: string | undefined
  let dmarcAt = ''
  let failed = false
  for (const d of parents(domain)) {
    const r = await txt(`_dmarc.${d}`)
    if (r === null) failed = true
    const hit = r?.find((x) => /^v=DMARC1/i.test(x))
    if (hit) {
      dmarc = hit
      dmarcAt = d
      break
    }
  }
  const policy = dmarc?.match(/\bp=(\w+)/i)?.[1]?.toLowerCase()
  const root = parents(domain).at(-1)!
  checks.push({
    id: 'dmarc',
    label: 'DMARC policy',
    ok: dmarc ? true : failed ? null : false,
    detail: dmarc ? `Found at _dmarc.${dmarcAt} (policy: ${policy ?? 'not stated'}).` : failed ? 'Could not look it up just now.' : `No DMARC record for ${root}. Gmail and Yahoo treat senders without one as suspect, and this is the most common reason correctly signed email still lands in spam.`,
    fix: dmarc ? undefined : failed ? undefined : `At your DNS host add a TXT record. Name: _dmarc.${root}  Value: v=DMARC1; p=none; rua=mailto:${config.mailReplyTo || `dmarc@${root}`}   Start with p=none; move to p=quarantine after a few weeks of clean reports.`,
  })

  const sameFamily = siteHost === domain || siteHost.endsWith(`.${root}`) || siteHost === root
  checks.push({
    id: 'links',
    label: 'Links go to the same domain as the sender',
    ok: sameFamily,
    detail: sameFamily ? `Email links and the logo point to ${siteHost}, which belongs with ${domain}.` : `The email comes from ${domain} but every link and the logo point to ${siteHost}.${shared(siteHost) ? ' That is a shared hosting address used by many unrelated sites, which spam filters distrust.' : ''} A sender whose links lead somewhere else looks like phishing to a filter.`,
    fix: sameFamily ? undefined : `Give the public site an address on ${root} (for example www.${root}; see “Your own domains” in RAILWAY.md) and put it first in SITE_ORIGIN on the api service.`,
  })

  const robot = /^(no-?reply|do-?not-?reply|donotreply)/.test(local)
  checks.push({ id: 'address', label: 'A sender people can reply to', ok: !robot, detail: robot ? `“${local}@” tells providers nobody reads replies, which counts against you.` : `${address} can be replied to${config.mailReplyTo ? `, and replies go to ${config.mailReplyTo}` : ''}.`, fix: robot ? 'Use an address such as news@ or hello@, and make sure the mailbox exists.' : undefined })
  checks.push({ id: 'postal', label: 'Postal address in the newsletter', ok: !!config.mailPostalAddress, detail: config.mailPostalAddress ? 'Printed at the foot of the newsletter.' : 'Not set. Bulk email without a postal address is treated as more likely to be spam, and several countries require it.', fix: config.mailPostalAddress ? undefined : 'Set MAIL_POSTAL_ADDRESS on the api service.' })
  checks.push({ id: 'webhook', label: 'Bounces and complaints handled', ok: !!config.resendWebhookSecret, detail: config.resendWebhookSecret ? 'Bounced addresses and readers who press “spam” stop receiving email.' : 'Not connected. Writing again to dead addresses and to people who pressed “spam” quickly damages a domain’s reputation.', fix: config.resendWebhookSecret ? undefined : 'Add the Resend webhook and set RESEND_WEBHOOK_SECRET (see RAILWAY.md).' })
  return { domain, checks }
}
