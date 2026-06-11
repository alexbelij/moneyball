/**
 * HUD | v0.6.0 | 2026-06-09
 * Purpose: Connection indicator + wallet controls + sign-in/out.
 */

import React, { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useSuiAuth } from '@/hooks/useSuiAuth'
import { useAuthStore } from '@/store/authStore'
import { WalletControls } from '@/components/WalletControls'

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
        position: 'absolute', top: 12, left: 12, zIndex: 50,
        background: 'rgba(0,0,0,0.55)', padding: '6px 10px', borderRadius: 8,
        color: '#e5e7eb', fontSize: 12,
      }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: 999,
          marginRight: 6, background: isConnected ? '#10b981' : '#ef4444',
        }} />
        {isConnected ? 'Live' : 'Connecting…'} · {count} agents
      </div>

      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 60,
        display: 'flex', gap: 8, alignItems: 'center',
        pointerEvents: 'auto',
      }}>
        <WalletControls />

        {account && !viewer && (
          <button
            disabled={busy}
            onClick={async () => {
              setErr(null); setBusy(true)
              setWalletFlowActive(true)
              try { await signIn() } catch (e: any) { setErr(e.message ?? String(e)) }
              finally { setBusy(false); setWalletFlowActive(false) }
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #2563eb',
              background: '#1d4ed8',
              color: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            {busy ? 'Signing…' : 'Admin / Creator Sign In'}
          </button>
        )}

        {viewer && (
          <button
            onClick={signOut}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #374151',
              background: 'rgba(0,0,0,0.55)',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontSize: 12,
            }}
            title={viewer.suiAddress}
          >
            {viewer.role === 'admin' ? 'ADMIN' : 'USER'} · Sign Out
          </button>
        )}
      </div>

      {err && (
        <div style={{
          position: 'absolute', top: 52, right: 12, zIndex: 70,
          background: 'rgba(127,29,29,0.8)',
          border: '1px solid rgba(239,68,68,0.4)',
          color: '#fecaca',
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 12,
          pointerEvents: 'none',
        }}>
          {err}
        </div>
      )}
    </>
  )
}
