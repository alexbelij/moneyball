/**
 * authRoutes | v0.2.0 | 2026-06-17
 * Purpose: Production-style Sui sign-in (nonce + canonical message + signature verify + JWT).
 * T56: refactored inline NonceStore to use shared nonceStore.ts with TTL sweep;
 *      removed console.log of admin allowlist/login (information disclosure).
 */

import type { Express } from 'express'
import jwt from 'jsonwebtoken'
import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import { env } from '../config/env'
import { NonceStore } from './nonceStore'

function normAddr(a: string) {
  return a.trim().toLowerCase()
}

function buildCanonicalMessage(params: {
  domain: string
  address: string
  uri: string
  nonce: string
  issuedAt: string
  expiresAt: string
}) {
  return [
    `${params.domain} wants you to sign in with your Sui account:`,
    params.address,
    '',
    'Sign in to Moneyball Cabinet.',
    '',
    `URI: ${params.uri}`,
    'Version: 1',
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expiresAt}`,
  ].join('\n')
}

export function registerAuthRoutes(app: Express) {
  const store = new NonceStore(env.AUTH_NONCE_TTL_MS)

  app.post('/api/auth/nonce', (req, res) => {
    const suiAddress = normAddr(String(req.body?.suiAddress ?? ''))
    if (!suiAddress.startsWith('0x') || suiAddress.length < 10) {
      return res.status(400).json({ error: { code: 'BAD_SUI_ADDRESS', message: 'Invalid Sui address.' } })
    }

    // Issue with placeholder, then build message using issued values
    const placeholder = store.issue({ suiAddress, message: '__placeholder__' })
    const message = buildCanonicalMessage({
      domain: env.AUTH_DOMAIN,
      address: suiAddress,
      uri: env.AUTH_URI,
      nonce: placeholder.nonce,
      issuedAt: placeholder.issuedAt,
      expiresAt: placeholder.expiresAt,
    })
    // Mutate the stored record's message in-place (issue() returns the
    // actual stored NonceRecord reference, so consumeOrThrow sees it).
    placeholder.message = message

    return res.json({
      ok: true,
      nonce: placeholder.nonce,
      issuedAt: placeholder.issuedAt,
      expiresAt: placeholder.expiresAt,
      message,
    })
  })

  app.post('/api/auth/verify', async (req, res) => {
    const suiAddress = normAddr(String(req.body?.suiAddress ?? ''))
    const nonce = String(req.body?.nonce ?? '')
    const message = String(req.body?.message ?? '')
    const signature = String(req.body?.signature ?? '')

    if (!suiAddress || !nonce || !message || !signature) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'All fields are required.' } })
    }

    try {
      store.consumeOrThrow({ suiAddress, nonce, message })

      const messageBytes = new TextEncoder().encode(message)
      await verifyPersonalMessageSignature(messageBytes, signature, { address: suiAddress })

      const role: 'user' | 'admin' = env.ADMIN_ALLOWLIST.has(suiAddress) ? 'admin' : 'user'
      const token = jwt.sign({ sub: suiAddress, role }, env.JWT_SECRET, { expiresIn: '1h' })
      const decoded: any = jwt.decode(token)

      return res.json({
        ok: true,
        token,
        viewer: { suiAddress, role, exp: decoded?.exp },
      })
    } catch (e: any) {
      return res.status(401).json({ error: { code: 'AUTH_FAILED', message: e?.message ?? 'Authentication failed.' } })
    }
  })
}
