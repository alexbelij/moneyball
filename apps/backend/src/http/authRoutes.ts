/**
 * authRoutes | v0.1.0 | 2026-06-09
 * Purpose: Production-style Sui sign-in (nonce + canonical message + signature verify + JWT).
 */

import type { Express } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import { env } from '../config/env'

type NonceRec = {
  suiAddress: string
  nonce: string
  issuedAt: string
  expiresAt: string
  message: string
  used: boolean
}

class NonceStore {
  private byNonce = new Map<string, NonceRec>()

  constructor(private ttlMs: number) { }

  issue(suiAddress: string, message: string) {
    const nonce = crypto.randomUUID()
    const issuedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + this.ttlMs).toISOString()

    const rec: NonceRec = {
      suiAddress: suiAddress.toLowerCase(),
      nonce,
      issuedAt,
      expiresAt,
      message,
      used: false,
    }

    this.byNonce.set(nonce, rec)
    return rec
  }

  consumeOrThrow(input: { suiAddress: string; nonce: string; message: string }): NonceRec {
    const rec = this.byNonce.get(input.nonce)
    if (!rec) throw new Error('INVALID_NONCE')
    if (rec.used) throw new Error('NONCE_REPLAY')
    if (Date.now() > Date.parse(rec.expiresAt)) throw new Error('NONCE_EXPIRED')
    if (rec.suiAddress !== input.suiAddress.toLowerCase()) throw new Error('NONCE_ADDRESS_MISMATCH')
    // production-style strict canonical message match:
    if (rec.message !== input.message) throw new Error('MESSAGE_MISMATCH')
    rec.used = true
    return rec
  }
}

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
      return res.status(400).json({ ok: false, error: 'BAD_SUI_ADDRESS' })
    }

    // issue with placeholder, then build message using issued values
    const placeholder = store.issue(suiAddress, '__placeholder__')
    const message = buildCanonicalMessage({
      domain: env.AUTH_DOMAIN,
      address: suiAddress,
      uri: env.AUTH_URI,
      nonce: placeholder.nonce,
      issuedAt: placeholder.issuedAt,
      expiresAt: placeholder.expiresAt,
    })
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
      return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' })
    }

    try {
      store.consumeOrThrow({ suiAddress, nonce, message })

      const messageBytes = new TextEncoder().encode(message)
      await verifyPersonalMessageSignature(messageBytes, signature, { address: suiAddress })

      console.log('ADMIN_ALLOWLIST=', [...env.ADMIN_ALLOWLIST])
      console.log('LOGIN_ADDRESS=', suiAddress)
      console.log('IS_ADMIN=', env.ADMIN_ALLOWLIST.has(suiAddress))

      const role: 'user' | 'admin' = env.ADMIN_ALLOWLIST.has(suiAddress) ? 'admin' : 'user'
      const token = jwt.sign({ sub: suiAddress, role }, env.JWT_SECRET, { expiresIn: '1h' })
      const decoded: any = jwt.decode(token)

      return res.json({
        ok: true,
        token,
        viewer: { suiAddress, role, exp: decoded?.exp },
      })
    } catch (e: any) {
      return res.status(401).json({ ok: false, error: e?.message ?? 'AUTH_FAILED' })
    }
  })
}
