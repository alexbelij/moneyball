/**
 * guest.test.ts | v1.0.0 | 2026-06-12
 * Tests for guest ID generation and persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('getGuestId', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('generates and stores a UUID on first call', async () => {
    const { getGuestId } = await import('@/lib/guest')
    const id = getGuestId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/) // UUID format
    expect(localStorage.getItem('moneyball.guestId')).toBe(id)
  })

  it('returns the same ID on subsequent calls', async () => {
    const { getGuestId } = await import('@/lib/guest')
    const id1 = getGuestId()
    const id2 = getGuestId()
    expect(id1).toBe(id2)
  })

  it('returns stored ID when already in localStorage', async () => {
    localStorage.setItem('moneyball.guestId', 'my-fixed-id')
    const { getGuestId } = await import('@/lib/guest')
    expect(getGuestId()).toBe('my-fixed-id')
  })
})
