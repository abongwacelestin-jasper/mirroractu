/**
 * Every email MirrorActu sends, in one place. Each function returns a subject, an HTML body
 * and a plain-text body with the same content.
 *
 * Built for email programs, not browsers: tables for layout, styles written on each element,
 * no scripts, no remote fonts required (Georgia and the system sans-serif are the fallbacks),
 * one small logo image. Everything a person typed is escaped before it goes in.
 */
import { config } from '../config'
import type { Mail } from './send'

const C = { ink: '#0e1424', ink2: '#1a2236', paper: '#f4f1ea', paper2: '#e9e4d8', signal: '#ff5a36', dew: '#f2b441', muted: '#4a5166', faint: '#8a93a6', rule: '#dedad0', mirror: '#aeb8c6', white: '#ffffff' }
const SANS = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif"
const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif"
const MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace"
const PUBLISHER = 'TheGoodMorningDewPub'

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const longDate = (d = new Date()) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Where links and the logo point. `assets` differs only in the dashboard preview. */
export type Site = { site: string; assets?: string }

/* ---------- Building blocks ---------- */

const p = (html: string, extra = '') => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};${extra}">${html}</p>`
const small = (html: string) => `<p style="margin:0 0 10px;font-family:${SANS};font-size:13.5px;line-height:1.55;color:${C.muted};">${html}</p>`
const kicker = (text: string, color = C.signal) => `<p style="margin:0 0 10px;font-family:${MONO};font-size:11px;line-height:1.4;letter-spacing:.14em;text-transform:uppercase;color:${color};">${esc(text)}</p>`
const h1 = (text: string) => `<h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:400;font-size:38px;line-height:1.06;letter-spacing:-.01em;color:${C.ink};">${text}</h1>`
const h2 = (text: string) => `<h2 style="margin:0 0 8px;font-family:${SANS};font-weight:800;font-size:20px;line-height:1.25;letter-spacing:-.02em;color:${C.ink};">${text}</h2>`
const rule = (space = 24) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:${space}px 0;"><tr><td style="border-top:1px solid ${C.rule};font-size:0;line-height:0;">&nbsp;</td></tr></table>`
const link = (href: string, text: string) => `<a href="${esc(href)}" style="color:${C.ink};text-decoration:underline;text-decoration-color:${C.signal};text-underline-offset:3px;font-weight:600;">${text}</a>`

/** A button that keeps its shape in Outlook too (a padded table cell, not a styled link alone). */
const button = (href: string, label: string, tone: 'ink' | 'signal' = 'ink') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td bgcolor="${tone === 'ink' ? C.ink : C.signal}" style="border-radius:999px;">` +
  `<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:700;line-height:1;color:${tone === 'ink' ? C.white : C.ink};text-decoration:none;border-radius:999px;">${esc(label)}</a>` +
  `</td></tr></table>`

/** A tinted box for the facts of a request: label / value rows. */
const facts = (rows: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;background:${C.paper};border-left:3px solid ${C.signal};">` +
  rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:${i === 0 ? 14 : 4}px 18px ${i === rows.length - 1 ? 14 : 4}px;font-family:${SANS};font-size:14.5px;line-height:1.5;color:${C.ink};">` +
        `<span style="display:block;font-family:${MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};">${esc(k)}</span>${v}</td></tr>`
    )
    .join('') +
  `</table>`

const quote = (text: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;"><tr><td style="padding:2px 0 2px 16px;border-left:3px solid ${C.rule};font-family:${SERIF};font-size:19px;line-height:1.45;color:${C.ink2};">${esc(text).replace(/\n/g, '<br>')}</td></tr></table>`

type Frame = {
  site: Site
  /** The grey line some inboxes show after the subject */
  preheader: string
  body: string
  /** One or two sentences: why this person got this email */
  why: string
  /** Extra footer links, e.g. unsubscribe */
  footerLinks?: [string, string][]
  /** Print the publisher's postal address (newsletters) */
  postal?: boolean
  /** Right side of the header, e.g. the date */
  stamp?: string
}

function frame(f: Frame): string {
  const assets = f.site.assets ?? f.site.site
  const links: [string, string][] = [...(f.footerLinks ?? []), ['How we work', `${f.site.site}/how-we-work`], ['Privacy', `${f.site.site}/legal`]]
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>MirrorActu</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=Instrument+Serif&display=swap');
  body { margin:0; padding:0; background:${C.paper}; -webkit-text-size-adjust:100%; }
  a { color:${C.ink}; }
  @media (max-width:620px) {
    .ma-pad { padding-left:22px !important; padding-right:22px !important; }
    .ma-h1 h1 { font-size:31px !important; }
    .ma-stamp { display:none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};font-size:1px;line-height:1px;">${esc(f.preheader)}${'&nbsp;&zwnj;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background:${C.paper};">
<tr><td align="center" style="padding:28px 12px 36px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
    <tr><td bgcolor="${C.ink}" class="ma-pad" style="background:${C.ink};padding:22px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle">
          <a href="${esc(f.site.site)}" style="text-decoration:none;">
            <img src="${esc(assets)}/icons/icon-192.png" width="34" height="34" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:8px;margin-right:10px;">
            <span style="vertical-align:middle;font-family:${SANS};font-size:24px;font-weight:800;letter-spacing:-.035em;color:${C.white};">Mirror<span style="color:${C.signal};">Actu</span></span>
          </a>
        </td>
        <td valign="middle" align="right" class="ma-stamp" style="font-family:${MONO};font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.mirror};">${esc(f.stamp ?? 'Today, reflected')}</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="${C.signal}" style="background:${C.signal};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td bgcolor="${C.white}" class="ma-pad ma-h1" style="background:${C.white};padding:38px 36px 22px;">
${f.body}
    </td></tr>
    <tr><td class="ma-pad" style="padding:24px 36px 0;">
      <p style="margin:0 0 10px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">${f.why}</p>
      <p style="margin:0 0 10px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">${links.map(([label, href]) => `<a href="${esc(href)}" style="color:${C.muted};text-decoration:underline;">${esc(label)}</a>`).join(' &nbsp;·&nbsp; ')}</p>
      <p style="margin:0;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.faint};">MirrorActu is a news and live-information service from ${PUBLISHER}.${f.postal && config.mailPostalAddress ? `<br>${esc(config.mailPostalAddress)}` : ''}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

/** The plain-text twin: paragraphs separated by blank lines, then the same footer. */
function plain(lines: (string | false | undefined)[], why: string, footer: [string, string][] = [], postal = false) {
  return [
    'MIRRORACTU',
    '',
    ...lines.filter((l): l is string => typeof l === 'string'),
    '',
    '--',
    why,
    ...footer.map(([label, href]) => `${label}: ${href}`),
    `MirrorActu is a news and live-information service from ${PUBLISHER}.`,
    ...(postal && config.mailPostalAddress ? [config.mailPostalAddress] : []),
  ].join('\n')
}

/* ---------- The morning email: sign-up ---------- */

export function confirmSubscription(s: Site, confirmUrl: string): Mail {
  const why = 'You are getting this because this address was entered in the sign-up form on MirrorActu. If that was not you, ignore this email: without the confirmation, nothing more will be sent.'
  return {
    subject: 'Confirm your MirrorActu morning email',
    html: frame({
      site: s,
      preheader: 'One tap to confirm, and the first edition arrives tomorrow morning.',
      why,
      body:
        kicker('One step left') +
        h1('Confirm your address,<br>and we will see you in the morning.') +
        p('You asked for the MirrorActu morning email. Confirm that this address is yours and we will start sending it.') +
        button(confirmUrl, 'Confirm my address', 'signal') +
        facts([
          ['What you will get', 'One email a day: what happened, what is confirmed, what is not known yet, and why it matters.'],
          ['What it costs', 'Nothing. It is free.'],
          ['How to stop', 'Every edition has a one-tap unsubscribe link.'],
        ]) +
        small(`If the button does not work, copy this address into your browser:<br><span style="word-break:break-all;color:${C.ink};">${esc(confirmUrl)}</span>`) +
        small('The link works for this address only. We never sell or share email addresses.'),
    }),
    text: plain(
      ['Confirm your address, and we will see you in the morning.', '', 'You asked for the MirrorActu morning email. Open this link to confirm that this address is yours:', confirmUrl, '', 'What you will get: one email a day with what happened, what is confirmed, what is not known yet, and why it matters. It is free, and every edition has a one-tap unsubscribe link.'],
      why
    ),
  }
}

export type StoryLine = { h: string; st: string; url: string; section: string }

export function welcome(s: Site, o: { unsubscribeUrl: string; stories: StoryLine[] }): Mail {
  const why = 'You are getting this because you confirmed your address for the MirrorActu morning email.'
  return {
    subject: 'You are in. Here is how MirrorActu works',
    html: frame({
      site: s,
      preheader: 'Your first edition arrives tomorrow morning. Here is what to expect.',
      why,
      footerLinks: [['Unsubscribe', o.unsubscribeUrl]],
      postal: true,
      body:
        kicker('Welcome') +
        h1('You are in.') +
        p('Your address is confirmed. The morning email starts with the next edition.') +
        h2('How every story is built') +
        facts([
          ['What happened', 'The event, in plain words, before any opinion about it.'],
          ['What we know', 'Facts that are confirmed, each with its source.'],
          ['What we do not know', 'Open questions, stated as open. We do not guess.'],
          ['Why it matters', 'What changes for you, your work or your country.'],
        ]) +
        (o.stories.length
          ? h2('On the front page now') +
            o.stories
              .map((x) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:1.45;color:${C.ink};"><span style="display:block;font-family:${MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${C.signal};">${esc(x.section)}</span><a href="${esc(x.url)}" style="color:${C.ink};font-weight:700;text-decoration:none;">${esc(x.h)}</a></p>`)
              .join('') +
            button(s.site, 'Open MirrorActu')
          : button(s.site, 'Open MirrorActu')) +
        small(`Seen something wrong in a story? Every story has a “Report a correction” link, and we answer each report. ${link(`${s.site}/how-we-work`, 'How we work')}.`),
    }),
    text: plain(
      ['You are in.', '', 'Your address is confirmed. The morning email starts with the next edition.', '', 'How every story is built:', '- What happened: the event, in plain words.', '- What we know: confirmed facts, each with its source.', '- What we do not know: open questions, stated as open.', '- Why it matters: what changes for you.', '', ...(o.stories.length ? ['On the front page now:', ...o.stories.map((x) => `- ${x.h}\n  ${x.url}`), ''] : []), `Open MirrorActu: ${s.site}`],
      why,
      [['Unsubscribe', o.unsubscribeUrl]],
      true
    ),
  }
}

/* ---------- The morning email: an edition ---------- */

export type EditionStory = StoryLine & { what: string; why: string; ok: string[]; un: string[] }
export type Edition = {
  subject: string
  intro?: string
  stories: EditionStory[]
  /** "Trending in Rwanda" and so on: the nearest level we have for this reader */
  trendsTitle: string
  trends: { label: string; note: string }[]
  unsubscribeUrl: string
}

export function newsletter(s: Site, e: Edition): Mail {
  const [lead, ...rest] = e.stories
  const why = 'You are getting this because you confirmed your address for the MirrorActu morning email. One email a day, free.'
  const list = (items: string[], color: string) =>
    items
      .map((t) => `<tr><td valign="top" style="padding:0 10px 8px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${color};">●</td><td valign="top" style="padding:0 0 8px;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.ink};">${esc(t)}</td></tr>`)
      .join('')
  const leadHtml = lead
    ? kicker(lead.section) +
      `<h1 style="margin:0 0 12px;font-family:${SERIF};font-weight:400;font-size:38px;line-height:1.06;letter-spacing:-.01em;"><a href="${esc(lead.url)}" style="color:${C.ink};text-decoration:none;">${esc(lead.h)}</a></h1>` +
      p(esc(lead.st), `font-size:18px;color:${C.muted};`) +
      p(esc(lead.what)) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="padding:16px 18px 8px;background:${C.paper};border-left:3px solid ${C.ink};">` +
      `<p style="margin:0 0 10px;font-family:${MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};">What we know</p>` +
      `<table role="presentation" cellpadding="0" cellspacing="0">${list(lead.ok.slice(0, 3), C.ink)}</table>` +
      (lead.un.length ? `<p style="margin:8px 0 10px;font-family:${MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};">Not known yet</p><table role="presentation" cellpadding="0" cellspacing="0">${list(lead.un.slice(0, 2), C.signal)}</table>` : '') +
      `</td></tr></table>` +
      p(`<b>Why it matters.</b> ${esc(lead.why)}`) +
      button(lead.url, 'Read the full story')
    : ''
  const restHtml = rest.length
    ? rule(6) +
      kicker('Also today', C.muted) +
      rest
        .map(
          (x, i) =>
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>` +
            `<td valign="top" width="44" style="font-family:${SERIF};font-size:34px;line-height:1;color:${C.signal};">${i + 2}</td>` +
            `<td valign="top"><p style="margin:0 0 4px;font-family:${MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};">${esc(x.section)}</p>` +
            `<p style="margin:0 0 5px;font-family:${SANS};font-size:18px;font-weight:800;line-height:1.25;letter-spacing:-.02em;"><a href="${esc(x.url)}" style="color:${C.ink};text-decoration:none;">${esc(x.h)}</a></p>` +
            `<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.muted};">${esc(x.why)}</p></td></tr></table>`
        )
        .join('')
    : ''
  const trendsHtml = e.trends.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 22px;"><tr><td bgcolor="${C.ink}" style="background:${C.ink};padding:22px 22px 12px;">` +
      `<p style="margin:0 0 14px;font-family:${MONO};font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.dew};">${esc(e.trendsTitle)}</p>` +
      e.trends
        .map(
          (t, i) =>
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr>` +
            `<td valign="top" width="30" style="font-family:${MONO};font-size:13px;line-height:1.5;color:${C.signal};">${String(i + 1).padStart(2, '0')}</td>` +
            `<td valign="top" style="font-family:${SANS};font-size:16px;line-height:1.4;font-weight:700;color:${C.white};">${esc(t.label)}<span style="display:block;font-weight:400;font-size:13px;color:${C.mirror};">${esc(t.note)}</span></td></tr></table>`
        )
        .join('') +
      `<p style="margin:6px 0 10px;font-family:${SANS};font-size:14px;"><a href="${esc(s.site)}/trends" style="color:${C.white};font-weight:700;text-decoration:underline;text-decoration-color:${C.signal};text-underline-offset:3px;">See all of today’s trends</a></p>` +
      `</td></tr></table>`
    : ''
  return {
    subject: e.subject,
    html: frame({
      site: s,
      preheader: lead ? `${lead.st}${rest.length ? ` Plus ${rest.length} more ${rest.length === 1 ? 'story' : 'stories'}.` : ''}` : e.subject,
      why,
      stamp: longDate(),
      footerLinks: [['Unsubscribe', e.unsubscribeUrl]],
      postal: true,
      body: (e.intro ? p(esc(e.intro).replace(/\n/g, '<br>'), `font-family:${SERIF};font-size:20px;line-height:1.45;color:${C.ink2};`) + rule(4) + '<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>' : '') + leadHtml + restHtml + trendsHtml + small(`Something wrong in a story? Open it and use “Report a correction”. We answer every report.`),
    }),
    text: plain(
      [
        `The morning email, ${longDate()}`,
        '',
        ...(e.intro ? [e.intro, ''] : []),
        ...(lead ? [`${lead.section.toUpperCase()}: ${lead.h}`, lead.st, '', lead.what, '', 'What we know:', ...lead.ok.slice(0, 3).map((t) => `- ${t}`), ...(lead.un.length ? ['Not known yet:', ...lead.un.slice(0, 2).map((t) => `- ${t}`)] : []), '', `Why it matters: ${lead.why}`, `Read it: ${lead.url}`, ''] : []),
        ...(rest.length ? ['ALSO TODAY', ...rest.flatMap((x, i) => [`${i + 2}. ${x.h}`, `   ${x.why}`, `   ${x.url}`]), ''] : []),
        ...(e.trends.length ? [e.trendsTitle.toUpperCase(), ...e.trends.map((t, i) => `${i + 1}. ${t.label} (${t.note})`), `${s.site}/trends`] : []),
      ],
      why,
      [['Unsubscribe', e.unsubscribeUrl]],
      true
    ),
  }
}

/* ---------- Corrections ---------- */

export function correctionReceived(s: Site, o: { ref: string; storyTitle?: string }): Mail {
  const why = 'You are getting this because this address was given with a correction report on MirrorActu. If that was not you, you can ignore this email.'
  return {
    subject: `We have your correction report (${o.ref})`,
    html: frame({
      site: s,
      preheader: 'An editor will check it against the sources. Here is what happens next.',
      why,
      body:
        kicker('Correction report received') +
        h1('Thank you. An editor will check it.') +
        p('Your report reached the newsroom. This is what happens now.') +
        facts([
          ['Reference', `<b>${esc(o.ref)}</b>`],
          ...(o.storyTitle ? ([['Story', esc(o.storyTitle)]] as [string, string][]) : []),
          ['1. We check', 'An editor compares the story with its sources and with what you sent.'],
          ['2. We correct, in the open', 'If the story is wrong it is corrected, and the correction is noted on the story with the date.'],
          ['3. We tell you', 'You get one more email with the outcome, whichever way it goes.'],
        ]) +
        small(`Our corrections policy is part of ${link(`${s.site}/how-we-work`, 'How we work')}. To add something to your report, reply to this email and quote the reference.`),
    }),
    text: plain(['Thank you. An editor will check it.', '', `Reference: ${o.ref}`, o.storyTitle && `Story: ${o.storyTitle}`, '', '1. We check: an editor compares the story with its sources and with what you sent.', '2. We correct, in the open: if the story is wrong it is corrected and the correction is noted on the story.', '3. We tell you: you get one more email with the outcome.', '', `Our corrections policy: ${s.site}/how-we-work`], why),
  }
}

export function correctionOutcome(s: Site, o: { ref: string; storyTitle?: string; outcome: 'corrected' | 'no_change'; note?: string }): Mail {
  const corrected = o.outcome === 'corrected'
  const why = 'You are getting this because you gave this address with a correction report on MirrorActu. This is our answer, and the last email about it.'
  return {
    subject: corrected ? `We corrected the story (${o.ref})` : `Our answer to your correction report (${o.ref})`,
    html: frame({
      site: s,
      preheader: corrected ? 'You were right. The story has been corrected.' : 'We checked the story against its sources. Here is what we found.',
      why,
      body:
        kicker(corrected ? 'Corrected' : 'Checked: no change', corrected ? C.signal : C.muted) +
        h1(corrected ? 'You were right. The story is corrected.' : 'We checked. The story stands.') +
        p(corrected ? 'An editor checked your report against the sources and changed the story. The correction is noted on the story itself, so every reader can see what changed.' : 'An editor checked your report against the sources and found the story accurate as published, so it has not been changed.') +
        facts([['Reference', `<b>${esc(o.ref)}</b>`], ...(o.storyTitle ? ([['Story', esc(o.storyTitle)]] as [string, string][]) : [])]) +
        (o.note ? kicker('From the editor', C.muted) + quote(o.note) : '') +
        p(corrected ? 'Thank you for taking the time. Reports like yours are how the record gets better.' : 'If you have a source that shows otherwise, reply to this email with it and we will look again.') +
        small(`How we handle corrections: ${link(`${s.site}/how-we-work`, 'How we work')}.`),
    }),
    text: plain(
      [corrected ? 'You were right. The story is corrected.' : 'We checked. The story stands.', '', `Reference: ${o.ref}`, o.storyTitle && `Story: ${o.storyTitle}`, '', corrected ? 'An editor checked your report against the sources and changed the story. The correction is noted on the story itself.' : 'An editor checked your report against the sources and found the story accurate as published.', o.note && `\nFrom the editor:\n${o.note}`, '', corrected ? 'Thank you for taking the time.' : 'If you have a source that shows otherwise, reply to this email with it and we will look again.'],
      why
    ),
  }
}

/* ---------- Offer enquiries ---------- */

export type OfferFacts = { title: string; advertiser: string; price: string; priceNote: string; url: string }

export function enquiryReceived(s: Site, o: { ref: string; offer: OfferFacts }): Mail {
  const why = 'You are getting this because this address was entered in an offer enquiry form on MirrorActu. If that was not you, you can ignore this email.'
  return {
    subject: `Your enquiry: ${o.offer.title}`,
    html: frame({
      site: s,
      preheader: `We passed your enquiry on. ${o.offer.advertiser} will reply to this address.`,
      why,
      body:
        kicker('Enquiry received') +
        h1('We have your enquiry.') +
        p(`You asked about an advertiser offer on MirrorActu. Here is what you asked about, and what happens next.`) +
        facts([
          ['Reference', `<b>${esc(o.ref)}</b>`],
          ['Offer', `<b>${esc(o.offer.title)}</b>`],
          ['From', esc(o.offer.advertiser)],
          ['Advertised price', `${esc(o.offer.price)} <span style="color:${C.muted};">(${esc(o.offer.priceNote)})</span>`],
        ]) +
        button(o.offer.url, 'See the offer again') +
        h2('Good to know') +
        p(`This is an advertisement, not MirrorActu journalism. The advertiser sets the price and the conditions, and they can change. <b>You have not bought or reserved anything</b>, and MirrorActu never takes payment for an advertiser.`) +
        small('Your address was shared with this advertiser for this enquiry only. To withdraw it, reply to this email.'),
    }),
    text: plain(
      ['We have your enquiry.', '', `Reference: ${o.ref}`, `Offer: ${o.offer.title}`, `From: ${o.offer.advertiser}`, `Advertised price: ${o.offer.price} (${o.offer.priceNote})`, `See it again: ${o.offer.url}`, '', 'This is an advertisement, not MirrorActu journalism. The advertiser sets the price and conditions, and they can change. You have not bought or reserved anything, and MirrorActu never takes payment for an advertiser.'],
      why
    ),
  }
}

/* ---------- To the newsroom ---------- */

export function staffNewCorrection(s: Site, desk: string, o: { ref: string; storyTitle?: string; message: string; email?: string }): Mail {
  const why = 'You are getting this because you receive newsroom notifications for MirrorActu.'
  return {
    subject: `Correction report ${o.ref}${o.storyTitle ? `: ${o.storyTitle.slice(0, 70)}` : ''}`,
    html: frame({
      site: s,
      preheader: o.message.slice(0, 120),
      why,
      stamp: 'Newsroom',
      body:
        kicker('New correction report') +
        h1('A reader says something is wrong.') +
        facts([['Reference', `<b>${esc(o.ref)}</b>`], ['Story', o.storyTitle ? esc(o.storyTitle) : 'Not given'], ['Reader', o.email ? `${esc(o.email)} (will be emailed the outcome)` : 'No address given']]) +
        kicker('What they wrote', C.muted) +
        quote(o.message) +
        button(`${desk}/inbox`, 'Open the inbox') +
        small('Mark it Corrected or No change needed in the dashboard. If the reader left an address, they are emailed the outcome with your note.'),
    }),
    text: plain(['A reader says something is wrong.', '', `Reference: ${o.ref}`, `Story: ${o.storyTitle ?? 'Not given'}`, `Reader: ${o.email ?? 'No address given'}`, '', 'What they wrote:', o.message, '', `Open the inbox: ${desk}/inbox`], why),
  }
}

export function staffNewEnquiry(s: Site, desk: string, o: { ref: string; offer: OfferFacts; email: string }): Mail {
  const why = 'You are getting this because you receive newsroom notifications for MirrorActu.'
  return {
    subject: `Offer enquiry ${o.ref}: ${o.offer.title}`,
    html: frame({
      site: s,
      preheader: `${o.email} asked about ${o.offer.title} from ${o.offer.advertiser}.`,
      why,
      stamp: 'Commercial',
      body:
        kicker('New offer enquiry') +
        h1('A reader asked about an offer.') +
        facts([['Reference', `<b>${esc(o.ref)}</b>`], ['Offer', `<b>${esc(o.offer.title)}</b>`], ['Advertiser', esc(o.offer.advertiser)], ['Advertised price', `${esc(o.offer.price)} (${esc(o.offer.priceNote)})`], ['Reader', `<a href="mailto:${esc(o.email)}" style="color:${C.ink};">${esc(o.email)}</a>`]]) +
        button(`${desk}/inbox`, 'Open the inbox') +
        small('The reader was told their enquiry was passed on and that nothing is bought or reserved yet. Pass it to the advertiser.'),
    }),
    text: plain(['A reader asked about an offer.', '', `Reference: ${o.ref}`, `Offer: ${o.offer.title}`, `Advertiser: ${o.offer.advertiser}`, `Advertised price: ${o.offer.price} (${o.offer.priceNote})`, `Reader: ${o.email}`, '', `Open the inbox: ${desk}/inbox`], why),
  }
}

/* ---------- Staff accounts ---------- */

export function staffWelcome(s: Site, desk: string, o: { name: string; role: 'admin' | 'editor'; by: string }): Mail {
  const why = 'You are getting this because an administrator created a MirrorActu dashboard account for this address.'
  const role = o.role === 'admin' ? 'Administrator' : 'Editor'
  return {
    subject: 'Your MirrorActu dashboard account',
    html: frame({
      site: s,
      preheader: `${o.by} added you to the MirrorActu newsroom dashboard as ${role.toLowerCase()}.`,
      why,
      stamp: 'Newsroom',
      body:
        kicker('Dashboard access') +
        h1(`Welcome to the newsroom, ${esc(o.name.split(' ')[0])}.`) +
        p(`${esc(o.by)} created a dashboard account for you.`) +
        facts([
          ['Sign in at', `<a href="${esc(desk)}" style="color:${C.ink};font-weight:700;">${esc(desk.replace(/^https?:\/\//, ''))}</a>`],
          ['Your email', esc('The address this email was sent to')],
          ['Your role', `<b>${role}</b>: ${o.role === 'admin' ? 'stories, the wire, the inbox, subscribers, email, staff and the audit log.' : 'stories, the wire, the inbox and subscribers.'}`],
          ['Your first password', `${esc(o.by)} will give it to you directly. It is never sent by email.`],
        ]) +
        button(desk, 'Open the dashboard') +
        h2('Before you start') +
        p('At your first sign-in you must choose your own password, of at least 12 characters. Nothing else opens until you do.') +
        small('The dashboard has its own address, separate from the public site. Do not share it. If you were not expecting this account, tell your administrator.'),
    }),
    text: plain([`Welcome to the newsroom, ${o.name.split(' ')[0]}.`, '', `${o.by} created a dashboard account for you.`, '', `Sign in at: ${desk}`, `Your role: ${role}`, `Your first password: ${o.by} will give it to you directly. It is never sent by email.`, '', 'At your first sign-in you must choose your own password, of at least 12 characters.'], why),
  }
}

export function passwordChanged(s: Site, desk: string, o: { name: string; at: Date }): Mail {
  const when = o.at.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
  const why = 'You are getting this because the password of your MirrorActu dashboard account changed. We send this every time, so you would know if it was not you.'
  return {
    subject: 'Your MirrorActu password was changed',
    html: frame({
      site: s,
      preheader: `Changed on ${when}. If this was you, there is nothing to do.`,
      why,
      stamp: 'Security',
      body:
        kicker('Security notice') +
        h1('Your password was changed.') +
        p(`Hello ${esc(o.name.split(' ')[0])}. The password for your dashboard account was changed.`) +
        facts([['When', esc(when)], ['What else happened', 'Every other device was signed out.']]) +
        h2('If this was you') +
        p('There is nothing to do.') +
        h2('If this was not you') +
        p('Tell an administrator now. They can reset your account and check the audit log for what was done with it.') +
        button(desk, 'Open the dashboard'),
    }),
    text: plain(['Your password was changed.', '', `When: ${when}`, 'Every other device was signed out.', '', 'If this was you, there is nothing to do.', 'If this was not you, tell an administrator now. They can reset your account and check the audit log.', '', `Dashboard: ${desk}`], why),
  }
}

export const sectionName = (cat: string | undefined) => cap(cat ?? 'news')
