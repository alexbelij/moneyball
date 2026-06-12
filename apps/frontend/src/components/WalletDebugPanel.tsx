/**
 * WalletDebugPanel | v0.3.0 | 2026-06-12
 * Purpose: Troubleshoot Wallet Standard connectivity (Slush) + show accounts exposed.
 */

import React, { useMemo, useState } from 'react'
import { useWallets, useAccounts, useCurrentWallet, useCurrentAccount } from '@mysten/dapp-kit'

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
      position: 'absolute', top: 80, right: 12, zIndex: 100,
      background: 'rgba(0,0,0,0.78)', border: '1px solid #374151',
      borderRadius: 8, padding: 10, color: '#e5e7eb', fontSize: 11,
      width: 420, pointerEvents: 'auto',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Wallet Debug</div>

      <div>Detected wallets: {wallets.length}</div>
      <div style={{ opacity: 0.85, marginBottom: 6 }}>
        {wallets.map(w => w.name).join(', ') || '—'}
      </div>

      <div>Current wallet: {currentWallet.currentWallet?.name ?? '—'}</div>
      <div>Accounts exposed: {accounts.length}</div>
      <div style={{ opacity: 0.85, marginBottom: 6, wordBreak: 'break-all' }}>
        {accounts.map(a => a.address).join(', ') || '—'}
      </div>

      <div>Current account: {currentAccount?.address ?? '—'}</div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #374151' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Direct Wallet Standard connect</div>
        <button
          disabled={directBusy}
          onClick={directConnect}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #2563eb',
            background: directBusy ? '#111827' : '#1d4ed8',
            color: '#fff',
            cursor: directBusy ? 'not-allowed' : 'pointer',
            fontSize: 12,
          }}
        >
          {directBusy ? 'Connecting…' : 'Direct standard:connect (Slush)'}
        </button>

        {directErr && (
          <div style={{ marginTop: 8, color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
            Error: {directErr}
          </div>
        )}

        {directResult && (
          <pre style={{
            marginTop: 8,
            maxHeight: 160,
            overflow: 'auto',
            background: 'rgba(255,255,255,0.06)',
            padding: 8,
            borderRadius: 8,
            fontSize: 10,
          }}>
            {JSON.stringify(directResult, null, 2)}
          </pre>
        )}

        <div style={{ opacity: 0.75, marginTop: 8 }}>
          If this fails too, the issue is Slush/browser permissions (not dapp-kit UI).
        </div>
      </div>
    </div>
  )
}
