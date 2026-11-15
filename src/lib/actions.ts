import { createContext, useContext } from 'react'

/** What the "About this advert" modal needs to know about a slot. */
export type AdInfo = { sponsor: string; format: string; size: string; placement: string; onHide?: () => void }

/**
 * Site-wide popups any component can open. Layout owns the modals and provides these;
 * the defaults are no-ops so components still render outside Layout (tests, embeds).
 */
export type SiteActions = {
  openSearch: (query?: string) => void
  openNewsletter: () => void
  /** The "pick your desks" welcome. */
  openWelcome: () => void
  /** Country edition and language picker. */
  openEdition: () => void
  openCookieSettings: () => void
  openAdInfo: (ad: AdInfo) => void
  /** `storyTitle` ties the report to a story; leave it out for a general report. */
  openCorrection: (storyTitle?: string) => void
}

const noop = () => {}

export const SiteActionsContext = createContext<SiteActions>({
  openSearch: noop,
  openNewsletter: noop,
  openWelcome: noop,
  openEdition: noop,
  openCookieSettings: noop,
  openAdInfo: noop,
  openCorrection: noop,
})

export const useSiteActions = () => useContext(SiteActionsContext)
