/**
 * Where the links in our emails land.
 *   /newsletter/confirm?t=…      the button in the confirmation email. Confirms at once.
 *   /newsletter/unsubscribe?t=…  the link in every edition. Asks first, then one tap.
 * The token in the link is the reader's proof, so it is taken out of the address bar as soon
 * as it has been read: it does not stay in the browser history or reach anything else.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Check, MailCheck, MailX } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { Button, ButtonLink, Container, PageHeader, TextLink } from '@/components/ui'
import { ApiError, api } from '@/lib/api'
import { NotFoundPage } from '@/pages/NotFoundPage'

type State = { step: 'working' } | { step: 'ask'; email: string } | { step: 'confirmed' | 'unsubscribed'; email: string } | { step: 'failed'; message: string }

export function NewsletterPage() {
  const { action } = useParams()
  const token = useRef('')
  const [state, setState] = useState<State>({ step: 'working' })
  const [busy, setBusy] = useState(false)

  const call = (path: string, step: 'confirmed' | 'unsubscribed') => {
    setBusy(true)
    return api<{ email: string }>(path, { body: { token: token.current } })
      .then((r) => setState({ step, email: r.email }))
      .catch((e) => setState({ step: 'failed', message: e instanceof ApiError ? e.message : 'Something went wrong. Try again.' }))
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    if (action !== 'confirm' && action !== 'unsubscribe') return
    const url = new URL(location.href)
    token.current = url.searchParams.get('t') ?? ''
    url.searchParams.delete('t')
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
    if (!token.current) {
      setState({ step: 'failed', message: 'This link is incomplete. Open it again from the email, or sign up again from the foot of any page.' })
      return
    }
    if (action === 'confirm') void call('/subscribe/confirm', 'confirmed')
    else
      api<{ email: string; status: string }>(`/subscription?token=${encodeURIComponent(token.current)}`)
        .then((r) => setState(r.status === 'unsubscribed' ? { step: 'unsubscribed', email: r.email } : { step: 'ask', email: r.email }))
        .catch((e) => setState({ step: 'failed', message: e instanceof ApiError ? e.message : 'Something went wrong. Try again.' }))
  }, [action])

  if (action !== 'confirm' && action !== 'unsubscribe') return <NotFoundPage />

  const title = state.step === 'confirmed' ? 'You are in' : state.step === 'unsubscribed' ? 'Unsubscribed' : action === 'confirm' ? 'Confirming' : 'Unsubscribe'
  return (
    <>
      <PageHeader title={title} intro="The MirrorActu morning email: what happened, what is confirmed and why it matters. One email a day, free." />
      <Container className="py-12 lg:py-16">
        <div className="max-w-[62ch]" aria-live="polite">
          {state.step === 'working' && (
            <>
              <div className="shimmer h-9 w-[70%] bg-paper-2" />
              <div className="shimmer mt-4 h-5 w-full bg-paper-2" />
              <div className="shimmer mt-2 h-5 w-[85%] bg-paper-2" />
            </>
          )}

          {state.step === 'confirmed' && (
            <>
              <p className="pop flex size-14 items-center justify-center rounded-full bg-ink text-white"><MailCheck className="size-7" /></p>
              <h2 className="mt-5 font-serif text-[40px] font-normal leading-[1.05]">Your address is confirmed.</h2>
              <p className="mt-3 text-[18px] text-muted">The morning email will come to <b className="text-ink" translate="no">{state.email}</b>, starting with the next edition. We have also sent a short welcome email explaining how every story is built.</p>
              <ul className="mt-6 grid gap-2.5 border-t-2 border-ink pt-4 text-[16px]">
                {['One email a day, in the morning. Nothing else, and no advertising email from other companies.', 'Every edition has a one-tap unsubscribe link at the foot.', 'We never sell or share your address.'].map((t) => (
                  <li key={t} className="flex gap-3"><Check className="mt-1 size-4 flex-none text-signal" />{t}</li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink to="/">Read today’s front page</ButtonLink>
                <ButtonLink to="/trends" variant="line">See today’s trends</ButtonLink>
              </div>
            </>
          )}

          {state.step === 'ask' && (
            <>
              <h2 className="font-serif text-[40px] font-normal leading-[1.05]">Stop the morning email?</h2>
              <p className="mt-3 text-[18px] text-muted">We will stop sending it to <b className="text-ink" translate="no">{state.email}</b> straight away. You can sign up again whenever you like.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button disabled={busy} onClick={() => call('/unsubscribe', 'unsubscribed')}>Yes, unsubscribe me</Button>
                <ButtonLink to="/" variant="line">No, keep it coming</ButtonLink>
              </div>
            </>
          )}

          {state.step === 'unsubscribed' && (
            <>
              <p className="pop flex size-14 items-center justify-center rounded-full bg-paper-2 text-ink"><MailX className="size-7" /></p>
              <h2 className="mt-5 font-serif text-[40px] font-normal leading-[1.05]">You are unsubscribed.</h2>
              <p className="mt-3 text-[18px] text-muted">No more morning emails will go to <b className="text-ink" translate="no">{state.email}</b>. We do not send a goodbye email either.</p>
              <p className="mt-3 text-[16px] text-muted">Pressed it by mistake?</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="line" disabled={busy} onClick={() => call('/subscribe/confirm', 'confirmed')}>Subscribe me again</Button>
                <ButtonLink to="/">Go to the front page</ButtonLink>
              </div>
            </>
          )}

          {state.step === 'failed' && (
            <>
              <h2 className="font-serif text-[40px] font-normal leading-[1.05]">That link did not work.</h2>
              <p role="alert" className="mt-3 border-l-[3px] border-signal bg-paper px-4 py-3 text-[16px]">{state.message}</p>
              <p className="mt-4 text-[16px] text-muted">Links in our emails work for one address only, and a new confirmation email replaces the one before it. You can sign up again from the foot of any page. To be removed by hand, write to us from <TextLink to="/legal">Legal and contact</TextLink>.</p>
              <div className="mt-6"><ButtonLink to="/">Go to the front page</ButtonLink></div>
            </>
          )}
        </div>
      </Container>
    </>
  )
}
