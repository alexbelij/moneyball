/**
 * toastSystem.test | v1.0.0 | 2026-06-17
 * T66: Tests for pixel toast system — ToastProvider, Toast, toastBus, useToast.
 * Covers: queue add/dismiss, max-visible, auto-dismiss with fake timers,
 * role mapping (error=alert, info/success/warning=status), toastBus fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { ToastProvider } from '../src/components/toast/ToastProvider'
import { toast, onToast, type ToastEvent } from '../src/components/toast/toastBus'
import { useToast } from '../src/components/toast/useToast'

// Helper: render ToastProvider and return cleanup
function renderProvider() {
  return render(<ToastProvider />)
}

describe('toastBus', () => {
  it('fires events to listeners', () => {
    const events: ToastEvent[] = []
    const unsub = onToast((e) => events.push(e))

    toast.error('boom')
    toast.success('yay')
    toast.info('fyi')
    toast.warning('careful')

    expect(events).toHaveLength(4)
    expect(events[0].variant).toBe('error')
    expect(events[1].variant).toBe('success')
    expect(events[2].variant).toBe('info')
    expect(events[3].variant).toBe('warning')

    unsub()
  })

  it('falls back to console when no listener is registered', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Fire without any listener
    toast.error('fallback test')

    expect(errorSpy).toHaveBeenCalledWith('[toast:error]', 'fallback test')
    errorSpy.mockRestore()
  })

  it('supports options (coach, title, durationMs, sticky)', () => {
    const events: ToastEvent[] = []
    const unsub = onToast((e) => events.push(e))

    toast.info('hello', { coach: 'dr_morgan', title: 'Doc says', durationMs: 3000 })

    expect(events[0].options.coach).toBe('dr_morgan')
    expect(events[0].options.title).toBe('Doc says')
    expect(events[0].options.durationMs).toBe(3000)

    unsub()
  })
})

describe('useToast', () => {
  it('returns toast methods that fire through toastBus', () => {
    const events: ToastEvent[] = []
    const unsub = onToast((e) => events.push(e))

    function TestComp() {
      const t = useToast()
      React.useEffect(() => { t.info('hook test') }, [])
      return null
    }

    render(<TestComp />)
    expect(events).toHaveLength(1)
    expect(events[0].message).toBe('hook test')

    unsub()
  })
})

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when there are no toasts', () => {
    const { container } = renderProvider()
    expect(container.innerHTML).toBe('')
  })

  it('shows a toast when fired via toastBus', () => {
    renderProvider()

    act(() => { toast.info('Hello world') })

    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('uses role="alert" for error variant', () => {
    renderProvider()

    act(() => { toast.error('Error!') })

    const el = screen.getByRole('alert')
    expect(el).toBeTruthy()
    expect(el.textContent).toContain('Error!')
  })

  it('uses role="status" for info/success/warning variants', () => {
    renderProvider()

    act(() => { toast.info('Info msg') })
    act(() => { toast.success('Success msg') })

    const statuses = screen.getAllByRole('status')
    expect(statuses.length).toBeGreaterThanOrEqual(2)
  })

  it('limits visible toasts to 3 (FIFO)', () => {
    renderProvider()

    act(() => {
      toast.info('one')
      toast.info('two')
      toast.info('three')
      toast.info('four')
    })

    // "one" should be dropped, "two" through "four" visible
    expect(screen.queryByText('one')).toBeNull()
    expect(screen.getByText('two')).toBeTruthy()
    expect(screen.getByText('three')).toBeTruthy()
    expect(screen.getByText('four')).toBeTruthy()
  })

  it('auto-dismisses info toast after ~4500ms', () => {
    renderProvider()

    act(() => { toast.info('auto dismiss') })
    expect(screen.getByText('auto dismiss')).toBeTruthy()

    // Advance past auto-dismiss time
    act(() => { vi.advanceTimersByTime(5000) })

    expect(screen.queryByText('auto dismiss')).toBeNull()
  })

  it('auto-dismisses error toast after ~7000ms', () => {
    renderProvider()

    act(() => { toast.error('error dismiss') })
    expect(screen.getByText('error dismiss')).toBeTruthy()

    // Should still be visible at 5s
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('error dismiss')).toBeTruthy()

    // Gone after 7s+
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText('error dismiss')).toBeNull()
  })

  it('dismisses toast on close button click', () => {
    renderProvider()

    act(() => { toast.info('click close') })
    expect(screen.getByText('click close')).toBeTruthy()

    const closeBtn = screen.getByLabelText('Dismiss notification')
    fireEvent.click(closeBtn)

    // Should be removed (possibly after animation)
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByText('click close')).toBeNull()
  })

  it('shows title when options.title is provided', () => {
    renderProvider()

    act(() => { toast.info('body text', { title: 'Title Line' }) })

    expect(screen.getByText('Title Line')).toBeTruthy()
    expect(screen.getByText('body text')).toBeTruthy()
  })

  it('does not auto-dismiss sticky toasts', () => {
    renderProvider()

    act(() => { toast.info('sticky toast', { sticky: true }) })
    expect(screen.getByText('sticky toast')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(30000) })
    expect(screen.getByText('sticky toast')).toBeTruthy()
  })
})
