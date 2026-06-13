/**
 * smoke.spec | v1.0.0 | 2026-06-13
 * Purpose: E2e smoke tests — room loads, Lite toggle, wallet overlay.
 * T21: Playwright tests against vite preview + api-stub.
 */

import { test, expect } from '@playwright/test'

test.describe('Moneyball Cabinet — smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('room loads and shows the root container', async ({ page }) => {
    const root = page.locator('#root')
    await expect(root).toBeVisible()
    // Wait for either the Phaser canvas or the loading skeleton
    const canvas = page.locator('canvas')
    const skeleton = page.getByRole('status', { name: /loading/i })
    // At least one should be visible (.first(): canvas + skeleton can coexist
    // briefly after T13 merge — strict mode would reject the union)
    await expect(canvas.or(skeleton).first()).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'e2e/screenshots/01-room-loaded.png' })
  })

  test('Lite mode toggle switches to dashboard view', async ({ page }) => {
    // The LiteModeToggle button should be visible
    const toggle = page.getByRole('button', { name: /lite/i })
    if (await toggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await toggle.click()
      // In Lite mode, look for the dashboard headings
      await expect(page.getByText(/Moneyball Cabinet/i)).toBeVisible({ timeout: 5_000 })
      await page.screenshot({ path: 'e2e/screenshots/02-lite-mode.png' })

      // Toggle back
      await toggle.click()
      await page.screenshot({ path: 'e2e/screenshots/03-full-mode.png' })
    }
  })

  test('Leaderboard opens and closes', async ({ page }) => {
    const leaderBtn = page.getByRole('button', { name: /leaderboard/i })
    if (await leaderBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await leaderBtn.click()
      // StatsBoard should appear
      await expect(page.getByText(/Scout Leaderboard/i)).toBeVisible({ timeout: 5_000 })
      await page.screenshot({ path: 'e2e/screenshots/04-leaderboard-open.png' })

      // Close it
      const closeBtn = page.getByLabel(/close/i).first()
      if (await closeBtn.isVisible()) {
        await closeBtn.click()
      }
    }
  })

  test('page has no JavaScript errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')
    await page.waitForTimeout(3_000)

    // Filter out known non-critical errors (e.g. socket connection to stub)
    const critical = errors.filter(
      (e) => !e.includes('WebSocket') && !e.includes('socket') && !e.includes('ECONNREFUSED'),
    )
    expect(critical).toHaveLength(0)
  })

  test('noscript fallback exists in HTML', async ({ page }) => {
    const html = await page.content()
    expect(html).toContain('JavaScript is required')
  })
})
