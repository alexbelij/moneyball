/**
 * main | v0.5.0 | 2026-06-17
 * T50: fire the developer-console easter egg once on boot.
 * T66: mount ToastProvider for pixel coach-dialogue notifications.
 * T68: root ErrorBoundary wraps the entire app — catches unhandled
 *      render errors and shows a full-screen pixel fallback.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/lib/a11y/a11y.css'
import App from '@/App'
import { SuiProvider } from '@/sui/SuiProvider'
import { initDevConsole } from '@/lib/devConsole'
import { ToastProvider } from '@/components/toast/ToastProvider'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { PropEditor } from '@/editor/PropEditor'

initDevConsole()

// Dev tool: open the prop placement editor with ?edit=1 (drag/scale props on
// the v4 background, then Export -> copy props.json from the console).
if (new URLSearchParams(window.location.search).get('edit') === '1') {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <PropEditor />
      </ErrorBoundary>
    </React.StrictMode>,
  )
} else {

// Register service worker for PWA installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration is non-critical
    })
  })
}

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <SuiProvider>
          <App />
          <ToastProvider />
        </SuiProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
