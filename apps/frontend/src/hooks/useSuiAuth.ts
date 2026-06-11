/**
 * useSuiAuth | v0.1.0 | 2026-06-09
 * Purpose: Wallet sign-in using backend canonical message -> JWT.
 */

import { useCallback } from 'react'
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit'
import { config } from '@/lib/config'
import { useAuthStore } from '@/store/authStore'

export function useSuiAuth() {
  const account = useCurrentAccount()
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage()
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const signIn = useCallback(async () => {
    if (!account?.address) throw new Error('Wallet not connected')
    const suiAddress = account.address

    const nonceRes = await fetch(new URL('/api/auth/nonce', config.backendUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ suiAddress }),
    })
    const nonceJson = await nonceRes.json().catch(() => ({}))
    if (!nonceRes.ok || !nonceJson?.ok) throw new Error(nonceJson?.error ?? `Nonce failed: ${nonceRes.status}`)

    const message: string = nonceJson.message
    const nonce: string = nonceJson.nonce

    const signed = await signPersonalMessage({
      message: new TextEncoder().encode(message),
    })

    const verifyRes = await fetch(new URL('/api/auth/verify', config.backendUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ suiAddress, nonce, message, signature: signed.signature }),
    })
    const verifyJson = await verifyRes.json().catch(() => ({}))
    if (!verifyRes.ok || !verifyJson?.ok) throw new Error(verifyJson?.error ?? `Verify failed: ${verifyRes.status}`)

    setAuth(verifyJson.token, verifyJson.viewer)
    return verifyJson.viewer as { suiAddress: string; role: 'user' | 'admin' }
  }, [account?.address, signPersonalMessage, setAuth])

  const signOut = useCallback(() => clearAuth(), [clearAuth])

  return { signIn, signOut, address: account?.address ?? null }
}
