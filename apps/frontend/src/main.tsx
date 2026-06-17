/**
 * main | v0.5.0 | 2026-06-17
 * T50: fire the developer-console easter egg once on boot.
 * T66: mount ToastProvider for pixel coach-dialogue notifications.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/lib/a11y/a11y.css'
import App from '@/App'
import { SuiProvider } from '@/sui/SuiProvider'
import { initDevConsole } from '@/lib/devConsole'
import { ToastProvider } from '@/components/toast/ToastProvider'

initDevConsole()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SuiProvider>
      <App />
      <ToastProvider />
    </SuiProvider>
  </React.StrictMode>,
)
