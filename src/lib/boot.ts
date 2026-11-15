/**
 * The first-load splash lives in index.html as `#boot`, so the logo is on screen while the
 * JavaScript bundle downloads. Once the app has mounted, `dismissBoot` lets the logo animation
 * finish, fades the splash out and removes it.
 */
const MIN_VISIBLE_MS = 1100
const FADE_MS = 320

let dismissed = false

export const hasBootSplash = () => typeof document !== 'undefined' && !!document.getElementById('boot')

export function dismissBoot() {
  const el = document.getElementById('boot')
  if (!el || dismissed) return
  dismissed = true
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now())
  window.setTimeout(() => {
    el.classList.add('boot-out')
    window.setTimeout(() => el.remove(), FADE_MS)
  }, wait)
}
