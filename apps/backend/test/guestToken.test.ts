/**
 * guestToken.test | 2026-06-21
 * Validates HMAC guest identity tokens — prevents IDOR via forged guest ids.
 */
import { describe, it, expect } from 'vitest'
import { mintGuestToken, verifyGuestToken } from '../src/util/guestToken'

const SECRET = 'test-secret-key-1234'
const GUEST_ID = 'abcdef1234567890'

describe('guestToken', () => {
  it('minted token verifies back to the original guestId', () => {
    const token = mintGuestToken(GUEST_ID, SECRET)
    expect(verifyGuestToken(token, SECRET)).toBe(GUEST_ID)
  })

  it('rejects token signed with a different secret', () => {
    const token = mintGuestToken(GUEST_ID, SECRET)
    expect(verifyGuestToken(token, 'wrong-secret')).toBeNull()
  })

  it('rejects tampered guest id in token', () => {
    const token = mintGuestToken(GUEST_ID, SECRET)
    const tampered = 'tampered1234567890' + token.slice(token.lastIndexOf('.'))
    expect(verifyGuestToken(tampered, SECRET)).toBeNull()
  })

  it('rejects empty or malformed tokens', () => {
    expect(verifyGuestToken('', SECRET)).toBeNull()
    expect(verifyGuestToken('no-dot-separator', SECRET)).toBeNull()
    expect(verifyGuestToken('.only-sig', SECRET)).toBeNull()
  })

  it('token format is {guestId}.{hmac}', () => {
    const token = mintGuestToken(GUEST_ID, SECRET)
    const parts = token.split('.')
    expect(parts.length).toBe(2)
    expect(parts[0]).toBe(GUEST_ID)
    expect(parts[1]).toMatch(/^[0-9a-f]{64}$/) // sha256 hex
  })

  it('different guest ids produce different tokens', () => {
    const t1 = mintGuestToken('guest-aaaa-1111', SECRET)
    const t2 = mintGuestToken('guest-bbbb-2222', SECRET)
    expect(t1).not.toBe(t2)
  })
})
