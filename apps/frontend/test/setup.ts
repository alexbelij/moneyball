/**
 * test/setup.ts | v1.0.0 | 2026-06-12
 * Purpose: Vitest setup — register jest-dom matchers and mock browser APIs.
 */

import '@testing-library/jest-dom/vitest'

// Provide a minimal localStorage mock for tests that run outside jsdom
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
      get length() { return Object.keys(store).length },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
    writable: true,
  })
}
