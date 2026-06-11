/**
 * AuthSync | v0.1.0 | 2026-06-09
 * Purpose: Ensure app JWT is bound to the currently selected wallet account.
 */

import React, { useEffect, useRef } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useAuthStore } from '@/store/authStore'

export function AuthSync() {
  const account = useCurrentAccount()
  const viewer = useAuthStore((s) => s.viewer)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const lastAccountRef = useRef<string | null>(null)

  useEffect(() => {
    const addr = account?.address?.toLowerCase() ?? null

    // If wallet account changed (or disconnected) — invalidate JWT session.
    if (lastAccountRef.current !== addr) {
      lastAccountRef.current = addr

      if (!addr) {
        if (viewer) clearAuth()
        return
      }

      if (viewer?.suiAddress && viewer.suiAddress.toLowerCase() !== addr) {
        clearAuth()
      }
    }
  }, [account?.address, viewer?.suiAddress, clearAuth])

  return null
}
