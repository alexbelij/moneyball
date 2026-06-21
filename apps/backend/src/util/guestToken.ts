/**
 * guestToken | v1.0.0 | 2026-06-21
 * Purpose: HMAC-signed guest identity tokens. Prevents IDOR — a guest id
 * minted on one client cannot be replayed by another because the HMAC
 * binds the id to a server-side secret (JWT_SECRET).
 *
 * Format: `{guestId}.{hmacHex}` — stateless, no expiry (guests are ephemeral
 * anyway; the id only gates ephemeral in-memory data like disagree/summary).
 */

import { createHmac } from 'node:crypto'

const HMAC_ALG = 'sha256'
const SEPARATOR = '.'

/**
 * Mint a signed guest token: `{guestId}.{hmacHex}`.
 * The guestId is the client-generated random value (opaque, 10-80 chars).
 */
export function mintGuestToken(guestId: string, secret: string): string {
  const sig = createHmac(HMAC_ALG, secret).update(guestId).digest('hex')
  return `${guestId}${SEPARATOR}${sig}`
}

/**
 * Parse and verify a signed guest token.
 * Returns the original guestId on success, null on forgery/malformat.
 */
export function verifyGuestToken(token: string, secret: string): string | null {
  const idx = token.lastIndexOf(SEPARATOR)
  if (idx < 1) return null
  const guestId = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  if (!guestId || !sig) return null
  const expected = createHmac(HMAC_ALG, secret).update(guestId).digest('hex')
  // Constant-time compare to prevent timing attacks
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0 ? guestId : null
}
