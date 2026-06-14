/**
 * main | v0.4.0 | 2026-06-14
 * T50: fire the developer-console easter egg once on boot.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/lib/a11y/a11y.css'
import App from '@/App'
import { SuiProvider } from '@/sui/SuiProvider'
import { initDevConsole } from '@/lib/devConsole'

initDevConsole()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SuiProvider>
      <App />
    </SuiProvider>
  </React.StrictMode>,
)
