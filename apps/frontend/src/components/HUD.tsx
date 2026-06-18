/**
 * HUD | v1.0.0 | 2026-06-17
 * Purpose: Connection indicator + wallet controls + sign-in/out.
 * T67: useAsyncAction for sign-in, busy PixelButton, errors via toast.
 * T49: typography scale — body ≥16px; right cluster wraps on narrow screens.
 * T33: migrated to shared tokens.
 */

import React, { useCallback } from 'react'
import { useGameStore } from '@/store/gameStore'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useSuiAuth } from '@/hooks/useSuiAuth'
import { useAuthStore } from '@/store/authStore'
import { WalletControls } from '@/components/WalletControls'
import { PixelButton } from '@/components/ui'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { palette, accents, text, fonts, borders, shadows, zIndex, type as typo } from '@/styles/tokens'

export function HUD() {
  const isConnected = useGameStore((s) => s.ui.isConnected)
  const count = Object.keys(useGameStore((s) => s.agents)).length
  const setWalletFlowActive = useGameStore((s) => s.setWalletFlowActive)

  const account = useCurrentAccount()
  const { signIn, signOut } = useSuiAuth()
  const viewer = useAuthStore((s) => s.viewer)

  const signInAction = useAsyncAction(
    useCallback(async () => {
      setWalletFlowActive(true)
      try { await signIn() } finally { setWalletFlowActive(false) }
    }, [signIn, setWalletFlowActive]),
    { onError: 'toast' },
  )

  return (
    <>
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: zIndex.hud,
        background: palette.wood900, padding: '6px 10px',
        border: borders.standard, borderRadius: 0,
        color: palette.paper, ...typo.body, fontFamily: fonts.body,
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
        flexWrap: 'wrap', justifyContent: 'flex-end',
        maxWidth: 'calc(100vw - 24px)',
        pointerEvents: 'auto',
      }}>
        <WalletControls />

        {account && !viewer && (
          <PixelButton
            variant="primary"
            busy={signInAction.pending}
            onClick={signInAction.run}
          >
            {signInAction.pending ? 'Signing…' : 'Admin / Creator Sign In'}
          </PixelButton>
        )}

        {viewer && (
          <PixelButton onClick={signOut} title={viewer.suiAddress}>
            {viewer.role === 'admin' ? 'ADMIN' : 'USER'} · Sign Out
          </PixelButton>
        )}
      </div>
    </>
  )
}
