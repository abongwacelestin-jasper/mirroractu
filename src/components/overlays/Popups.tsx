import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { CATEGORIES } from '@/data'
import { useFollowedSections, useStoredValue } from '@/lib/store'
import { EmailField } from '@/components/layout/Footer'
import { Logo } from '@/components/brand/Logo'
import { CorrectionForm } from '@/components/overlays/CorrectionForm'
import { Modal } from '@/components/overlays/Modal'
import { useToast } from '@/components/overlays/Toast'
import { Button } from '@/components/ui'

/**
 * The morning-email modal. Opens from Subscribe, and once on its own after a reader has spent
 * 25 seconds on the site, unless they dismissed it before.
 */
export function NewsletterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'error' | 'done'>('idle')
  useEffect(() => {
    if (open) setState('idle')
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="Get the morning email" tone="dark">
      <Logo className="size-10" />
      {state === 'done' ? (
        <>
          <h2 className="mt-5 font-serif text-[40px] font-normal leading-none">You are on the list.</h2>
          <p className="mt-3 text-mirror-light">
            Preview edition: the address is valid, but sign-up opens at launch, so nothing was sent or stored.
          </p>
          <Button className="mt-6" onClick={onClose}>Back to the news</Button>
        </>
      ) : (
        <>
          <h2 className="mt-5 font-serif text-[40px] font-normal leading-none sm:text-[46px]">
            Today, reflected. <span className="text-mirror">In your inbox by 7am.</span>
          </h2>
          <ul className="mt-5 grid gap-2 text-[15px] text-mirror-light">
            <li className="border-t border-rule-dark pt-2">Eight stories: what happened, what is confirmed, what is still open.</li>
            <li className="border-t border-rule-dark pt-2">The day’s dates worth knowing.</li>
            <li className="border-t border-rule-dark pt-2">One email a day. Free. Unsubscribe in one click.</li>
          </ul>
          <form
            noValidate
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault()
              setState(/^\S+@\S+\.\S+$/.test(email.trim()) ? 'done' : 'error')
            }}
          >
            <EmailField value={email} onChange={setEmail} />
            <p role="status" className="mt-2.5 min-h-5 text-sm text-signal">
              {state === 'error' ? 'Enter an email address such as name@example.com.' : ''}
            </p>
          </form>
        </>
      )}
    </Modal>
  )
}

/** Report a mistake, from a story or from How we work. */
export function CorrectionModal({ open, storyTitle, onClose }: { open: boolean; storyTitle?: string; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Report a correction">
      <h2 className="pr-8 text-[28px] font-extrabold tracking-[-0.03em]">Report a correction</h2>
      <p className="mt-2 text-muted">
        {storyTitle ? (
          <>About: <span className="font-serif text-lg text-ink">{storyTitle}</span></>
        ) : (
          'Tell us which story and what looks wrong. An editor checks every report against the sources.'
        )}
      </p>
      <CorrectionForm key={String(open)} idPrefix="modal-fb" />
      <p className="mt-3 border-t border-rule pt-3 text-[13px] text-muted">
        Corrections are made in the open with a dated note. Earlier versions are kept.
      </p>
    </Modal>
  )
}

/**
 * First-visit welcome: pick the desks to follow. Shown once, after the cookie choice, and
 * reopened from "Edit your desks". Choices are stored in this browser only.
 */
export function WelcomeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [follows, toggle] = useFollowedSections()
  return (
    <Modal open={open} onClose={onClose} title="Make MirrorActu yours" tone="dark" className="sm:max-w-[600px]">
      <Logo className="size-10" />
      <h2 className="mt-5 font-serif text-[40px] font-normal leading-none sm:text-[46px]">
        Make MirrorActu <span className="text-mirror">yours.</span>
      </h2>
      <p className="mt-3 text-mirror-light">Pick the desks you care about. Their stories lead your feed, and you can change them any time.</p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CATEGORIES.map((c) => {
          const on = follows.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.id)}
              className="border border-rule-dark px-3 py-3 text-left transition-colors duration-150 hover:border-white aria-pressed:border-signal aria-pressed:bg-signal aria-pressed:text-ink"
            >
              <span className="block text-[17px] font-semibold">{c.name}</span>
              <span className="block text-[12.5px] opacity-75">{on ? 'Following' : 'Tap to follow'}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={onClose}>{follows.length ? `Start reading with ${follows.length} ${follows.length > 1 ? 'desks' : 'desk'}` : 'Start reading'}</Button>
        <span className="text-[13px] text-mirror">No account needed. Stored in this browser only.</span>
      </div>
    </Modal>
  )
}
