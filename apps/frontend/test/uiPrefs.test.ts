/**
 * uiPrefs.test.ts | v1.0.0 | 2026-06-12
 * Purpose: Tests for the uiPrefs store — init from localStorage/media query,
 * toggle persists, setLiteMode works.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// We need to re-import the module fresh for each test to reset the store.
// We'll use dynamic import after mocking.

describe('uiPrefs store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('defaults to false when WebGL is available and no reduced motion', async () => {
    // jsdom provides WebGLRenderingContext by default (or we can define it)
    // and matchMedia returns false for reduced motion
    Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

    const { useUiPrefs } = await import('@/store/uiPrefs')
    expect(useUiPrefs.getState().liteMode).toBe(false)
  })

  it('defaults to true when prefers-reduced-motion: reduce', async () => {
    Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any

    const { useUiPrefs } = await import('@/store/uiPrefs')
    expect(useUiPrefs.getState().liteMode).toBe(true)
  })

  it('reads stored value from localStorage over defaults', async () => {
    localStorage.setItem('moneyball.liteMode', 'true')
    Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

    const { useUiPrefs } = await import('@/store/uiPrefs')
    expect(useUiPrefs.getState().liteMode).toBe(true)
  })

  it('reads stored false value from localStorage', async () => {
    localStorage.setItem('moneyball.liteMode', 'false')
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any

    const { useUiPrefs } = await import('@/store/uiPrefs')
    expect(useUiPrefs.getState().liteMode).toBe(false)
  })

  it('toggleLiteMode flips value and persists to localStorage', async () => {
    Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

    const { useUiPrefs } = await import('@/store/uiPrefs')
    expect(useUiPrefs.getState().liteMode).toBe(false)

    useUiPrefs.getState().toggleLiteMode()
    expect(useUiPrefs.getState().liteMode).toBe(true)
    expect(localStorage.getItem('moneyball.liteMode')).toBe('true')

    useUiPrefs.getState().toggleLiteMode()
    expect(useUiPrefs.getState().liteMode).toBe(false)
    expect(localStorage.getItem('moneyball.liteMode')).toBe('false')
  })

  it('setLiteMode sets explicit value and persists', async () => {
    Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

    const { useUiPrefs } = await import('@/store/uiPrefs')

    useUiPrefs.getState().setLiteMode(true)
    expect(useUiPrefs.getState().liteMode).toBe(true)
    expect(localStorage.getItem('moneyball.liteMode')).toBe('true')

    useUiPrefs.getState().setLiteMode(false)
    expect(useUiPrefs.getState().liteMode).toBe(false)
    expect(localStorage.getItem('moneyball.liteMode')).toBe('false')
  })
})
