/**
 * uiPrefs.ts | v1.0.0 | 2026-06-12
 * Purpose: Persisted UI preferences store — lite mode toggle with localStorage
 * and automatic defaults based on WebGL support / reduced-motion preference.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  applyFontVars,
  DEFAULT_FONT,
  DEFAULT_SCALE,
  FONT_STACKS,
  type FontChoice,
} from '@/styles/uiFont'

const STORAGE_KEY = 'moneyball.liteMode'
const FONT_KEY = 'moneyball.fontChoice'
const FONT_SCALE_KEY = 'moneyball.fontScale'

function readFontChoice(): FontChoice {
  try {
    const raw = localStorage.getItem(FONT_KEY)
    if (raw && raw in FONT_STACKS) return raw as FontChoice
  } catch {
    /* localStorage may be unavailable */
  }
  return DEFAULT_FONT
}

function readFontScale(): number {
  try {
    const raw = Number(localStorage.getItem(FONT_SCALE_KEY))
    if (raw >= 0.8 && raw <= 1.6) return raw
  } catch {
    /* localStorage may be unavailable */
  }
  return DEFAULT_SCALE
}

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
  /** Body font choice (header stays Press Start 2P). */
  fontChoice: FontChoice
  setFontChoice: (value: FontChoice) => void
  /** Global UI text size multiplier (drives --mb-font-scale). */
  fontScale: number
  setFontScale: (value: number) => void
}

const initialValue = readStoredValue() ?? detectDefaultLiteMode()
const initialFont = readFontChoice()
const initialScale = readFontScale()

// Apply persisted font prefs to the document immediately on module load so the
// first paint already uses the chosen font/size (no flash to default).
applyFontVars(initialFont, initialScale)

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

    fontChoice: initialFont,
    setFontChoice: (value: FontChoice) =>
      set((s) => {
        try {
          localStorage.setItem(FONT_KEY, value)
        } catch {
          /* ignore */
        }
        applyFontVars(value, s.fontScale)
        return { fontChoice: value }
      }),

    fontScale: initialScale,
    setFontScale: (value: number) =>
      set((s) => {
        try {
          localStorage.setItem(FONT_SCALE_KEY, String(value))
        } catch {
          /* ignore */
        }
        applyFontVars(s.fontChoice, value)
        return { fontScale: value }
      }),
  })),
)
