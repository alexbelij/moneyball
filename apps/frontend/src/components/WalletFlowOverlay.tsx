/**
 * WalletFlowOverlay | v0.4.0 | 2026-06-14
 * Purpose: Blur/freeze overlay while wallet modal/auth flow is active.
 * T49: typography scale — header ≥10px, body ≥16px.
 * T35: scrim backdrop uses semantic `overlay` token.
 * T33: migrated to shared tokens.
 */

import React from 'react'
import { useGameStore } from '@/store/gameStore'
import { palette, accents, text, fonts, borders, shadows, zIndex, overlay, type as typo } from '@/styles/tokens'

export function WalletFlowOverlay() {
  const active = useGameStore((s) => s.ui.isWalletFlowActive)
  if (!active) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: zIndex.wallet,
        background: overlay,
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
          ...typo.body,
          textAlign: 'center',
          width: 280,
          boxShadow: shadows.hard,
        }}
      >
        <div style={{
          fontWeight: 400, marginBottom: 6,
          fontFamily: fonts.header, ...typo.hdrXs,
          letterSpacing: '-0.5px', color: accents.gold,
        }}>
          WALLET FLOW
        </div>
        <div>Connecting / waiting for signature…</div>
        <div style={{ color: text.muted, marginTop: 6, ...typo.caption }}>
          The world is paused to keep UX responsive.
        </div>
      </div>
    </div>
  )
}
