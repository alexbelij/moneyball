/**
 * errorBoundary.test | v1.0.0 | 2026-06-17
 * T68: Tests for ErrorBoundary component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

import { ErrorBoundary } from '../src/components/error/ErrorBoundary'

// Suppress React error boundary console noise in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** A component that throws on render. */
function ThrowOnRender({ message }: { message: string }) {
  throw new Error(message)
  return null // never reached
}

/** A component that conditionally throws. */
function ConditionalThrow({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('conditional boom')
  return <div>All good</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary label="Test">
        <div>Hello world</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('shows fallback with error message when a child throws', () => {
    render(
      <ErrorBoundary label="Widget">
        <ThrowOnRender message="test crash" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('test crash')).toBeTruthy()
    expect(screen.getByText(/Widget.*Error/)).toBeTruthy()
  })

  it('shows generic label when no label prop is set', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="boom" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('shows RETRY button that resets the boundary', () => {
    // We use a ref to control whether the child throws
    let shouldThrow = true
    function MaybeThrow() {
      if (shouldThrow) throw new Error('initial crash')
      return <div>Recovered</div>
    }

    const { rerender } = render(
      <ErrorBoundary label="Test">
        <MaybeThrow />
      </ErrorBoundary>,
    )

    // Should show error state
    expect(screen.getByText('RETRY')).toBeTruthy()

    // Fix the error condition and retry
    shouldThrow = false
    fireEvent.click(screen.getByText('RETRY'))

    // Should render the recovered component
    expect(screen.getByText('Recovered')).toBeTruthy()
  })

  it('calls onError callback when an error is caught', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary label="Callback" onError={onError}>
        <ThrowOnRender message="callback test" />
      </ErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe('callback test')
  })

  it('uses role="alert" and aria-live="assertive" for accessibility', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="a11y test" />
      </ErrorBoundary>,
    )
    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('aria-live')).toBe('assertive')
  })
})
