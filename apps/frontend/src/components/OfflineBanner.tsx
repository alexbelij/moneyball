/**
 * OfflineBanner | v1.0.0 | 2026-06-13
 * Purpose: Shows a fixed banner when the socket is disconnected.
 * T18: pixel-styled offline indicator, driven by gameStore.isConnected.
 * Respects design-spec: --bg-black, monospace fallback, 2px border, no radius.
 */

import React from 'react'
import { useGameStore } from '@/store/gameStore'

const BANNER_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  padding: '6px 12px',
  background: '#181009',
  color: '#c03030',
  borderBottom: '2px solid #c03030',
  fontFamily: '"VT323", "Press Start 2P", monospace',
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
