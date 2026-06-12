/**
 * LiteModeToggle.test.tsx | v1.0.0 | 2026-06-12
 * Purpose: Tests for LiteModeToggle — a11y attributes, keyboard operation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Ensure WebGL + matchMedia are available before store initializes
Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import { LiteModeToggle } from '@/components/LiteModeToggle'
import { useUiPrefs } from '@/store/uiPrefs'

describe('LiteModeToggle', () => {
  beforeEach(() => {
    useUiPrefs.getState().setLiteMode(false)
  })

  it('renders with role="switch" and correct aria-checked', () => {
    render(<LiteModeToggle />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeInTheDocument()
    // liteMode is false → arcade is ON → aria-checked should be true (switch shows full mode)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('updates aria-checked when toggled', async () => {
    const user = userEvent.setup()
    render(<LiteModeToggle />)
    const toggle = screen.getByRole('switch')

    await user.click(toggle)
    // Now liteMode is true → aria-checked should be false
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles on Enter key', async () => {
    const user = userEvent.setup()
    render(<LiteModeToggle />)
    const toggle = screen.getByRole('switch')

    toggle.focus()
    await user.keyboard('{Enter}')
    expect(useUiPrefs.getState().liteMode).toBe(true)
  })

  it('toggles on Space key', async () => {
    const user = userEvent.setup()
    render(<LiteModeToggle />)
    const toggle = screen.getByRole('switch')

    toggle.focus()
    await user.keyboard(' ')
    expect(useUiPrefs.getState().liteMode).toBe(true)
  })

  it('has an accessible label', () => {
    render(<LiteModeToggle />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-label')
    expect(toggle.getAttribute('aria-label')).toMatch(/mode/i)
  })
})
