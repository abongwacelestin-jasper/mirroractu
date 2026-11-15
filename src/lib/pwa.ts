/**
 * The installable app (PWA): registering the service worker, noticing a new version, offering
 * to install, and knowing whether the device is online.
 *
 * The service worker is only registered in a production build. In development it would serve
 * stale files while you edit.
 */
import { useEffect, useSyncExternalStore } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

type PwaState = {
  /** Chrome, Edge and Android can show the browser's own install dialog. */
  canInstall: boolean
  /** iPhone and iPad have no install dialog: the reader uses Share → Add to Home Screen. */
  iosInstallable: boolean
  /** Already opened from the home screen or as an installed app. */
  installed: boolean
  /** A newer version of the site has been downloaded and is waiting. */
  updateReady: boolean
  online: boolean
}

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let state: PwaState = { canInstall: false, iosInstallable: false, installed: false, updateReady: false, online: true }
let installEvent: InstallEvent | null = null
let waiting: ServiceWorker | null = null
const listeners = new Set<() => void>()
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

let started = false
export function startPwa() {
  if (started || typeof window === 'undefined') return
  started = true
  set({ installed: standalone(), iosInstallable: isIos() && !standalone(), online: navigator.onLine })

  window.addEventListener('online', () => set({ online: true }))
  window.addEventListener('offline', () => set({ online: false }))
  window.addEventListener('beforeinstallprompt', (e) => {
    // Hold the browser's own prompt so we can offer it at a better moment, in our own words.
    e.preventDefault()
    installEvent = e as InstallEvent
    set({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    set({ canInstall: false, installed: true })
  })

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const watch = (worker: ServiceWorker | null) => {
        if (!worker) return
        worker.addEventListener('statechange', () => {
          // "installed" while another worker controls the page means an update is ready.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = worker
            set({ updateReady: true })
          }
        })
      }
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting
        set({ updateReady: true })
      }
      watch(reg.installing)
      reg.addEventListener('updatefound', () => watch(reg.installing))
      // Look for a new version each hour the app stays open.
      window.setInterval(() => reg.update().catch(() => {}), 3600_000)
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        location.reload()
      })
    } catch {
      /* no service worker: the site still works, just not offline */
    }
  })
}

/** Show the browser's install dialog. Resolves true if the reader installed. */
export async function installApp() {
  if (!installEvent) return false
  await installEvent.prompt()
  const { outcome } = await installEvent.userChoice
  installEvent = null
  set({ canInstall: false })
  return outcome === 'accepted'
}

/** Switch to the new version that has been downloaded. The page reloads once it takes over. */
export function applyUpdate() {
  waiting?.postMessage('skip-waiting')
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function usePwa() {
  useEffect(startPwa, [])
  return useSyncExternalStore(subscribe, () => state, () => state)
}
