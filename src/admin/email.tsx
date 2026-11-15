/**
 * The dashboard's Email page: write and send the morning email, see every email the platform
 * sends exactly as a reader receives it, and check what went out.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Monitor, Send, Smartphone } from 'lucide-react'

import { COUNTRIES } from '@/data/geo'
import { ApiError, api } from '@/lib/api'
import { useAdmin } from './AdminApp'
import { Btn, Empty, Field, Kpi, Notice, Panel, Pill, Segmented, inputClass, when } from './ui'

type MailInfo = {
  configured: boolean
  from: string
  fromIsTestSender: boolean
  replyTo: string | null
  postalAddress: string | null
  webhook: boolean
  counts: { confirmed: number; pending: number; never_asked: number; sent_week: number; failed_week: number }
  templates: { id: string; name: string; when: string }[]
  stories: { id: string; h: string; section: string }[]
  recent: { id: number; at: string; kind: string; recipient: string; subject: string; status: 'sent' | 'failed' | 'not_configured'; error: string | null }[]
  editions: { id: number; subject: string; status: 'sending' | 'sent' | 'failed'; recipients: number; delivered: number; failed: number; created_at: string; sent_by: string | null }[]
}
type Rendered = { subject: string; html: string; text: string }

/** An email shown as the reader's mail program would show it. Nothing in it can run or navigate. */
function Preview({ mail, loading }: { mail: Rendered | null; loading: boolean }) {
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop')
  const [height, setHeight] = useState(640)
  const frame = useRef<HTMLIFrameElement>(null)
  const fit = useCallback(() => {
    const el = frame.current
    const doc = el?.contentDocument
    if (!el || !doc?.body) return
    // Collapse first: a frame never reports less than its own height, so it could only grow.
    el.style.height = '0px'
    const needed = Math.max(320, doc.documentElement.scrollHeight)
    el.style.height = `${needed}px`
    setHeight(needed)
  }, [])
  useEffect(() => {
    const t = window.setTimeout(fit, 400)
    return () => window.clearTimeout(t)
  }, [mail, width, fit])

  return (
    <div className="min-w-0 border border-rule bg-paper-2/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-white px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[13.5px]"><span className="text-muted">Subject: </span><b>{mail?.subject ?? '…'}</b></p>
        <div className="flex gap-1" role="group" aria-label="Preview width">
          {([['desktop', Monitor, 'Desktop'], ['phone', Smartphone, 'Phone']] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" aria-pressed={width === id} aria-label={label} title={label} onClick={() => setWidth(id)} className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 aria-pressed:bg-ink aria-pressed:text-white">
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className={`mx-auto transition-[max-width] duration-200 ${width === 'phone' ? 'max-w-[390px]' : 'max-w-[680px]'}`}>
        {!mail ? (
          <div className="shimmer h-[520px] bg-paper-2" />
        ) : (
          <iframe ref={frame} title="Email preview" sandbox="allow-same-origin" srcDoc={mail.html} onLoad={fit} style={{ height }} className={`block w-full border-0 bg-paper transition-opacity ${loading ? 'opacity-50' : ''}`} />
        )}
      </div>
    </div>
  )
}

type Check = { id: string; label: string; ok: boolean | null; detail: string; fix?: string }

/** Inbox or spam? The checks mail providers make on the sending domain, with what to do about each. */
function InboxCheck() {
  const [data, setData] = useState<{ domain: string; checks: Check[] } | null>(null)
  const [error, setError] = useState('')
  const run = useCallback(() => {
    setData(null)
    setError('')
    api<{ domain: string; checks: Check[] }>('/admin/mail/check', { timeoutMs: 20000 }).then(setData).catch((e: ApiError) => setError(e.message))
  }, [])
  useEffect(run, [run])
  const problems = data?.checks.filter((c) => c.ok === false).length ?? 0
  return (
    <Panel
      title={!data ? 'Checking your sending domain…' : problems === 0 ? 'Set up to reach the inbox' : `${problems} ${problems === 1 ? 'thing is' : 'things are'} sending your email to spam`}
      kicker="Inbox or spam"
      action={<Btn tone="line" size="sm" onClick={run}>Check again</Btn>}
      flush
    >
      {error ? <div className="px-4 pb-4 sm:px-5"><Notice kind="error">{error}</Notice></div> : !data ? <div className="shimmer h-[180px] bg-paper-2" /> : (
        <ul>
          {data.checks.map((c) => (
            <li key={c.id} className="border-t border-rule px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14.5px] font-semibold">{c.label}</span>
                <Pill tone={c.ok ? 'good' : c.ok === false ? 'signal' : 'neutral'}>{c.ok ? 'OK' : c.ok === false ? 'Fix this' : 'Check by hand'}</Pill>
              </div>
              <p className="mt-1 text-[13.5px] text-muted">{c.detail}</p>
              {c.fix && <p className="mt-1.5 break-words border-l-[3px] border-signal bg-paper px-3 py-2 text-[13.5px]"><b>What to do: </b>{c.fix}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-rule px-4 py-3 text-[12.5px] text-muted sm:px-5">A new sending domain also needs a few weeks of real, wanted email before providers trust it. Send to people who signed up, start small, and expect early emails to land in spam more often than later ones.</p>
    </Panel>
  )
}

function Status({ info }: { info: MailInfo }) {
  if (!info.configured)
    return (
      <Notice kind="error">
        <b>Email is not connected, so nothing is being sent.</b> Create an API key at resend.com, verify your sending domain there, then set <code>RESEND_API_KEY</code> and <code>MAIL_FROM</code> on the <code>api</code> service and redeploy. Until then every email is listed below as “Not connected”, and you can still preview all of them here.
      </Notice>
    )
  return (
    <div className="grid gap-2">
      <Notice kind="ok"><b>Connected to Resend.</b> Sending as <b>{info.from}</b>{info.replyTo ? <>, replies go to <b>{info.replyTo}</b></> : null}.</Notice>
      {info.fromIsTestSender && <Notice kind="error"><b><code>MAIL_FROM</code> is not set.</b> Email is going out from Resend’s test sender, which only reaches the address your Resend account was opened with. Verify your domain in Resend and set <code>MAIL_FROM</code>, for example <code>MirrorActu &lt;news@yourdomain&gt;</code>.</Notice>}
      {!info.postalAddress && <Notice>No postal address is set. Anti-spam law in several countries (the US CAN-SPAM Act among them) requires the publisher’s postal address in every newsletter. Set <code>MAIL_POSTAL_ADDRESS</code> on the <code>api</code> service before sending to readers.</Notice>}
      {!info.webhook && <Notice>Bounces and spam complaints are not reported back yet. Add a webhook in Resend pointing at <code>/api/v1/hooks/resend</code> on the public site and set <code>RESEND_WEBHOOK_SECRET</code>, so dead and unwilling addresses stop receiving email.</Notice>}
    </div>
  )
}

/* ---------- The morning email ---------- */

function Composer({ info, reload }: { info: MailInfo; reload: () => void }) {
  const { user } = useAdmin()
  const [subject, setSubject] = useState('')
  const [intro, setIntro] = useState('Good morning. Here is what is confirmed, what is still open, and why it matters today.')
  const [picked, setPicked] = useState<string[]>([])
  const [country, setCountry] = useState('')
  const [mail, setMail] = useState<Rendered | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Start with the five newest stories, the first as the lead.
  useEffect(() => {
    if (picked.length || !info.stories.length) return
    setPicked(info.stories.slice(0, 5).map((s) => s.id))
    setSubject(`MirrorActu morning: ${info.stories[0].h}`.slice(0, 150))
  }, [info.stories, picked.length])

  const body = { subject: subject.trim(), intro: intro.trim() || undefined, storyIds: picked, country: country || undefined }
  const ready = subject.trim().length >= 6 && picked.length > 0
  const key = JSON.stringify(body)
  useEffect(() => {
    if (!ready) return
    setLoading(true)
    const t = window.setTimeout(() => {
      api<Rendered>('/admin/newsletter/preview', { body: JSON.parse(key) }).then(setMail).catch(() => {}).finally(() => setLoading(false))
    }, 500)
    return () => window.clearTimeout(t)
  }, [key, ready])

  const act = async (path: string, done: (r: any) => string) => {
    setBusy(true)
    setNote(null)
    try {
      setNote({ kind: 'ok', text: done(await api(path, { body, timeoutMs: 30000 })) })
      reload()
    } catch (e) {
      setNote({ kind: 'error', text: e instanceof ApiError ? e.message : 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 8 ? p : [...p, id]))
  const n = info.counts.confirmed

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 2xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <Panel title="Today’s edition" kicker="The morning email">
        <div className="grid gap-4">
          <Field label="Subject" hint={`${subject.trim().length}/150. This is what readers see in their inbox.`}>
            <input value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Opening note" hint="Optional. One or two sentences in your own voice, above the lead story.">
            <textarea value={intro} maxLength={600} rows={3} onChange={(e) => setIntro(e.target.value)} className={inputClass} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13.5px] font-semibold">Stories <span className="font-normal text-muted">({picked.length} of 8). The first you pick leads.</span></legend>
            <ul className="border border-rule">
              {info.stories.map((s) => {
                const at = picked.indexOf(s.id)
                return (
                  <li key={s.id} className="border-t border-rule first:border-t-0">
                    <button type="button" aria-pressed={at >= 0} onClick={() => toggle(s.id)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper aria-pressed:bg-paper">
                      <span className={`mt-0.5 flex size-6 flex-none items-center justify-center rounded-full border text-[12px] font-bold tabular-nums ${at >= 0 ? 'border-ink bg-ink text-white' : 'border-ink/30 text-transparent'}`}>{at >= 0 ? at + 1 : '0'}</span>
                      <span className="min-w-0">
                        <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{s.section}{at === 0 && <b className="ml-2 text-signal">Lead</b>}</span>
                        <span className="block text-[14.5px] font-semibold leading-snug">{s.h}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </fieldset>
          <Field label="Preview the trends block for" hint="Each reader gets the trends for their own country. This only changes the preview.">
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
              <option value="">Readers with no country (global)</option>
              {COUNTRIES.filter((c) => c.code !== 'INT').map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>

          {note && <Notice kind={note.kind}>{note.text}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Btn tone="line" disabled={!ready || busy} onClick={() => act('/admin/newsletter/test', (r) => `Test sent to ${r.to}. Check how it looks in your own inbox.`)}><Send className="size-4" /> Send a test to me</Btn>
            {user.role === 'admin' && !confirming && <Btn tone="signal" disabled={!ready || busy || !info.configured || n === 0} onClick={() => setConfirming(true)}>Send to {n.toLocaleString('en')} {n === 1 ? 'subscriber' : 'subscribers'}</Btn>}
          </div>
          {confirming && (
            <div className="border-l-[3px] border-signal bg-paper px-4 py-3.5">
              <p className="text-[14.5px] font-semibold">Send this edition to {n.toLocaleString('en')} confirmed {n === 1 ? 'subscriber' : 'subscribers'} now?</p>
              <p className="mt-1 text-[13.5px] text-muted">It goes out immediately and cannot be recalled. Send yourself a test first if you have not.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn tone="signal" disabled={busy} onClick={() => act('/admin/newsletter/send', (r) => `Sending to ${r.recipients.toLocaleString('en')} ${r.recipients === 1 ? 'subscriber' : 'subscribers'}. Progress is under Sent.`)}><Check className="size-4" /> Yes, send it</Btn>
                <Btn tone="ghost" disabled={busy} onClick={() => setConfirming(false)}>Not yet</Btn>
              </div>
            </div>
          )}
          {user.role !== 'admin' && <p className="text-[13px] text-muted">Editors can write and test an edition. An administrator sends it to readers.</p>}
          {user.role === 'admin' && n === 0 && <p className="text-[13px] text-muted">Nobody has confirmed their address yet, so there is no one to send to.</p>}
        </div>
      </Panel>
      <Preview mail={mail} loading={loading} />
    </div>
  )
}

/* ---------- Every email the platform sends ---------- */

function Templates({ info, reload }: { info: MailInfo; reload: () => void }) {
  const [kind, setKind] = useState(info.templates[1]?.id ?? info.templates[0].id)
  const [mail, setMail] = useState<Rendered | null>(null)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  useEffect(() => {
    setLoading(true)
    setNote(null)
    api<Rendered>(`/admin/mail/preview/${kind}`).then(setMail).catch(() => {}).finally(() => setLoading(false))
  }, [kind])
  const current = info.templates.find((t) => t.id === kind)!

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 2xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Panel title="Emails we send" kicker={`${info.templates.length} in all`} flush>
        <ul>
          {info.templates.map((t) => (
            <li key={t.id} className="border-t border-rule">
              <button type="button" aria-pressed={t.id === kind} onClick={() => setKind(t.id)} className="relative block w-full px-4 py-3 text-left transition-colors hover:bg-paper aria-pressed:bg-paper sm:px-5">
                {t.id === kind && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-signal" />}
                <span className="block text-[14.5px] font-semibold">{t.name}</span>
                <span className="block text-[12.5px] text-muted">{t.when}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2.5 border-t border-rule px-4 py-4 sm:px-5">
          <p className="text-[13px] text-muted">Shown with sample details. The real ones carry the reader’s own reference, story or offer.</p>
          {note && <Notice kind={note.kind}>{note.text}</Notice>}
          <Btn
            tone="line"
            onClick={() =>
              api('/admin/mail/test', { body: { kind }, timeoutMs: 30000 })
                .then((r) => setNote({ kind: 'ok', text: `“${current.name}” sent to ${r.to}.` }))
                .catch((e: ApiError) => setNote({ kind: 'error', text: e.message }))
                .finally(reload)
            }
          >
            <Send className="size-4" /> Send this one to me
          </Btn>
        </div>
      </Panel>
      <Preview mail={mail} loading={loading} />
    </div>
  )
}

/* ---------- What went out ---------- */

const KIND: Record<string, string> = Object.fromEntries([
  ['newsletter', 'Morning email'], ['subscribe.confirm', 'Confirm address'], ['subscribe.welcome', 'Welcome'], ['correction.received', 'Correction received'],
  ['correction.corrected', 'Correction: corrected'], ['correction.no_change', 'Correction: no change'], ['enquiry.received', 'Enquiry received'],
  ['staff.correction', 'Newsroom: correction'], ['staff.enquiry', 'Newsroom: enquiry'], ['staff.welcome', 'Account created'], ['staff.password', 'Password changed'],
])
const kindName = (k: string) => (k.startsWith('test.') ? `Test: ${KIND[k.slice(5)] ?? k.slice(5)}` : KIND[k] ?? k)
const SENT: Record<MailInfo['recent'][number]['status'], [string, 'good' | 'signal' | 'neutral']> = { sent: ['Accepted', 'good'], failed: ['Failed', 'signal'], not_configured: ['Not connected', 'neutral'] }

function Sent({ info }: { info: MailInfo }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Panel title="Editions" kicker="The morning email" flush>
        {info.editions.length === 0 ? <Empty title="No edition has been sent yet.">Write one under Morning email.</Empty> : (
          <ul>
            {info.editions.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule px-4 py-3 sm:px-5">
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold">{e.subject}</span>
                  <span className="block text-[12.5px] text-muted">{when(e.created_at)}{e.sent_by ? ` · sent by ${e.sent_by}` : ''}</span>
                </span>
                <span className="flex items-center gap-2.5 text-[13px] tabular-nums">
                  <Pill tone={e.status === 'sent' ? 'good' : e.status === 'failed' ? 'signal' : 'warn'}>{e.status === 'sending' ? 'Sending' : e.status === 'sent' ? 'Sent' : 'Failed'}</Pill>
                  <span><b>{e.delivered.toLocaleString('en')}</b> of {e.recipients.toLocaleString('en')} accepted{e.failed > 0 ? `, ${e.failed.toLocaleString('en')} failed` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Recent email" kicker="Last 60, every kind" flush>
        {info.recent.length === 0 ? <Empty title="Nothing has been sent yet.">Sign-ups, corrections, enquiries and staff changes each send email. They appear here.</Empty> : (
          <ul>
            {info.recent.map((m) => (
              <li key={m.id} className="border-t border-rule px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold">{kindName(m.kind)}</span>
                    <span className="block truncate text-[12.5px] text-muted">to {m.recipient}</span>
                  </span>
                  <span className="flex items-center gap-2.5 text-[12.5px] text-muted"><Pill tone={SENT[m.status][1]}>{SENT[m.status][0]}</Pill><span className="tabular-nums">{when(m.at)}</span></span>
                </div>
                {m.error && <p className="mt-1.5 break-words text-[12.5px] text-[#b3261e]">{m.error}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-rule px-4 py-3 text-[12.5px] text-muted sm:px-5">“Accepted” means Resend took the email for delivery. Opens and clicks are not tracked. The log is kept for 90 days and never stores what an email said.</p>
      </Panel>
    </div>
  )
}

export function Email() {
  const [info, setInfo] = useState<MailInfo | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'compose' | 'templates' | 'sent'>('compose')
  const reload = useCallback(() => {
    api<MailInfo>('/admin/mail').then(setInfo).catch((e: ApiError) => setError(e.message))
  }, [])
  useEffect(reload, [reload])
  // While an edition is going out, keep its count moving.
  const sending = info?.editions.some((e) => e.status === 'sending')
  useEffect(() => {
    if (!sending) return
    const t = window.setInterval(reload, 4000)
    return () => window.clearInterval(t)
  }, [sending, reload])

  if (error) return <Notice kind="error">{error}</Notice>
  if (!info) return <div className="shimmer h-[420px] bg-paper-2" />
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Confirmed" value={info.counts.confirmed} note="Receive the morning email" />
        <Kpi label="Waiting" value={info.counts.pending} note="Have not confirmed yet" />
        <Kpi label="Accepted" value={info.counts.sent_week} note="Emails, last 7 days" />
        <Kpi label="Failed" value={info.counts.failed_week} note="Emails, last 7 days" />
      </div>
      <Status info={info} />
      {info.configured && <InboxCheck />}
      <Segmented label="Email" value={tab} onChange={setTab} options={[['compose', 'Morning email'], ['templates', 'All emails', info.templates.length], ['sent', 'Sent', info.editions.length]]} />
      {tab === 'compose' && <Composer info={info} reload={reload} />}
      {tab === 'templates' && <Templates info={info} reload={reload} />}
      {tab === 'sent' && <Sent info={info} />}
    </div>
  )
}
