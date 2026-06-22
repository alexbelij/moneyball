/**
 * PortraitGuard | v1.0.0 | 2026-06-17
 * Purpose: On narrow mobile viewports in portrait orientation, shows a
 * full-screen overlay asking the user to rotate their device to landscape.
 * Uses a pixel-art SVG rotate icon (no emoji) matching the pixel-art aesthetic.
 * Only appears on screens narrower than 600px in portrait mode.
 */

import React, { useEffect, useState } from 'react'
import { palette, accents, text, fonts, shadows, borders, zIndex, type as typo } from '@/styles/tokens'

/** Pixel-art phone-rotate icon as inline SVG (no emoji). */
function RotateIcon() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Phone body (portrait) */}
      <rect x="10" y="4" width="12" height="20" fill={palette.wood700} />
      <rect x="11" y="5" width="10" height="18" fill={palette.surface} />
      <rect x="11" y="6" width="10" height="14" fill={palette.wood900} />
      {/* Screen content hint */}
      <rect x="13" y="8" width="6" height="2" fill={accents.gold} />
      <rect x="13" y="11" width="4" height="1" fill={text.faint} />
      <rect x="13" y="13" width="5" height="1" fill={text.faint} />
      {/* Home button */}
      <rect x="14" y="21" width="4" height="1" fill={palette.wood500} />
      {/* Rotation arrow */}
      <rect x="24" y="8" width="2" height="2" fill={accents.gold} />
      <rect x="26" y="10" width="2" height="2" fill={accents.gold} />
      <rect x="26" y="12" width="2" height="2" fill={accents.gold} />
      <rect x="24" y="14" width="2" height="2" fill={accents.gold} />
      <rect x="22" y="16" width="2" height="2" fill={accents.gold} />
      {/* Arrow head */}
      <rect x="20" y="14" width="2" height="2" fill={accents.gold} />
      <rect x="20" y="18" width="2" height="2" fill={accents.gold} />
      <rect x="22" y="16" width="2" height="2" fill={accents.gold} />
      {/* Small landscape ghost */}
      <rect x="3" y="24" width="10" height="6" fill={palette.wood500} rx="0" />
      <rect x="4" y="25" width="8" height="4" fill={palette.wood900} />
      <rect x="5" y="26" width="4" height="1" fill={accents.green} />
    </svg>
  )
}

export function PortraitGuard() {
  const [showGuard, setShowGuard] = useState(false)

  useEffect(() => {
    function check() {
      const isNarrow = window.innerWidth < 600
      const isPortrait = window.innerHeight > window.innerWidth
      setShowGuard(isNarrow && isPortrait)
    }

    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)

    // Also listen to screen.orientation if available
    if (screen.orientation) {
      screen.orientation.addEventListener('change', check)
    }

    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', check)
      }
    }
  }, [])

  if (!showGuard) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.wallet + 10, // above everything
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: palette.surface,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          border: borders.standard,
          background: palette.wood900,
          padding: '24px 20px',
          boxShadow: shadows.hard,
          maxWidth: 320,
          width: '100%',
        }}
      >
        <RotateIcon />
        <h2
          style={{
            ...typo.hdr,
            fontFamily: fonts.header,
            color: accents.gold,
            margin: '16px 0 8px',
          }}
        >
          ROTATE DEVICE
        </h2>
        <p
          style={{
            ...typo.body,
            fontFamily: fonts.body,
            color: text.dim,
            margin: 0,
          }}
        >
          Moneyball Cabinet is designed for landscape view. Please rotate your
          device for the best experience.
        </p>
      </div>
    </div>
  )
}
