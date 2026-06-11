/**
 * WalletFlowOverlay | v0.1.0 | 2026-06-09
 * Purpose: Blur/freeze overlay while wallet modal/auth flow is active.
 */

import React from 'react'
import { useGameStore } from '@/store/gameStore'

export function WalletFlowOverlay() {
  const active = useGameStore((s) => s.ui.isWalletFlowActive)
  if (!active) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: '12px 16px',
          color: '#e5e7eb',
          fontSize: 13,
          textAlign: 'center',
          width: 280,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Wallet flow</div>
        <div style={{ opacity: 0.9 }}>Connecting / waiting for signature…</div>
        <div style={{ opacity: 0.6, marginTop: 6, fontSize: 11 }}>
          The world is paused to keep UX responsive.
        </div>
      </div>
    </div>
  )
}
