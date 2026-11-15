import React, { lazy } from 'react'
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
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="story/:storyId" element={<StoryPage />} />
          <Route path="brief" element={<BriefPage />} />
          <Route path="coming-up" element={<AgendaPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="how-we-work" element={<StandardsPage />} />
          <Route path="legal" element={<LegalPage />} />
          <Route path=":sectionId" element={<SectionPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </PreviewContext.Provider>
  )
}
