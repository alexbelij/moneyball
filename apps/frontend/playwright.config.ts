/**
 * playwright.config | v1.0.0 | 2026-06-13
 * Purpose: Playwright e2e config for Moneyball frontend.
 * T21: vite preview + api-stub, screenshot artifacts.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx e2e/api-stub.ts',
      port: 4001,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm exec vite preview --port 4173',
      port: 4173,
      reuseExistingServer: true,
    },
  ],
})
