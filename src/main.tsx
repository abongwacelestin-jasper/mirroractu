/**
 * Entry point of the real website. index.html loads this file.
 * Serve with a fallback to index.html so deep links such as /story/<slug> load.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@/styles/index.css'
import { App } from '@/App'
import { Edition, hydrate } from '@/data'
import { TrendTopic, hydrateTopics } from '@/data/trends'
import { api, setApiOnline } from '@/lib/api'
import { localeFromPath } from '@/lib/translate'

// The language is the first part of the address (/fr/trends). The router is mounted on it,
// so every link inside the site keeps the reader in their language.
const { base } = import.meta.env.VITE_APP_TARGET === 'admin' ? { base: '' } : localeFromPath()

// Load today's edition from the API before the first render (the logo splash is showing).
// If the API does not answer within three seconds, the site starts on its bundled snapshot.
try {
  const edition = await api<Edition & { trendTopics?: TrendTopic[] }>('/bootstrap', { timeoutMs: 3000 })
  hydrate(edition)
  hydrateTopics(edition.trendTopics)
  setApiOnline(true)
} catch {
  setApiOnline(false)
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={base || undefined} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
