/**
 * main | v0.3.0 | 2026-06-12
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/lib/a11y/a11y.css'
import App from '@/App'
import { SuiProvider } from '@/sui/SuiProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SuiProvider>
      <App />
    </SuiProvider>
  </React.StrictMode>,
)
