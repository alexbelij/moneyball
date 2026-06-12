/**
 * nonceStore.test | v1.0.0 | 2026-06-12
 * Tests for NonceStore: issue, consume, replay, expiry, address mismatch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NonceStore } from '../src/http/nonceStore'

describe('NonceStore', () => {
  let store: NonceStore

  beforeEach(() => {
    store = new NonceStore(300_000) // 5 min TTL
  })

  it('issues a nonce with correct fields', () => {
    const result = store.issue({ suiAddress: '0xABC', message: 'test msg' })
    expect(result.nonce).toBeTruthy()
    expect(result.issuedAt).toBeTruthy()
    expect(result.expiresAt).toBeTruthy()
    expect(result.message).toBe('test msg')
  })

  it('consumes a valid nonce', () => {
    const { nonce, message } = store.issue({ suiAddress: '0xabc', message: 'sign this' })
    const rec = store.consumeOrThrow({ suiAddress: '0xabc', nonce, message: 'sign this' })
    expect(rec.suiAddress).toBe('0xabc')
    expect(rec.used).toBe(true)
  })

  it('throws INVALID_NONCE for unknown nonce', () => {
    expect(() =>
      store.consumeOrThrow({ suiAddress: '0xabc', nonce: 'bogus', message: '' }),
    ).toThrow('INVALID_NONCE')
  })

  it('throws NONCE_REPLAY on double consume', () => {
    const { nonce, message } = store.issue({ suiAddress: '0xabc', message: 'm' })
    store.consumeOrThrow({ suiAddress: '0xabc', nonce, message: 'm' })
    expect(() =>
      store.consumeOrThrow({ suiAddress: '0xabc', nonce, message: 'm' }),
    ).toThrow('NONCE_REPLAY')
  })

  it('throws NONCE_ADDRESS_MISMATCH for wrong address', () => {
    const { nonce, message } = store.issue({ suiAddress: '0xabc', message: 'm' })
    expect(() =>
      store.consumeOrThrow({ suiAddress: '0xdef', nonce, message: 'm' }),
    ).toThrow('NONCE_ADDRESS_MISMATCH')
  })

  it('throws MESSAGE_MISMATCH for wrong message', () => {
    const { nonce } = store.issue({ suiAddress: '0xabc', message: 'original' })
    expect(() =>
      store.consumeOrThrow({ suiAddress: '0xabc', nonce, message: 'tampered' }),
    ).toThrow('MESSAGE_MISMATCH')
  })

  it('throws NONCE_EXPIRED for expired nonce', () => {
    vi.useFakeTimers()
    const shortStore = new NonceStore(1000) // 1s TTL
    const { nonce, message } = shortStore.issue({ suiAddress: '0xabc', message: 'm' })

    vi.advanceTimersByTime(2000) // 2s later
    expect(() =>
      shortStore.consumeOrThrow({ suiAddress: '0xabc', nonce, message: 'm' }),
    ).toThrow('NONCE_EXPIRED')

    vi.useRealTimers()
  })

  it('normalizes address to lowercase', () => {
    const { nonce, message } = store.issue({ suiAddress: '0xABC', message: 'm' })
    const rec = store.consumeOrThrow({ suiAddress: '0xabc', nonce, message: 'm' })
    expect(rec.suiAddress).toBe('0xabc')
  })
})
