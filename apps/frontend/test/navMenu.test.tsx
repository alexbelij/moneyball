/**
 * navMenu.test.tsx | v1.0.0 | 2026-06-17
 * Tests for T51: NavMenu component — renders button, dropdown, section navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavMenu } from '@/components/NavMenu'
import { useNavStore } from '@/store/navStore'

describe('NavMenu (T51)', () => {
  beforeEach(() => {
    useNavStore.setState({ active: null, menuOpen: false })
  })

  it('renders MENU button', () => {
    render(<NavMenu />)
    expect(screen.getByRole('button', { name: /open cabinet menu/i })).toBeInTheDocument()
  })

  it('opens dropdown on click', async () => {
    render(<NavMenu />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open cabinet menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /about/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /leaderboard/i })).toBeInTheDocument()
  })

  it('sets active section when clicking a menu item', async () => {
    render(<NavMenu />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open cabinet menu/i }))
    await user.click(screen.getByRole('menuitem', { name: /^about$/i }))

    expect(useNavStore.getState().active).toBe('about')
    expect(useNavStore.getState().menuOpen).toBe(false)
  })

  it('disables unavailable sections', async () => {
    render(<NavMenu />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open cabinet menu/i }))

    // "Connected agents" should be disabled.
    const connectedBtn = screen.getByRole('menuitem', { name: /connected/i })
    expect(connectedBtn).toBeDisabled()
  })

  it('closes dropdown on Escape', async () => {
    render(<NavMenu />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open cabinet menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('toggles dropdown on repeated clicks', async () => {
    render(<NavMenu />)
    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: /open cabinet menu/i })

    await user.click(btn)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(btn)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
