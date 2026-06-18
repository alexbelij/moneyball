/**
 * asyncStates.test.tsx | T67 | 2026-06-17
 * Tests: useAsyncAction (pending lifecycle, re-entry guard, error routing),
 * Spinner (renders), Skeleton (variants), PixelButton busy prop.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'

/* ── useAsyncAction tests ────────────────────────────────────────────── */

import { useAsyncAction } from '../src/hooks/useAsyncAction'

/** Tiny test harness for the hook. */
function HookHarness({
  asyncFn,
  onError = 'toast',
}: {
  asyncFn: (...args: any[]) => Promise<unknown>
  onError?: 'toast' | 'inline'
}) {
  const { run, pending, error } = useAsyncAction(asyncFn, { onError })
  return (
    <div>
      <button data-testid="run" onClick={() => run()}>
        run
      </button>
      <span data-testid="pending">{String(pending)}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  )
}

describe('useAsyncAction', () => {
  it('tracks pending lifecycle (false → true → false)', async () => {
    let resolve!: () => void
    const fn = vi.fn(() => new Promise<void>((r) => { resolve = r }))

    render(<HookHarness asyncFn={fn} />)
    expect(screen.getByTestId('pending').textContent).toBe('false')

    // Start the action
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })
    expect(screen.getByTestId('pending').textContent).toBe('true')

    // Resolve
    await act(async () => { resolve() })
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })

  it('guards against re-entry while pending', async () => {
    let resolve!: () => void
    const fn = vi.fn(() => new Promise<void>((r) => { resolve = r }))

    render(<HookHarness asyncFn={fn} />)

    // First click
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })
    // Second click while pending
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })
    // Third click while pending
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })

    // Should only have been called once
    expect(fn).toHaveBeenCalledTimes(1)

    await act(async () => { resolve() })
  })

  it('routes errors to inline when onError=inline', async () => {
    const fn = vi.fn(async () => { throw new Error('test fail') })

    render(<HookHarness asyncFn={fn} onError="inline" />)
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })

    expect(screen.getByTestId('error').textContent).toBe('test fail')
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })

  it('routes errors to toastBus when onError=toast', async () => {
    // Mock toastBus
    const toastModule = await import('../src/components/toast/toastBus')
    const spy = vi.spyOn(toastModule.toast, 'error')

    const fn = vi.fn(async () => { throw new Error('toast error') })

    render(<HookHarness asyncFn={fn} onError="toast" />)
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })

    expect(spy).toHaveBeenCalledWith('toast error')
    expect(screen.getByTestId('error').textContent).toBe('')

    spy.mockRestore()
  })

  it('clears inline error on next run', async () => {
    let shouldFail = true
    const fn = vi.fn(async () => {
      if (shouldFail) throw new Error('first fail')
    })

    render(<HookHarness asyncFn={fn} onError="inline" />)

    // First run: fails
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })
    expect(screen.getByTestId('error').textContent).toBe('first fail')

    // Second run: succeeds
    shouldFail = false
    await act(async () => { fireEvent.click(screen.getByTestId('run')) })
    expect(screen.getByTestId('error').textContent).toBe('')
  })
})

/* ── Spinner tests ──────────────────────────────────────────────────── */

import { Spinner } from '../src/components/ui/Spinner'

describe('Spinner', () => {
  it('renders with role=status and Loading label', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el).toBeDefined()
    expect(el.getAttribute('aria-label')).toBe('Loading')
  })

  it('accepts custom size', () => {
    render(<Spinner size={20} />)
    const el = screen.getByRole('status')
    expect(el.style.width).toBe('20px')
    expect(el.style.height).toBe('20px')
  })
})

/* ── Skeleton tests ─────────────────────────────────────────────────── */

import { Skeleton, SkeletonRows } from '../src/components/ui/Skeleton'

describe('Skeleton', () => {
  it('renders a single text line by default', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el).toBeDefined()
    expect(el.getAttribute('aria-label')).toBe('Loading')
  })

  it('renders multiple lines for text variant', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />)
    const bars = container.querySelectorAll('.px-skeleton-bar')
    expect(bars.length).toBe(3)
  })

  it('renders block variant with custom height', () => {
    render(<Skeleton variant="block" height={100} />)
    const el = screen.getByRole('status')
    expect(el.style.height).toBe('100px')
  })

  it('renders SkeletonRows with specified count', () => {
    const { container } = render(<SkeletonRows count={4} />)
    // Each SkeletonRows renders a container with N Skeleton inside
    const statuses = container.querySelectorAll('[role="status"]')
    // Each Skeleton row has its own role=status
    expect(statuses.length).toBeGreaterThanOrEqual(4)
  })
})

/* ── PixelButton busy prop tests ────────────────────────────────────── */

import { PixelButton } from '../src/components/ui/PixelButton'

describe('PixelButton busy', () => {
  it('disables button and shows spinner when busy', () => {
    render(<PixelButton busy>Click me</PixelButton>)
    const btn = screen.getByRole('button')
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    // Spinner should be inside
    const spinner = btn.querySelector('[role="status"]')
    expect(spinner).not.toBeNull()
  })

  it('does not show spinner when not busy', () => {
    render(<PixelButton>Click me</PixelButton>)
    const btn = screen.getByRole('button')
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('aria-busy')).toBeNull()
    const spinner = btn.querySelector('[role="status"]')
    expect(spinner).toBeNull()
  })
})
