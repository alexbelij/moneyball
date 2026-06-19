/**
 * WalletControls | v0.5.0 | 2026-06-17
 * Purpose: Deterministic wallet UX (connect/disconnect/switch account) + pause integration.
 * T67: useAsyncAction for all wallet operations, busy PixelButton, errors via toast.
 * T33: migrated to shared tokens.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useAsyncAction } from '@/hooks/useAsyncAction'
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

  const [open, setOpen] = useState(false)
  const [openAccounts, setOpenAccounts] = useState(false)

  const slush = useMemo(
    () => wallets.find((w) => (w.name ?? '').toLowerCase().includes('slush')),
    [wallets],
  )

  const connectAction = useAsyncAction(
    useCallback(async (walletName?: string) => {
      setWalletFlowActive(true)
      try {
        const wallet = walletName
          ? wallets.find((w) => w.name === walletName)
          : slush ?? wallets[0]
        if (!wallet) throw new Error('No wallets detected')
        await connectWallet({ wallet })
        setOpen(false)
      } finally {
        setWalletFlowActive(false)
      }
    }, [wallets, slush, connectWallet, setWalletFlowActive]),
    { onError: 'toast' },
  )

  const disconnectAction = useAsyncAction(
    useCallback(async () => {
      setWalletFlowActive(true)
      try {
        await disconnectWallet()
        setOpen(false)
        setOpenAccounts(false)
      } finally {
        setWalletFlowActive(false)
      }
    }, [disconnectWallet, setWalletFlowActive]),
    { onError: 'toast' },
  )

  const switchAction = useAsyncAction(
    useCallback(async (addr: string) => {
      setWalletFlowActive(true)
      try {
        const account = accounts.find((a) => a.address === addr)
        if (!account) throw new Error('Account not found in exposed accounts list')
        await switchAccount({ account })
        setOpenAccounts(false)
      } finally {
        setWalletFlowActive(false)
      }
    }, [accounts, switchAccount, setWalletFlowActive]),
    { onError: 'toast' },
  )

  const busy = connectAction.pending || disconnectAction.pending || switchAction.pending

  const connected = !!currentAccount?.address
  const short = connected ? `${currentAccount!.address.slice(0, 6)}…${currentAccount!.address.slice(-4)}` : 'Connect'

  const containerRef = useRef<HTMLDivElement>(null)

  /* Outside-click close for wallet popup */
  useEffect(() => {
    if (!open && !openAccounts) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setOpenAccounts(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, openAccounts])

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      {!connected ? (
        <>
          <PixelButton busy={connectAction.pending} onClick={() => setOpen((v) => !v)} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect wallet'}
          </PixelButton>

          {open && (
            <div style={menu()}>
              <div style={menuTitle()}>Select wallet</div>
              {wallets.map((w) => (
                <button key={w.name} onClick={() => connectAction.run(w.name)} style={menuItem()} disabled={busy}>
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
                  onClick={() => switchAction.run(a.address)}
                  style={menuItem(a.address === currentAccount?.address)}
                  disabled={busy}
                >
                  {a.address.slice(0, 10)}…{a.address.slice(-6)}
                </button>
              ))}

              <div style={{ height: 8 }} />
              <button onClick={disconnectAction.run} style={menuItem(false, true)} disabled={busy}>
                Disconnect
              </button>
            </div>
          )}
        </>
      )}
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
