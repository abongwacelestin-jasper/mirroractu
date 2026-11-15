/**
 * Page translation through Google's website translator (the "Google Translate widget").
 *
 * Nothing is loaded until a reader picks a language: only then is Google's script fetched and
 * the page text sent to Google for machine translation. The choice is kept in Google's own
 * `googtrans` cookie, so the next page load translates again.
 *
 * Things to know before relying on it:
 *  - It is machine translation. Names, figures and quotes can come out wrong.
 *  - Google no longer offers this widget to new commercial sites; it still works, but for a
 *    launch at scale use the paid Cloud Translation API or translated editions from the CMS.
 *  - Google rewrites text nodes under React. `guardReactDom` below stops that from crashing
 *    React when it later updates the same nodes.
 */

export type Language = { code: string; name: string; native: string }

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'rw', name: 'Kinyarwanda', native: 'Ikinyarwanda' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
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

const SCRIPT_ID = 'google-translate-script'
const HOLDER_ID = 'google_translate_element'

/** The language the page is being translated into, read from Google's cookie. 'en' means original. */
export function currentLanguage(): string {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]*\/([^;]+)/)
  return m ? decodeURIComponent(m[1]) : 'en'
}

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

/** Translate the page into `code`, or back to the original with 'en'. */
export function setLanguage(code: string) {
  if (code === 'en') {
    setCookie(null)
    // Google has rewritten the DOM; a reload is the only clean way back to the original.
    if (document.getElementById(SCRIPT_ID)) location.reload()
    return
  }
  setCookie(`/en/${code}`)
  document.documentElement.lang = code
  const combo = document.querySelector<HTMLSelectElement>('select.goog-te-combo')
  if (combo) {
    combo.value = code
    combo.dispatchEvent(new Event('change'))
  } else {
    loadWidget()
  }
}

/** Call once on start-up: if the reader chose a language on an earlier page, carry on in it. */
export function resumeTranslation() {
  const code = currentLanguage()
  if (code !== 'en') {
    document.documentElement.lang = code
    loadWidget()
  }
}
