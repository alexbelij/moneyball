/**
 * OfflineBanner | v1.1.0 | 2026-06-13
 * Purpose: Shows a fixed banner when the socket is disconnected.
 * T18: pixel-styled offline indicator, driven by gameStore.isConnected.
 * T33: migrated to shared tokens.
 * Respects design-spec: --bg-black, monospace fallback, 2px border, no radius.
 */

import React from 'react'
import { useGameStore } from '@/store/gameStore'
import { palette, accents, fonts, zIndex } from '@/styles/tokens'

const BANNER_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: zIndex.topmost,
  pointerEvents: 'none',
  padding: '6px 12px',
  background: palette.wood900,
  color: accents.red,
  borderBottom: `2px solid ${accents.red}`,
  fontFamily: fonts.body,
  fontSize: '14px',
  textAlign: 'center',
  letterSpacing: '1px',
}

export function OfflineBanner() {
  const isConnected = useGameStore((s) => s.ui.isConnected)
  if (isConnected) return null
  return (
    <div role="status" aria-live="polite" style={BANNER_STYLE}>
      ■ OFFLINE — reconnecting to server…
    </div>
  )
}
