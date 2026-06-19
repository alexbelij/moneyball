/**
 * CrtOverlay | v1.0.0 | 2026-06-19
 * P0: Subtle CRT scanline + vignette effect over the Phaser canvas.
 * Pure CSS (classes defined in index.html to avoid design-drift violations).
 * pointer-events: none so it doesn't block clicks.
 */

import React from 'react'

export function CrtOverlay() {
  return (
    <>
      <div className="crt-scanlines" aria-hidden="true" />
      <div className="crt-vignette" aria-hidden="true" />
    </>
  )
}
