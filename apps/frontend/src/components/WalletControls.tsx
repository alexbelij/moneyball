/**
 * WalletControls | v0.4.0 | 2026-06-14
 * Purpose: Deterministic wallet UX (connect/disconnect/switch account) + pause integration.
 * T33: migrated to shared tokens.
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
import { PixelButton } from '@/components/ui'
import { palette, accents, text, fonts, borders, shadows, zIndex, type as typo } from '@/styles/tokens'

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
          <PixelButton onClick={() => setOpen((v) => !v)} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect wallet'}
          </PixelButton>

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
          <PixelButton onClick={() => setOpenAccounts((v) => !v)}>
            {short}
          </PixelButton>

          {openAccounts && (
            <div style={menu()}>
              <div style={menuTitle()}>
                Wallet: {currentWallet.currentWallet?.name ?? '—'} · Accounts: {accounts.length}
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

      {err && <div style={{ color: accents.red, ...typo.caption, maxWidth: 260, fontFamily: fonts.body }}>{err}</div>}
    </div>
  )
}

function menu() {
  return {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    background: palette.wood900,
    border: borders.standard,
    borderRadius: 0,
    minWidth: 320,
    padding: 8,
    zIndex: zIndex.dropdown,
    boxShadow: shadows.hard,
  } as const
}

function menuTitle() {
  return { color: text.muted, ...typo.caption, padding: '6px 8px', fontFamily: fonts.body } as const
}

function menuText() {
  return { color: text.faint, ...typo.dataSm, padding: '6px 8px', fontFamily: fonts.body } as const
}

function menuItem(active = false, danger = false) {
  return {
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 0,
    border: 'none',
    background: active ? `${accents.gold}30` : 'transparent',
    color: danger ? accents.red : active ? accents.gold : palette.paper,
    cursor: 'pointer',
    ...typo.dataSm,
    fontFamily: fonts.body,
  } as const
}
