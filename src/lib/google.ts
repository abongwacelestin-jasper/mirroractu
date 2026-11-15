/**
 * Google advertising, switched on by environment variables. With none set the site shows its
 * placeholder adverts and never contacts Google.
 *
 *   VITE_ADSENSE_CLIENT            your AdSense publisher id, e.g. ca-pub-1234567890123456
 *   VITE_ADSENSE_SLOT_LEADERBOARD  ad unit ids from the AdSense dashboard, one per format
 *   VITE_ADSENSE_SLOT_MPU
 *   VITE_ADSENSE_SLOT_HALFPAGE
 *   VITE_ADSENSE_SLOT_INFEED
 *   VITE_IMA_AD_TAG                a VAST ad tag (Google Ad Manager) for video pre-roll
 *
 * Consent: nothing from Google loads until the reader has made a cookie choice. If they did
 * not allow advertising cookies, adverts are requested as non-personalised.
 */
const env = import.meta.env

export const ADSENSE_CLIENT = (env.VITE_ADSENSE_CLIENT as string | undefined) || ''
export const ADSENSE_SLOTS: Record<string, string> = {
  leaderboard: (env.VITE_ADSENSE_SLOT_LEADERBOARD as string | undefined) || '',
  mpu: (env.VITE_ADSENSE_SLOT_MPU as string | undefined) || '',
  halfpage: (env.VITE_ADSENSE_SLOT_HALFPAGE as string | undefined) || '',
  infeed: (env.VITE_ADSENSE_SLOT_INFEED as string | undefined) || '',
}
export const IMA_AD_TAG = (env.VITE_IMA_AD_TAG as string | undefined) || ''

const loading = new Map<string, Promise<void>>()

/** Load a script once. Rejects if it is blocked (ad blockers do this) or fails. */
export function loadScript(src: string): Promise<void> {
  let p = loading.get(src)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        loading.delete(src)
        reject(new Error(`Could not load ${src}`))
      }
      document.head.appendChild(s)
    })
    loading.set(src, p)
  }
  return p
}

/* ---------- AdSense display adverts ---------- */

export function loadAdSense() {
  return loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`)
}

/** Ask AdSense to fill the <ins class="adsbygoogle"> elements on the page that are still empty. */
export function requestAdSenseFill(personalised: boolean) {
  const w = window as any
  w.adsbygoogle = w.adsbygoogle || []
  w.adsbygoogle.requestNonPersonalizedAds = personalised ? 0 : 1
  w.adsbygoogle.push({})
}

/* ---------- Video pre-roll through the Google IMA SDK ---------- */

const IMA_SDK = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js'

/** Fetch the IMA SDK ahead of the click, so the advert can start inside the tap gesture. */
export const preloadIma = () => (IMA_AD_TAG ? loadScript(IMA_SDK).catch(() => {}) : Promise.resolve())

/**
 * Play one pre-roll advert over `video`, drawn into `adContainer`, then resolve. It resolves
 * (never rejects) whatever happens: no advert, a blocked SDK or an error all mean "carry on to
 * the content". Returns a function that cancels the advert.
 */
export function playPreroll({
  video,
  adContainer,
  personalised,
  onAdStart,
  onDone,
}: {
  video: HTMLVideoElement
  adContainer: HTMLElement
  personalised: boolean
  onAdStart: () => void
  onDone: () => void
}): () => void {
  let finished = false
  let manager: any = null
  const done = () => {
    if (finished) return
    finished = true
    try {
      manager?.destroy()
    } catch {
      /* already gone */
    }
    onDone()
  }

  const ima = (window as any).google?.ima
  if (!IMA_AD_TAG || !ima) {
    done()
    return done
  }

  try {
    const display = new ima.AdDisplayContainer(adContainer, video)
    display.initialize()
    const loader = new ima.AdsLoader(display)

    loader.addEventListener(
      ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      (e: any) => {
        manager = e.getAdsManager(video)
        manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, done)
        manager.addEventListener(ima.AdEvent.Type.STARTED, onAdStart)
        manager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, done)
        manager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, done)
        try {
          manager.init(adContainer.clientWidth, adContainer.clientHeight, ima.ViewMode.NORMAL)
          manager.start()
        } catch {
          done()
        }
      },
      false
    )
    loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, done, false)

    const request = new ima.AdsRequest()
    request.adTagUrl = IMA_AD_TAG + Date.now() + (personalised ? '' : '&npa=1')
    request.linearAdSlotWidth = adContainer.clientWidth
    request.linearAdSlotHeight = adContainer.clientHeight
    loader.requestAds(request)
    // If nothing has happened after eight seconds, stop waiting.
    window.setTimeout(() => !manager && done(), 8000)
  } catch {
    done()
  }
  return done
}
