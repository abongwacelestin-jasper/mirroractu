/**
 * Privacy consent. One record in this browser says what the reader allowed, when, and under
 * which version of the notice.
 *
 * Rules this file enforces:
 *  - Nothing optional is on until the reader says so. There are no pre-ticked boxes.
 *  - Denying is one tap, the same size as accepting.
 *  - A choice lasts six months, then the reader is asked again. So is a new notice version.
 *  - The browser's Global Privacy Control signal is shown to the reader and treated as a
 *    request to deny advertising until they decide otherwise here.
 *  - The choice can be changed at any time (Cookie settings, in the footer).
 *
 * What each purpose gates:
 *   measurement   readership counting: a story view is sent to our own API, with no IP address kept
 *   ads           Google AdSense and Google video adverts. Denied: house adverts only, no Google.
 *   translation   Google Translate, which receives the page text
 */
import { useStoredValue } from '@/lib/store'

export type Purpose = 'measurement' | 'ads' | 'translation'
export type Consent = { v: number; at: number } & Record<Purpose, boolean>

/** Raise this when the notice changes in a way readers should see again. */
export const CONSENT_VERSION = 2
const MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000
const KEY = 'ma-consent'

export const PURPOSES: { id: Purpose; name: string; about: string }[] = [
  { id: 'measurement', name: 'Readership measurement', about: 'Counts which stories are read so editors know what is useful. No profile of you is built and your IP address is not stored.' },
  { id: 'ads', name: 'Advertising by Google', about: 'Lets Google choose and measure adverts, including video adverts. If you deny it you still see adverts, but only our own, with no tracking.' },
  { id: 'translation', name: 'Translation by Google', about: 'Needed to read MirrorActu in another language, including the one we offer for your country. The page text is sent to Google Translate.' },
]

function parse(raw: string): Consent | null {
  try {
    const c = JSON.parse(raw) as Consent
    if (c?.v !== CONSENT_VERSION || typeof c.at !== 'number' || Date.now() - c.at > MAX_AGE_MS) return null
    return c
  } catch {
    return null
  }
}

/** Read the stored choice outside React (start-up code). */
export function readConsent(): Consent | null {
  try {
    return parse(localStorage.getItem(KEY) ?? '')
  } catch {
    return null
  }
}

/** True if the browser sends the Global Privacy Control signal. */
export const hasGlobalPrivacyControl = () => typeof navigator !== 'undefined' && (navigator as any).globalPrivacyControl === true

export function useConsent() {
  const [raw, setRaw] = useStoredValue(KEY, '')
  const consent = parse(raw)
  const save = (choice: Record<Purpose, boolean>) => setRaw(JSON.stringify({ v: CONSENT_VERSION, at: Date.now(), ...choice }))
  return {
    /** The reader has made a choice that is still valid. */
    decided: !!consent,
    consent,
    allows: (p: Purpose) => !!consent?.[p],
    save,
    acceptAll: () => save({ measurement: true, ads: true, translation: true }),
    denyAll: () => save({ measurement: false, ads: false, translation: false }),
    /** Allow one more purpose, keeping the rest. Used when a reader asks for a feature that needs it. */
    grant: (p: Purpose) => save({ measurement: !!consent?.measurement, ads: !!consent?.ads, translation: !!consent?.translation, [p]: true }),
  }
}
