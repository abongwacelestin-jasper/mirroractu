/**
 * Entry point of the real website. index.html loads this file.
 * Serve with a fallback to index.html so deep links such as /story/<slug> load.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@/styles/index.css'
import { App } from '@/App'
import { localeFromPath } from '@/lib/translate'

// The language is the first part of the address (/fr/trends). The router is mounted on it,
// so every link inside the site keeps the reader in their language.
const { base } = localeFromPath()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={base || undefined} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
