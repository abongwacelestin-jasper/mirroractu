import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/brand/Logo'
import { Modal } from '@/components/overlays/Modal'
import { useToast } from '@/components/overlays/Toast'
import { PURPOSES, Purpose, hasGlobalPrivacyControl, useConsent } from '@/lib/consent'

/**
 * The privacy choice. Centred on first visit and it stays until the reader chooses, because
 * nothing optional may run before then. Accept and Deny are the same size and colour; every
 * optional purpose starts switched off; and the same dialog reopens from "Cookie settings"
 * with the reader's current choice, where it can be closed without changing anything.
 */
export function ConsentModal({ settingsOpen, onSettings }: { settingsOpen: boolean; onSettings: (open: boolean) => void }) {
  const { decided, consent, save, acceptAll, denyAll } = useConsent()
  const toast = useToast()
  const open = !decided || settingsOpen
  const blank: Record<Purpose, boolean> = { measurement: false, ads: false, translation: false }
  const [choice, setChoice] = useState(blank)
  const [details, setDetails] = useState(false)
  const gpc = hasGlobalPrivacyControl()

  // Each time it opens, start from what is stored (or everything off).
  useEffect(() => {
    if (!open) return
    setChoice(consent ? { measurement: consent.measurement, ads: consent.ads, translation: consent.translation } : blank)
    setDetails(settingsOpen)
  }, [open])

  const finish = (action: () => void, message: string) => {
    action()
    onSettings(false)
    toast(message)
  }

  const button = 'flex-1 rounded-full border-2 border-ink px-5 py-3 text-[15.5px] font-semibold transition-colors duration-150'

  return (
    <Modal open={open} onClose={() => onSettings(false)} title="Your privacy choices" center dismissible={decided} className="sm:max-w-[560px]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-ink"><Logo className="size-6" /></span>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted"><ShieldCheck className="size-4" /> Your privacy</p>
      </div>
      <h2 className="mt-4 pr-6 font-serif text-[36px] font-normal leading-[1.02] sm:text-[42px]">Your data, your choice.</h2>
      <p className="mt-3 text-[15.5px] text-muted">
        MirrorActu works without tracking you. Saved stories, your edition and your likes stay in this browser. With your permission we would also
        use the services below. Say no and the site still works in full.
      </p>

      {gpc && (
        <p className="mt-3 border-l-[3px] border-signal bg-paper px-3.5 py-2.5 text-[14px]">
          Your browser sends a <b className="font-semibold">Global Privacy Control</b> signal. We read that as “do not track me”, so advertising by Google stays off unless you switch it on here.
        </p>
      )}

      {details ? (
        <ul className="mt-4 border-b border-rule">
          <li className="flex items-start justify-between gap-5 border-t border-rule py-3">
            <div>
              <p className="font-semibold">Essential</p>
              <p className="mt-0.5 text-[13.5px] text-muted">Remembers this choice and your reader settings, on your device only. Always on.</p>
            </div>
            <span className="mt-1 whitespace-nowrap text-[12.5px] font-semibold text-muted">Always on</span>
          </li>
          {PURPOSES.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-5 border-t border-rule py-3">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="mt-0.5 text-[13.5px] text-muted">{p.about}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={choice[p.id]}
                aria-label={p.name}
                onClick={() => setChoice((c) => ({ ...c, [p.id]: !c[p.id] }))}
                className={`relative mt-1 h-7 w-12 flex-none rounded-full transition-colors duration-150 ${choice[p.id] ? 'bg-ink' : 'bg-paper-2'}`}
              >
                <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-150 ease-out ${choice[p.id] ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 grid gap-1.5 text-[14.5px]">
          {PURPOSES.map((p) => (
            <li key={p.id} className="flex items-baseline gap-2.5 border-t border-rule pt-1.5">
              <span aria-hidden="true" className="size-1.5 flex-none translate-y-[-2px] rounded-full bg-ink" />
              <span><b className="font-semibold">{p.name}.</b> <span className="text-muted">{p.about.split('. ')[0]}.</span></span>
            </li>
          ))}
        </ul>
      )}

      {/* Deny and Accept are deliberately identical in size and weight. */}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <button type="button" onClick={() => finish(denyAll, 'Only essential storage is on')} className={`${button} bg-white text-ink hover:bg-paper`}>Deny all</button>
        <button type="button" onClick={() => finish(acceptAll, 'All services allowed')} className={`${button} bg-white text-ink hover:bg-paper`}>Accept all</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-[14px]">
        {details ? (
          <button type="button" onClick={() => finish(() => save(choice), 'Privacy choices saved')} className="rounded-full bg-ink px-5 py-2.5 font-semibold text-white transition-colors hover:bg-ink-2">
            Save my choices
          </button>
        ) : (
          <button type="button" onClick={() => setDetails(true)} className="font-semibold underline decoration-signal decoration-2 underline-offset-4">Choose one by one</button>
        )}
        <span className="text-[13px] text-muted">
          Change it any time under Cookie settings. <Link to="/legal#your-data" onClick={() => decided && onSettings(false)} className="underline underline-offset-2 hover:text-ink">Your data</Link>
        </span>
      </div>
    </Modal>
  )
}
