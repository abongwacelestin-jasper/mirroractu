/*
 * MirrorActu service worker: makes the site installable and readable offline.
 *
 * What is saved on the device, and how it is refreshed:
 *   page shell          network first, saved copy if offline          (always the latest when online)
 *   /assets/*           saved copy first (file names change when their contents do)
 *   /media/*, fonts     saved copy first, refreshed in the background
 *   /api/v1 read calls  network first, saved copy if offline          (the last edition stays readable)
 *
 * Never saved: the staff dashboard and sign-in, anything that changes data, the live wire
 * stream, and anything from Google's advertising or translation services.
 *
 * __BUILD_ID__ is replaced when the site is built, so each deploy gets fresh caches.
 */
const BUILD = '__BUILD_ID__'
const SHELL = `ma-shell-${BUILD}`
const ASSETS = `ma-assets-${BUILD}`
const MEDIA = 'ma-media-v1'
const DATA = 'ma-data-v1'
const KEEP = [SHELL, ASSETS, MEDIA, DATA]
const PRECACHE = ['/', '/offline.html', '/brand/mark.svg', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png']
const MEDIA_MAX = 80

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith('ma-') && !KEEP.includes(n)).map((n) => caches.delete(n)))).then(() => self.clients.claim())
  )
})

// The page asks the waiting worker to take over when the reader taps "Refresh".
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

const put = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === 'opaque') return
  const cache = await caches.open(cacheName)
  await cache.put(request, response.clone())
  if (cacheName === MEDIA) {
    const keys = await cache.keys()
    if (keys.length > MEDIA_MAX) await Promise.all(keys.slice(0, keys.length - MEDIA_MAX).map((k) => cache.delete(k)))
  }
}

const networkFirst = async (request, cacheName, fallbackUrl) => {
  try {
    const response = await fetch(request)
    put(cacheName, request, response)
    return response
  } catch {
    return (await caches.match(request)) || (fallbackUrl && (await caches.match(fallbackUrl))) || Response.error()
  }
}

const cacheFirst = async (request, cacheName, refresh) => {
  const cached = await caches.match(request)
  if (cached) {
    if (refresh) fetch(request).then((r) => put(cacheName, request, r)).catch(() => {})
    return cached
  }
  const response = await fetch(request)
  put(cacheName, request, response)
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Fonts from Google Fonts are safe to keep; everything else off-site is left alone.
  if (url.origin !== location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(cacheFirst(request, MEDIA, true))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    // Staff pages, sign-in and the live stream are never cached. Video needs range requests.
    if (/\/(admin|auth)\b/.test(url.pathname) || url.pathname.endsWith('/wire/stream')) return
    event.respondWith(networkFirst(request, DATA))
    return
  }
  if (request.headers.has('range')) return

  if (request.mode === 'navigate') {
    if (url.pathname.startsWith('/admin')) return
    // Every page is the same app shell, so the saved front page stands in for any address.
    event.respondWith(
      fetch(request)
        .then((response) => {
          put(SHELL, '/', response)
          return response
        })
        .catch(async () => (await caches.match('/')) || (await caches.match('/offline.html')))
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request, ASSETS, false))
  if (/^\/(media|brand|icons)\//.test(url.pathname) && !/\.(webm|mp4)$/.test(url.pathname)) return event.respondWith(cacheFirst(request, MEDIA, true))
})
