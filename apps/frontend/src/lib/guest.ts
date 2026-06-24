/**
 * guest | v1.0.0 | 2026-06-24
 * Purpose: Generate and persist an anonymous guest identifier.
 *          Used by the API client to send `x-guest-id` so the backend can
 *          attribute guest-mode memory reads/writes without a wallet login.
 *
 * Contract (see test/guest.test.ts):
 *   - First call generates a UUID and stores it under `moneyball.guestId`.
 *   - Subsequent calls return the same stored value.
 *   - An existing stored value is returned verbatim.
 */

const STORAGE_KEY = 'moneyball.guestId'

/** RFC4122 v4 UUID with a safe fallback for older browsers/test envs. */
function generateUuid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()

  // Fallback: build a v4 UUID from random bytes.
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  )
}

/**
 * Returns a stable, per-browser guest id, generating and persisting one on
 * first use. Safe to call repeatedly.
 */
export function getGuestId(): string {
  let id: string | null = null
  try {
    id = localStorage.getItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable (e.g. SSR / privacy mode) — fall through.
  }

  if (!id) {
    id = generateUuid()
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Best-effort persistence; an in-memory id is still returned.
    }
  }

  return id
}
