import React, { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { Layout } from '@/components/layout/Layout'
import { PreviewContext, PreviewState } from '@/lib/preview'
// The front page ships in the main bundle; every other page is loaded when first visited.
import { HomePage } from '@/pages/HomePage'

const page = <T extends string>(load: () => Promise<Record<T, React.ComponentType>>, name: T) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const StoryPage = page(() => import('@/pages/StoryPage'), 'StoryPage')
const SectionPage = page(() => import('@/pages/SectionPage'), 'SectionPage')
const BriefPage = page(() => import('@/pages/BriefPage'), 'BriefPage')
const AgendaPage = page(() => import('@/pages/AgendaPage'), 'AgendaPage')
const LivePage = page(() => import('@/pages/LivePage'), 'LivePage')
const SavedPage = page(() => import('@/pages/SavedPage'), 'SavedPage')
const StandardsPage = page(() => import('@/pages/StandardsPage'), 'StandardsPage')
const OffersPage = page(() => import('@/pages/OffersPage'), 'OffersPage')
const OfferPage = page(() => import('@/pages/OffersPage'), 'OfferPage')
const TrendsPage = page(() => import('@/pages/TrendsPage'), 'TrendsPage')
const SearchPage = page(() => import('@/pages/SearchPage'), 'SearchPage')
// The dashboard is compiled in only for the admin build and for local development. In the
// public site build this is `null`, the import is removed, and none of its code is shipped.
const AdminApp = import.meta.env.VITE_APP_TARGET !== 'site' ? page(() => import('@/admin/AdminApp'), 'AdminApp') : null
const ADMIN_ONLY = import.meta.env.VITE_APP_TARGET === 'admin'
const LegalPage = page(() => import('@/pages/LegalPage'), 'LegalPage')
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), 'NotFoundPage')

/**
 * MirrorActu route table. Mount inside any router:
 * <BrowserRouter><App /></BrowserRouter> in production, MemoryRouter in previews.
 */
export function App({ preview = 'live' }: { preview?: PreviewState }) {
  return (
    <PreviewContext.Provider value={preview}>
      <Routes>
        {/* The staff dashboard has its own shell: no masthead, adverts or reader popups.
            Admin build: it is the whole app, at the root. Development: it sits under /admin.
            Public site build: there is no dashboard route at all. */}
        {AdminApp && ADMIN_ONLY && (
          <>
            <Route index element={<Suspense fallback={null}><AdminApp /></Suspense>} />
            <Route path=":tab" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
            <Route path="*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
          </>
        )}
        {AdminApp && !ADMIN_ONLY && (
          <>
            <Route path="admin" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
            <Route path="admin/:tab" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
          </>
        )}
        {!ADMIN_ONLY && (
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="story/:storyId" element={<StoryPage />} />
          <Route path="brief" element={<BriefPage />} />
          <Route path="coming-up" element={<AgendaPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="how-we-work" element={<StandardsPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="legal" element={<LegalPage />} />
          <Route path="offers" element={<OffersPage />} />
          <Route path="offers/:category" element={<OffersPage />} />
          <Route path="offers/:category/:offerId" element={<OfferPage />} />
          <Route path=":sectionId" element={<SectionPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        )}
      </Routes>
    </PreviewContext.Provider>
  )
}
