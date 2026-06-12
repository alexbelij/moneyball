/**
 * test/setup.ts | v1.1.0 | 2026-06-12
 * Purpose: Vitest setup — jest-dom matchers, RTL auto-cleanup (required with
 * globals:false), clean localStorage per test.
 */
import '@testing-library/jest-dom/vitest'
import { beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})
