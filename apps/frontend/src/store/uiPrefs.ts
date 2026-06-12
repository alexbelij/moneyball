/**
 * uiPrefs.ts | v1.0.0 | 2026-06-12
 * Purpose: Persisted UI preferences store — lite mode toggle with localStorage
 * and automatic defaults based on WebGL support / reduced-motion preference.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const STORAGE_KEY = 'moneyball.liteMode'

function detectDefaultLiteMode(): boolean {
  // Prefer lite mode when WebGL is unavailable
  if (typeof WebGLRenderingContext === 'undefined') return true

  // Prefer lite mode when user prefers reduced motion
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return true
  }

  return false
}

function readStoredValue(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return null
  } catch {
    return null
  }
}

function persistValue(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // localStorage may be unavailable (e.g. private browsing quota exceeded)
  }
}

interface UiPrefsState {
  liteMode: boolean
  toggleLiteMode: () => void
  setLiteMode: (value: boolean) => void
}

const initialValue = readStoredValue() ?? detectDefaultLiteMode()

export const useUiPrefs = create<UiPrefsState>()(
  subscribeWithSelector((set) => ({
    liteMode: initialValue,

    toggleLiteMode: () =>
      set((s) => {
        const next = !s.liteMode
        persistValue(next)
        return { liteMode: next }
      }),

    setLiteMode: (value: boolean) =>
      set(() => {
        persistValue(value)
        return { liteMode: value }
      }),
  })),
)
