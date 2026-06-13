/**
 * WalletFlowOverlay | v0.2.0 | 2026-06-13
 * Purpose: Blur/freeze overlay while wallet modal/auth flow is active.
 * T14: pixel-styled per design-spec (no border-radius, 2px borders, room palette).
 */

import React from 'react'
import { useGameStore } from '@/store/gameStore'

const C = {
  bg: '#0c0c0c',
  wood900: '#181009',
  wood700: '#3a3020',
  wood500: '#7a7060',
  paper: '#f4ede2',
  gold: '#e8a44a',
  fontBody: '"VT323", "Press Start 2P", monospace',
  fontHeader: '"Press Start 2P", monospace',
} as const

export function WalletFlowOverlay() {
  const active = useGameStore((s) => s.ui.isWalletFlowActive)
  if (!active) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: C.wood900,
          border: `2px solid ${C.wood700}`,
          borderRadius: 0,
          padding: '14px 18px',
          color: C.paper,
          fontFamily: C.fontBody,
          fontSize: 15,
          textAlign: 'center',
          width: 280,
          boxShadow: `4px 4px 0 ${C.bg}`,
        }}
      >
        <div style={{
          fontWeight: 700, marginBottom: 6,
          fontFamily: C.fontHeader, fontSize: 10,
          letterSpacing: '-0.5px', color: C.gold,
        }}>
          WALLET FLOW
        </div>
        <div>Connecting / waiting for signature…</div>
        <div style={{ color: C.wood500, marginTop: 6, fontSize: 13 }}>
          The world is paused to keep UX responsive.
        </div>
      </div>
    </div>
  )
}
