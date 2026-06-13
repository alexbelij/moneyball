/**
 * WalletDebugPanel | v0.4.0 | 2026-06-13
 * Purpose: Troubleshoot Wallet Standard connectivity (Slush) + show accounts exposed.
 * T33: migrated to shared tokens.
 */

import React, { useMemo, useState } from 'react'
import { useWallets, useAccounts, useCurrentWallet, useCurrentAccount } from '@mysten/dapp-kit'
import { palette, accents, text, fonts, borders, shadows, zIndex } from '@/styles/tokens'

export function WalletDebugPanel() {
  const wallets = useWallets()
  const accounts = useAccounts()
  const currentWallet = useCurrentWallet()
  const currentAccount = useCurrentAccount()

  const slush = useMemo(() => wallets.find(w => (w.name ?? '').toLowerCase().includes('slush')) as any, [wallets])

  const [directBusy, setDirectBusy] = useState(false)
  const [directErr, setDirectErr] = useState<string | null>(null)
  const [directResult, setDirectResult] = useState<any>(null)

  async function directConnect() {
    setDirectErr(null)
    setDirectResult(null)
    if (!slush) return setDirectErr('Slush wallet not found in useWallets().')
    const connectFeature = slush.features?.['standard:connect']
    if (!connectFeature?.connect) return setDirectErr('Slush does not expose standard:connect.')
    setDirectBusy(true)
    try {
      const res = await connectFeature.connect()
      setDirectResult(res)
    } catch (e: any) {
      setDirectErr(e?.message ?? String(e))
    } finally {
      setDirectBusy(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', top: 80, right: 12, zIndex: zIndex.debug,
      background: palette.wood900, border: borders.standard,
      borderRadius: 0, padding: 10, color: palette.paper,
      fontSize: 14, fontFamily: fonts.body,
      width: 420, pointerEvents: 'auto',
      boxShadow: shadows.hard,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: fonts.header, fontSize: 10, letterSpacing: '-0.5px' }}>WALLET DEBUG</div>

      <div>Detected wallets: {wallets.length}</div>
      <div style={{ color: text.dim, marginBottom: 6 }}>
        {wallets.map(w => w.name).join(', ') || '—'}
      </div>

      <div>Current wallet: {currentWallet.currentWallet?.name ?? '—'}</div>
      <div>Accounts exposed: {accounts.length}</div>
      <div style={{ color: text.dim, marginBottom: 6, wordBreak: 'break-all' }}>
        {accounts.map(a => a.address).join(', ') || '—'}
      </div>

      <div>Current account: {currentAccount?.address ?? '—'}</div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: borders.standard }}>
        <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: fonts.header, fontSize: 10, letterSpacing: '-0.5px' }}>DIRECT WALLET STANDARD CONNECT</div>
        <button
          disabled={directBusy}
          onClick={directConnect}
          style={{
            padding: '6px 10px',
            borderRadius: 0,
            border: borders.standard,
            background: directBusy ? palette.wood900 : accents.gold,
            color: directBusy ? text.muted : palette.wood900,
            cursor: directBusy ? 'not-allowed' : 'pointer',
            fontSize: 14, fontFamily: fonts.body, fontWeight: 700,
            boxShadow: shadows.hardSmall,
          }}
        >
          {directBusy ? 'Connecting…' : 'Direct standard:connect (Slush)'}
        </button>

        {directErr && (
          <div style={{ marginTop: 8, color: accents.red, whiteSpace: 'pre-wrap' }}>
            Error: {directErr}
          </div>
        )}

        {directResult && (
          <pre style={{
            marginTop: 8,
            maxHeight: 160,
            overflow: 'auto',
            background: palette.surface,
            padding: 8,
            borderRadius: 0,
            border: borders.standard,
            fontSize: 12,
            color: text.dim,
          }}>
            {JSON.stringify(directResult, null, 2)}
          </pre>
        )}

        <div style={{ color: text.muted, marginTop: 8 }}>
          If this fails too, the issue is Slush/browser permissions (not dapp-kit UI).
        </div>
      </div>
    </div>
  )
}
