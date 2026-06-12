/**
 * test/setup.ts | v1.1.0 | 2026-06-12
 * Purpose: Vitest setup — jest-dom matchers + clean localStorage per test.
 */
import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
})
