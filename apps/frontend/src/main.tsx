/**
 * main | v0.2.0 | 2026-06-09
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
import { SuiProvider } from '@/sui/SuiProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SuiProvider>
      <App />
    </SuiProvider>
  </React.StrictMode>,
)
