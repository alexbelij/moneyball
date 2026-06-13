/**
 * editor/main | v1.0.0 | 2026-06-13
 * Purpose: Entry point for the standalone prop editor (dev-only).
 * T22: Mounts PropEditor into #editor-root.
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { PropEditor } from './PropEditor'

const root = document.getElementById('editor-root')
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <PropEditor />
    </React.StrictMode>,
  )
}
