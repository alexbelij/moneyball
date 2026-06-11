/**
 * WalletControls | v0.1.0 | 2026-06-09
 * Purpose: Deterministic wallet UX (connect/disconnect/switch account) + pause integration.
 */

import React, { useMemo, useState } from 'react'
import {
  useAccounts,
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSwitchAccount,
  useWallets,
} from '@mysten/dapp-kit'
import { useGameStore } from '@/store/gameStore'

export function WalletControls() {
  const wallets = useWallets()
  const currentWallet = useCurrentWallet()
  const accounts = useAccounts()
  const currentAccount = useCurrentAccount()

  const setWalletFlowActive = useGameStore((s) => s.setWalletFlowActive)

  const { mutateAsync: connectWallet } = useConnectWallet() as any
  const { mutateAsync: disconnectWallet } = useDisconnectWallet() as any
  const { mutateAsync: switchAccount } = useSwitchAccount() as any

  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [openAccounts, setOpenAccounts] = useState(false)

  const slush = useMemo(
    () => wallets.find((w) => (w.name ?? '').toLowerCase().includes('slush')),
    [wallets],
  )

  async function onConnect(walletName?: string) {
    setErr(null)
    setBusy(true)
    setWalletFlowActive(true)
    try {
      const wallet = walletName
        ? wallets.find((w) => w.name === walletName)
        : slush ?? wallets[0]

      if (!wallet) throw new Error('No wallets detected')
      await connectWallet({ wallet })
      setOpen(false)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setBusy(false)
      setWalletFlowActive(false)
    }
  }

  async function onDisconnect() {
    setErr(null)
    setBusy(true)
    setWalletFlowActive(true)
    try {
      await disconnectWallet()
      setOpen(false)
      setOpenAccounts(false)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setBusy(false)
      setWalletFlowActive(false)
    }
  }

  async function onSwitch(addr: string) {
    setErr(null)
    setBusy(true)
    setWalletFlowActive(true)
    try {
      const account = accounts.find((a) => a.address === addr)
      if (!account) throw new Error('Account not found in exposed accounts list')
      await switchAccount({ account })
      setOpenAccounts(false)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setBusy(false)
      setWalletFlowActive(false)
    }
  }

  const connected = !!currentAccount?.address
  const short = connected ? `${currentAccount!.address.slice(0, 6)}…${currentAccount!.address.slice(-4)}` : 'Connect'

  return (
    <div style={{ position: 'relative', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      {!connected ? (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={busy}
            style={btn('#374151', 'rgba(0,0,0,0.55)', '#e5e7eb')}
          >
            {busy ? 'Connecting…' : 'Connect wallet'}
          </button>

          {open && (
            <div style={menu()}>
              <div style={menuTitle()}>Select wallet</div>
              {wallets.map((w) => (
                <button key={w.name} onClick={() => onConnect(w.name)} style={menuItem()}>
                  {w.name}
                </button>
              ))}
              {wallets.length === 0 && <div style={menuText()}>No wallets detected</div>}
            </div>
          )}
        </>
      ) : (
        <>
          <button onClick={() => setOpenAccounts((v) => !v)} style={btn('#374151', 'rgba(0,0,0,0.55)', '#e5e7eb')}>
            {short}
          </button>

          {openAccounts && (
            <div style={menu()}>
              <div style={menuTitle()}>
                Wallet: {currentWallet?.name ?? '—'} · Accounts: {accounts.length}
              </div>

              {accounts.map((a) => (
                <button
                  key={a.address}
                  onClick={() => onSwitch(a.address)}
                  style={menuItem(a.address === currentAccount?.address)}
                >
                  {a.address.slice(0, 10)}…{a.address.slice(-6)}
                </button>
              ))}

              <div style={{ height: 8 }} />
              <button onClick={onDisconnect} style={menuItem(false, true)}>
                Disconnect
              </button>
            </div>
          )}
        </>
      )}

      {err && <div style={{ color: '#fca5a5', fontSize: 11, maxWidth: 260 }}>{err}</div>}
    </div>
  )
}

function btn(border: string, bg: string, color: string) {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: bg,
    color,
    cursor: 'pointer',
    fontSize: 12,
  } as const
}

function menu() {
  return {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: 10,
    minWidth: 320,
    padding: 8,
    zIndex: 2000,
    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
  } as const
}

function menuTitle() {
  return { color: '#9ca3af', fontSize: 11, padding: '6px 8px' } as const
}

function menuText() {
  return { color: '#6b7280', fontSize: 12, padding: '6px 8px' } as const
}

function menuItem(active = false, danger = false) {
  return {
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 8,
    border: 'none',
    background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
    color: danger ? '#fca5a5' : active ? '#93c5fd' : '#e5e7eb',
    cursor: 'pointer',
    fontSize: 12,
  } as const
}
