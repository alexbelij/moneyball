/**
 * nonceStore | v0.2.0 | 2026-06-17
 * Purpose: In-memory nonce issuance + consumption for Sui sign-in.
 *
 * T56: LIMITATION — this store is in-memory and per-process. On a Render
 * redeploy or instance restart, all pending nonces are lost (users must
 * re-initiate sign-in). This is acceptable for the hackathon because Render
 * runs a single instance. For production multi-instance deployments, replace
 * with Redis or similar.
 *
 * T56: added periodic sweep — every 60s, expired and used nonces are pruned
 * so the Map cannot grow unbounded under sustained traffic.
 */

import crypto from 'node:crypto'

export type NonceRecord = {
  suiAddress: string
  nonce: string
  issuedAt: string
  expiresAt: string
  message: string
  used: boolean
}

/** Sweep interval: prune expired/used nonces every 60 seconds. */
const SWEEP_INTERVAL_MS = 60_000

export class NonceStore {
  private byNonce = new Map<string, NonceRecord>()
  private sweepTimer: ReturnType<typeof setInterval> | null = null

  constructor(private ttlMs: number) {
    // T56: start the background sweep so the store stays bounded.
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    // Allow the process to exit cleanly even if the timer is still running.
    if (this.sweepTimer && typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
      this.sweepTimer.unref()
    }
  }

  issue(input: { suiAddress: string; message: string }): NonceRecord {
    const nonce = crypto.randomUUID()
    const issuedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + this.ttlMs).toISOString()

    const rec: NonceRecord = {
      suiAddress: input.suiAddress.toLowerCase(),
      nonce,
      issuedAt,
      expiresAt,
      message: input.message,
      used: false,
    }

    this.byNonce.set(nonce, rec)
    // Return the stored record so callers can mutate message (auth flow
    // builds the canonical message after issuance using the nonce/timestamps).
    return rec
  }

  consumeOrThrow(input: { suiAddress: string; nonce: string; message: string }) {
    const rec = this.byNonce.get(input.nonce)
    if (!rec) throw new Error('INVALID_NONCE')
    if (rec.used) throw new Error('NONCE_REPLAY')
    if (Date.now() > Date.parse(rec.expiresAt)) throw new Error('NONCE_EXPIRED')
    if (rec.suiAddress !== input.suiAddress.toLowerCase()) throw new Error('NONCE_ADDRESS_MISMATCH')
    if (rec.message !== input.message) throw new Error('MESSAGE_MISMATCH')
    rec.used = true
    return rec
  }

  /** T56: prune expired and used nonces to prevent unbounded Map growth. */
  private sweep() {
    const now = Date.now()
    for (const [nonce, rec] of this.byNonce) {
      if (rec.used || now > Date.parse(rec.expiresAt)) {
        this.byNonce.delete(nonce)
      }
    }
  }

  /** Cleanup for tests. */
  destroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
  }
}
