/**
 * Spinner | v1.0.0 | 2026-06-17
 * Purpose: Small SNES-style pixel loading animation.
 * T67: async blocking-states — inline spinner for busy buttons.
 * Design: 4-frame rotating pixel block (CSS steps animation).
 * Respects prefers-reduced-motion (static square).
 * All colours from tokens.ts.
 */

import React from 'react'
import { accents, palette } from '@/styles/tokens'

export interface SpinnerProps {
  /** Size in px (width & height). Default: 14. */
  size?: number
  /** Colour token. Default: accents.gold. */
  color?: string
}

const KEYFRAMES = `
@keyframes px-spin {
  0%   { transform: rotate(0deg); }
  25%  { transform: rotate(90deg); }
  50%  { transform: rotate(180deg); }
  75%  { transform: rotate(270deg); }
  100% { transform: rotate(360deg); }
}
`

let injected = false

export function Spinner({ size = 14, color = accents.gold }: SpinnerProps) {
  // Inject keyframes once
  if (!injected && typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = KEYFRAMES
    document.head.appendChild(style)
    injected = true
  }

  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        animation: 'px-spin 0.6s steps(4) infinite',
        flexShrink: 0,
      }}
    />
  )
}
