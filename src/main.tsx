/**
 * Entry point of the real website. index.html loads this file.
 * Serve with a fallback to index.html so deep links such as /story/s-cop31 load.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@/styles/index.css'
import { App } from '@/App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
