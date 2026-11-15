/**
 * Which app this build is. The same code builds two separate websites:
 *
 *   VITE_APP_TARGET=site    the public website. It contains no dashboard at all: no route,
 *                           no code, no link. /admin is just "page not found".
 *   VITE_APP_TARGET=admin   the staff dashboard, served from its own address
 *                           (e.g. https://desk.example.com). It contains no public pages.
 *   (unset)                 both, for local development: the site, with the dashboard at /admin.
 *
 * VITE_SITE_URL (admin build): the public site's address, for "View the site" links.
 */
export const TARGET: 'site' | 'admin' | 'all' = import.meta.env.VITE_APP_TARGET === 'site' ? 'site' : import.meta.env.VITE_APP_TARGET === 'admin' ? 'admin' : 'all'

/** Where the dashboard's pages live: at the root of its own address, or under /admin in development. */
export const ADMIN_BASE = TARGET === 'admin' ? '' : '/admin'
export const adminPath = (page: string) => `${ADMIN_BASE}/${page}`

/** The public site's address as seen from the dashboard. Empty in development, where both share one address. */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? '').replace(/\/$/, '')
/** True if the dashboard can link to the public site. */
export const HAS_SITE_LINK = TARGET === 'all' || SITE_URL !== ''
