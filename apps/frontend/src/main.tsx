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

initDevConsole()

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
