/**
 * authStore.test.ts | v1.0.0 | 2026-06-12
 * Tests for authStore: setAuth, clearAuth, JWT parse, localStorage persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Must reset modules for each test since authStore reads localStorage on init
describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  function makeJwt(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const body = btoa(JSON.stringify(payload))
    return `${header}.${body}.fakesig`
  }

  it('starts with null token and viewer when no stored JWT', async () => {
    const { useAuthStore } = await import('@/store/authStore')
    const s = useAuthStore.getState()
    expect(s.token).toBeNull()
    expect(s.viewer).toBeNull()
  })

  it('restores viewer from a valid JWT in localStorage', async () => {
    const jwt = makeJwt({ sub: '0xabc123', role: 'admin', exp: 9999999999 })
    localStorage.setItem('moneyball.jwt', jwt)

    const { useAuthStore } = await import('@/store/authStore')
    const s = useAuthStore.getState()
    expect(s.token).toBe(jwt)
    expect(s.viewer?.suiAddress).toBe('0xabc123')
    expect(s.viewer?.role).toBe('admin')
  })

  it('ignores invalid JWT in localStorage', async () => {
    localStorage.setItem('moneyball.jwt', 'not.a.jwt')

    const { useAuthStore } = await import('@/store/authStore')
    expect(useAuthStore.getState().viewer).toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('setAuth persists token and viewer', async () => {
    const { useAuthStore } = await import('@/store/authStore')
    const jwt = makeJwt({ sub: '0xdef', role: 'user' })

    useAuthStore.getState().setAuth(jwt, { suiAddress: '0xdef', role: 'user' })

    expect(useAuthStore.getState().token).toBe(jwt)
    expect(useAuthStore.getState().viewer?.suiAddress).toBe('0xdef')
    expect(localStorage.getItem('moneyball.jwt')).toBe(jwt)
  })

  it('clearAuth removes token and viewer', async () => {
    const { useAuthStore } = await import('@/store/authStore')
    const jwt = makeJwt({ sub: '0xdef', role: 'user' })

    useAuthStore.getState().setAuth(jwt, { suiAddress: '0xdef', role: 'user' })
    useAuthStore.getState().clearAuth()

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().viewer).toBeNull()
    expect(localStorage.getItem('moneyball.jwt')).toBeNull()
  })
})
