/**
 * HUD | v0.7.0 | 2026-06-13
 * Purpose: Connection indicator + wallet controls + sign-in/out.
 * T33: migrated to shared tokens.
 */

import React, { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useSuiAuth } from '@/hooks/useSuiAuth'
import { useAuthStore } from '@/store/authStore'
import { WalletControls } from '@/components/WalletControls'
import { PixelButton } from '@/components/ui'
import { palette, accents, text, fonts, borders, shadows, zIndex } from '@/styles/tokens'

export function HUD() {
  const isConnected = useGameStore((s) => s.ui.isConnected)
  const count = Object.keys(useGameStore((s) => s.agents)).length
  const setWalletFlowActive = useGameStore((s) => s.setWalletFlowActive)

  const account = useCurrentAccount()
  const { signIn, signOut } = useSuiAuth()
  const viewer = useAuthStore((s) => s.viewer)

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <>
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: zIndex.hud,
        background: palette.wood900, padding: '6px 10px',
        border: borders.standard, borderRadius: 0,
        color: palette.paper, fontSize: 14, fontFamily: fonts.body,
        boxShadow: shadows.hardSmall,
      }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: 0,
          marginRight: 6, background: isConnected ? accents.green : accents.red,
        }} />
        {isConnected ? 'Live' : 'Connecting…'} · {count} agents
      </div>

      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: zIndex.hudRight,
        display: 'flex', gap: 8, alignItems: 'center',
        pointerEvents: 'auto',
      }}>
        <WalletControls />

        {account && !viewer && (
          <PixelButton
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setErr(null); setBusy(true)
              setWalletFlowActive(true)
              try { await signIn() } catch (e: any) { setErr(e.message ?? String(e)) }
              finally { setBusy(false); setWalletFlowActive(false) }
            }}
          >
            {busy ? 'Signing…' : 'Admin / Creator Sign In'}
          </PixelButton>
        )}

        {viewer && (
          <PixelButton onClick={signOut} title={viewer.suiAddress}>
            {viewer.role === 'admin' ? 'ADMIN' : 'USER'} · Sign Out
          </PixelButton>
        )}
      </div>

      {err && (
        <div style={{
          position: 'absolute', top: 52, right: 12, zIndex: zIndex.hudError,
          background: palette.wood900,
          border: `2px solid ${accents.red}`,
          borderRadius: 0,
          color: accents.red,
          padding: '6px 10px',
          fontSize: 14, fontFamily: fonts.body,
          pointerEvents: 'none',
          boxShadow: shadows.hardSmall,
        }}>
          {err}
        </div>
      )}
    </>
  )
}
