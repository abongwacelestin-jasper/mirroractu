/**
 * Languages and addresses.
 *
 * The language is the first part of the address: /fr/trends, /sw/story/…, /en/brief.
 * An address with no language prefix is English. Every page therefore has one address per
 * language, which can be shared, bookmarked and indexed (see `alternateLinks`).
 *
 * MirrorActu is written in English. Other languages are machine translated in the reader's
 * browser by Google's website translator, and only if they allowed "Translation by Google":
 *  - It is machine translation. Names, figures and quotes can come out wrong, and the page
 *    says so while it is translated.
 *  - Google no longer offers this widget to new commercial sites; it still works, but for a
 *    launch at scale use the paid Cloud Translation API or translated editions from the CMS.
 *    When translated editions exist, serve them at these same addresses.
 *  - Google rewrites text nodes under React. `guardReactDom` stops that from crashing React
 *    when it later updates the same nodes.
 */

export type Language = { code: string; name: string; native: string; rtl?: boolean }

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'rw', name: 'Kinyarwanda', native: 'Ikinyarwanda' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true },
  { code: 'am', name: 'Amharic', native: 'አማርኛ' },
  { code: 'ha', name: 'Hausa', native: 'Hausa' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
  { code: 'ig', name: 'Igbo', native: 'Igbo' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu' },
  { code: 'xh', name: 'Xhosa', native: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
  { code: 'sn', name: 'Shona', native: 'chiShona' },
  { code: 'lg', name: 'Luganda', native: 'Luganda' },
  { code: 'ln', name: 'Lingala', native: 'Lingála' },
  { code: 'om', name: 'Oromo', native: 'Afaan Oromoo' },
  { code: 'ak', name: 'Twi', native: 'Twi' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'zh-CN', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'mi', name: 'Māori', native: 'Māori' },
]

export const getLanguage = (code: string) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]

/* ---------- The language in the address ---------- */

export type Locale = {
  /** Language code, 'en' when the address has no prefix */
  lang: string
  /** The prefix to mount the router on: '/fr', or '' for an unprefixed address */
  base: string
  /** The address without the prefix, always starting with '/' */
  rest: string
}

/** Split an address into its language prefix and the rest: '/fr/trends' → fr + '/trends'. */
export function localeFromPath(pathname: string = location.pathname): Locale {
  const seg = pathname.split('/')[1] ?? ''
  const match = LANGUAGES.find((l) => l.code.toLowerCase() === seg.toLowerCase())
  if (!match) return { lang: 'en', base: '', rest: pathname || '/' }
  const base = `/${seg}`
  return { lang: match.code, base, rest: pathname.slice(base.length) || '/' }
}

/** The address of a page in a language: localePath('fr', '/trends') → '/fr/trends'. */
export const localePath = (code: string, rest: string = localeFromPath().rest) => `/${code}${rest === '/' ? '' : rest}`

/** The language of the page being shown. */
export const currentLanguage = () => localeFromPath().lang

/**
 * Go to the same page in another language. It is a full page load on purpose: Google's
 * translator has rewritten the page, and a fresh load is the only clean way to change or undo that.
 */
export function setLanguage(code: string) {
  rememberLanguage(code)
  location.assign(localePath(code) + location.search + location.hash)
}

/** <link rel="alternate" hreflang> for every language, plus the canonical address, for search engines. */
export function alternateLinks() {
  const { rest, lang } = localeFromPath()
  document.head.querySelectorAll('link[data-locale]').forEach((l) => l.remove())
  const add = (rel: string, href: string, hreflang?: string) => {
    const link = document.createElement('link')
    link.rel = rel
    link.href = location.origin + href
    if (hreflang) link.hreflang = hreflang
    link.dataset.locale = ''
    document.head.appendChild(link)
  }
  for (const l of LANGUAGES) add('alternate', localePath(l.code, rest), l.code)
  add('alternate', localePath('en', rest), 'x-default')
  add('canonical', localePath(lang, rest))
}

/* ---------- Machine translation ---------- */

const SCRIPT_ID = 'google-translate-script'
const HOLDER_ID = 'google_translate_element'

function setCookie(value: string | null) {
  const host = location.hostname
  const domains = ['', `domain=${host};`, host.includes('.') ? `domain=.${host.split('.').slice(-2).join('.')};` : '']
  for (const d of new Set(domains)) {
    document.cookie = value === null ? `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; ${d}` : `googtrans=${value}; path=/; ${d}`
  }
}

let guarded = false
/**
 * Google wraps translated text in <font> tags, so a text node React still holds may no longer
 * be a child of the parent React expects. Without this, React throws on the next update.
 */
function guardReactDom() {
  if (guarded) return
  guarded = true
  const { removeChild, insertBefore } = Node.prototype
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child
    return removeChild.call(this, child) as T
  }
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node
    return insertBefore.call(this, node, ref) as T
  }
}

function loadWidget() {
  if (document.getElementById(SCRIPT_ID)) return
  guardReactDom()
  if (!document.getElementById(HOLDER_ID)) {
    const holder = document.createElement('div')
    holder.id = HOLDER_ID
    holder.style.display = 'none'
    document.body.appendChild(holder)
  }
  ;(window as any).googleTranslateElementInit = () => {
    new (window as any).google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, HOLDER_ID)
  }
  const s = document.createElement('script')
  s.id = SCRIPT_ID
  s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
  s.async = true
  document.head.appendChild(s)
}

/** True once Google's translator has been started on this page. */
export const isTranslating = () => !!document.getElementById(SCRIPT_ID)

/**
 * Make the page match the language in its address. Sets <html lang> and text direction, and
 * starts the translator if the language is not English and the reader allowed translation.
 * Call again when consent changes.
 */
export function applyLocale(translationAllowed: boolean) {
  const lang = currentLanguage()
  const translate = lang !== 'en' && translationAllowed
  document.documentElement.lang = translate ? lang : 'en'
  document.documentElement.dir = translate && getLanguage(lang).rtl ? 'rtl' : 'ltr'
  if (translate) {
    setCookie(`/en/${lang}`)
    loadWidget()
  } else if (!isTranslating()) {
    setCookie(null)
  }
}

/* ---------- Suggesting a language ---------- */

/** "Read in French?" written in that language, for the ones we can vouch for. */
export const READ_IN: Record<string, string> = {
  fr: 'Lire MirrorActu en français ?',
  es: '¿Leer MirrorActu en español?',
  pt: 'Ler o MirrorActu em português?',
  de: 'MirrorActu auf Deutsch lesen?',
  sw: 'Soma MirrorActu kwa Kiswahili?',
  ar: 'هل تريد قراءة MirrorActu بالعربية؟',
}

/**
 * The language to offer this reader. Where they are comes first: the main language of their
 * country edition. If that edition has none other than English, the first language their
 * browser asks for that we support.
 */
export function suggestedLanguage(countryLangs: string[]): Language | null {
  if (countryLangs[0]) return getLanguage(countryLangs[0])
  for (const w of (navigator.languages ?? [navigator.language]).map((l) => l.toLowerCase())) {
    if (w.startsWith('en')) continue
    const match = LANGUAGES.find((l) => l.code !== 'en' && (l.code.toLowerCase() === w || l.code.toLowerCase().split('-')[0] === w.split('-')[0]))
    if (match) return match
  }
  return null
}

/* ---------- The reader's standing choice ---------- */

const PREF_KEY = 'ma-lang-pref'

/** The language the reader last chose ('en' included), or '' if they have never been asked. */
export function preferredLanguage(): string {
  try {
    return localStorage.getItem(PREF_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberLanguage(code: string) {
  try {
    localStorage.setItem(PREF_KEY, code)
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}

/**
 * If the reader has chosen another language and allowed translation, an address with no
 * language in it (a shared link, a bookmark, the bare domain) is sent on to their language.
 * Returns true if it is redirecting, so the caller can stop.
 */
export function redirectToPreferredLanguage(translationAllowed: boolean): boolean {
  const pref = preferredLanguage()
  if (!translationAllowed || !pref || pref === 'en' || localeFromPath().base !== '') return false
  if (!LANGUAGES.some((l) => l.code === pref)) return false
  location.replace(localePath(pref) + location.search + location.hash)
  return true
}
