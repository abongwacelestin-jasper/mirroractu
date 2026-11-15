import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useStoredValue } from '@/lib/store'
import { EmailField } from '@/components/layout/Footer'
import { Logo } from '@/components/brand/Logo'
import { CorrectionForm } from '@/components/overlays/CorrectionForm'
import { Modal } from '@/components/overlays/Modal'
import { useToast } from '@/components/overlays/Toast'
import { Button } from '@/components/ui'

/**
 * Cookie consent popup, bottom of the screen until the reader chooses. The settings modal is
 * controlled by Layout so the footer and the advert modal can reopen it at any time.
 */
export function CookieConsent({
  forceOpen = false,
  settingsOpen: details,
  onSettings: setDetails,
}: {
  forceOpen?: boolean
  settingsOpen: boolean
  onSettings: (open: boolean) => void
}) {
  const [consent, setConsent] = useStoredValue('ma-consent', '')
  const [analytics, setAnalytics] = useState(consent !== 'essential')
  const [ads, setAds] = useState(consent === 'all')
  const toast = useToast()
  const open = forceOpen || !consent

  // Each time the settings open, start from what is stored.
  useEffect(() => {
    if (!details) return
    setAnalytics(consent !== 'essential')
    setAds(consent === 'all')
  }, [details])

  return (
    <>
      <AnimatePresence>
        {open && !details && (
          <motion.div
            role="region"
            aria-label="Cookie choices"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-3 bottom-3 z-[55] border border-rule bg-white p-5 shadow-[0_24px_48px_-20px_rgba(14,20,36,.45)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-[420px]"
          >
            <h2 className="text-lg">Cookies on MirrorActu</h2>
            <p className="mt-1.5 text-[14.5px] text-muted">
              We use essential cookies to run the site. With your permission we also measure readership and show adverts, which are always labelled.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setConsent('all')}>Accept all</Button>
              <Button size="sm" variant="line" onClick={() => setConsent('essential')}>Essential only</Button>
              <Button size="sm" variant="line" className="border-transparent underline decoration-signal decoration-2 underline-offset-4" onClick={() => setDetails(true)}>
                Choose
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={details} onClose={() => setDetails(false)} title="Cookie settings">
        <h2 className="pr-8 text-[28px] font-extrabold tracking-[-0.03em]">Cookie settings</h2>
        <p className="mt-2 text-muted">Change these at any time from Cookies in the footer.</p>
        <ul className="mt-6">
          {[
            ['Essential', 'Keeps you signed in, remembers saved stories and text size.', true, () => {}, true],
            ['Readership measurement', 'Counts visits so editors know which stories readers find useful. No profile is built.', analytics, () => setAnalytics(!analytics), false],
            ['Advertising', 'Lets our ad partner choose adverts. Without it you still see adverts, just less relevant ones.', ads, () => setAds(!ads), false],
          ].map(([name, desc, on, toggle, locked]) => (
            <li key={name as string} className="flex items-start justify-between gap-6 border-t border-rule py-4">
              <div>
                <p className="font-semibold">{name as string}</p>
                <p className="mt-0.5 text-sm text-muted">{desc as string}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on as boolean}
                aria-label={name as string}
                disabled={locked as boolean}
                onClick={toggle as () => void}
                className={`relative mt-1 h-6 w-11 flex-none rounded-full transition-colors duration-150 disabled:opacity-60 ${on ? 'bg-ink' : 'bg-paper-2'}`}
              >
                <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150 ease-out ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </li>
          ))}
        </ul>
        <Button
          className="mt-4 w-full"
          onClick={() => {
            setConsent(ads ? 'all' : analytics ? 'analytics' : 'essential')
            setDetails(false)
            toast('Cookie choices saved')
          }}
        >
          Save choices
        </Button>
      </Modal>
    </>
  )
}

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
