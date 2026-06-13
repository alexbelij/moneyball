/**
 * WalletFlowOverlay | v0.3.0 | 2026-06-13
 * Purpose: Blur/freeze overlay while wallet modal/auth flow is active.
 * T14: pixel-styled per design-spec (no border-radius, 2px borders, room palette).
 * T33: migrated to shared tokens.
 */

import React from 'react'
import { useGameStore } from '@/store/gameStore'
import { palette, accents, text, fonts, borders, shadows, zIndex } from '@/styles/tokens'

export function WalletFlowOverlay() {
  const active = useGameStore((s) => s.ui.isWalletFlowActive)
  if (!active) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: zIndex.wallet,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: palette.wood900,
          border: borders.standard,
          borderRadius: 0,
          padding: '14px 18px',
          color: palette.paper,
          fontFamily: fonts.body,
          fontSize: 15,
          textAlign: 'center',
          width: 280,
          boxShadow: shadows.hard,
        }}
      >
        <div style={{
          fontWeight: 700, marginBottom: 6,
          fontFamily: fonts.header, fontSize: 10,
          letterSpacing: '-0.5px', color: accents.gold,
        }}>
          WALLET FLOW
        </div>
        <div>Connecting / waiting for signature…</div>
        <div style={{ color: text.muted, marginTop: 6, fontSize: 13 }}>
          The world is paused to keep UX responsive.
        </div>
      </div>
    </div>
  )
}
