/**
 * test/setup.ts | v1.0.0 | 2026-06-12
 * Purpose: Vitest setup — jest-dom matchers + localStorage mock for jsdom.
 */
import '@testing-library/jest-dom/vitest'

// jsdom provides localStorage by default but let's ensure clean state
beforeEach(() => {
  localStorage.clear()
})
