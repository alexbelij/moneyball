/**
 * apiClient.test | v1.0.0 | 2026-06-17
 * T68: Tests for enhanced API client (ApiError, NetworkError, toastBus wiring).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules before importing anything that depends on them
vi.mock('../src/lib/guest', () => ({ getGuestId: () => 'test-guest' }))
vi.mock('../src/lib/config', () => ({ config: { backendUrl: 'http://localhost:3001' } }))
vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: () => ({ token: null }) },
}))

import { ApiError, NetworkError, roast } from '../src/lib/api'
import { onToast, type ToastEvent } from '../src/components/toast/toastBus'

describe('API client', () => {
  let toasts: ToastEvent[]
  let unsub: () => void

  beforeEach(() => {
    toasts = []
    unsub = onToast((e) => toasts.push(e))
    vi.restoreAllMocks()
  })

  afterEach(() => {
    unsub()
  })

  it('throws ApiError with parsed code for { error: { code, message } } responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { code: 'BAD_INPUT', message: 'Invalid agent ID.' } }),
    }))

    await expect(roast('bad')).rejects.toThrow(ApiError)
    try {
      await roast('bad')
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError)
      expect(e.code).toBe('BAD_INPUT')
      expect(e.message).toBe('Invalid agent ID.')
      expect(e.status).toBe(400)
    }
  })

  it('uses friendly fallback for HTTP 500 with generic server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { code: 'INTERNAL', message: 'An internal error occurred.' } }),
    }))

    try { await roast('x') } catch {}
    // Toast should have a friendly message, not the server's generic one
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Something went wrong on our end. Try again shortly.')
  })

  it('fires a toast on error by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { code: 'FORBIDDEN', message: 'Not allowed.' } }),
    }))

    try { await roast('x') } catch {}
    expect(toasts).toHaveLength(1)
    expect(toasts[0].variant).toBe('error')
    expect(toasts[0].message).toBe('Not allowed.')
  })

  it('handles non-JSON error bodies gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not JSON')),
    }))

    try { await roast('x') } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError)
      expect(e.message).toBe('The server is waking up — retrying shortly.')
    }
  })

  it('throws NetworkError on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    try { await roast('x') } catch (e: any) {
      expect(e).toBeInstanceOf(NetworkError)
      expect(e.isTimeout).toBe(false)
    }
    // Toast fired
    expect(toasts).toHaveLength(1)
    expect(toasts[0].variant).toBe('error')
  })

  it('parses successful JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, text: 'burn', meta: null }),
    }))

    const result = await roast('dr_morgan')
    expect(result).toEqual({ ok: true, text: 'burn', meta: null })
    expect(toasts).toHaveLength(0)
  })
})

describe('toastBus', () => {
  it('console-logs when no listener is registered', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Dynamically import to get a fresh reference (the module-level
    // listeners set is shared, but if no onToast() subscriber is added
    // before the call, it should fall through to console).
    const mod = await import('../src/components/toast/toastBus')
    // Temporarily clear any listeners added by prior tests
    const unsub = mod.onToast(() => {})
    unsub() // immediately remove so listeners set is empty

    mod.toast.error('test fallback')

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
