/**
 * onboarding.test.tsx | v1.0.0 | 2026-06-17
 * Tests for T59: OnboardingOverlay — first-run walkthrough, localStorage persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingOverlay, resetOnboarding } from '@/components/OnboardingOverlay'

describe('OnboardingOverlay (T59)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetOnboarding()
  })

  it('shows first step on initial render', () => {
    render(<OnboardingOverlay />)
    expect(screen.getByText('Welcome to the Cabinet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('navigates through all steps with Next', async () => {
    render(<OnboardingOverlay />)
    const user = userEvent.setup()

    expect(screen.getByText('Welcome to the Cabinet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Explore the Agents')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Watch Memory Evolve')).toBeInTheDocument()

    // Last step shows "Got it" instead of "Next".
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument()
  })

  it('Back button navigates to previous step', async () => {
    render(<OnboardingOverlay />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Explore the Agents')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText('Welcome to the Cabinet')).toBeInTheDocument()
  })

  it('Skip dismisses and persists to localStorage', async () => {
    render(<OnboardingOverlay />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.queryByText('Welcome to the Cabinet')).not.toBeInTheDocument()
    expect(localStorage.getItem('moneyball.onboarding-done')).toBe('1')
  })

  it('Got it on last step dismisses and persists', async () => {
    render(<OnboardingOverlay />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /got it/i }))

    expect(screen.queryByText('Watch Memory Evolve')).not.toBeInTheDocument()
    expect(localStorage.getItem('moneyball.onboarding-done')).toBe('1')
  })

  it('does not render if already dismissed in localStorage', () => {
    localStorage.setItem('moneyball.onboarding-done', '1')
    render(<OnboardingOverlay />)
    expect(screen.queryByText('Welcome to the Cabinet')).not.toBeInTheDocument()
  })

  it('has accessible dialog role', () => {
    render(<OnboardingOverlay />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
