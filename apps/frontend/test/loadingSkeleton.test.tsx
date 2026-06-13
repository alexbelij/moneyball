/**
 * loadingSkeleton.test.tsx | v1.0.0 | 2026-06-13
 * Tests for T13: useSceneReady hook + LoadingSkeleton rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'

// Mock GameEventBus
const listeners = new Map<string, Set<Function>>()
vi.mock('@/events/GameEventBus', () => ({
  GameEventBus: {
    on(event: string, fn: Function) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(fn)
    },
    off(event: string, fn: Function) {
      listeners.get(event)?.delete(fn)
    },
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((fn) => fn(...args))
    },
  },
}))

import { useSceneReady, LoadingSkeleton } from '@/components/LoadingSkeleton'

function TestHook() {
  const ready = useSceneReady()
  return <div data-testid="ready">{ready ? 'YES' : 'NO'}</div>
}

describe('useSceneReady', () => {
  beforeEach(() => {
    listeners.clear()
  })

  it('starts as not ready', () => {
    render(<TestHook />)
    expect(screen.getByTestId('ready').textContent).toBe('NO')
  })

  it('becomes ready when scene:ready fires', () => {
    render(<TestHook />)
    act(() => {
      listeners.get('scene:ready')?.forEach((fn) => fn())
    })
    expect(screen.getByTestId('ready').textContent).toBe('YES')
  })

  it('cleans up listener on unmount', () => {
    const { unmount } = render(<TestHook />)
    expect(listeners.get('scene:ready')?.size).toBe(1)
    unmount()
    expect(listeners.get('scene:ready')?.size ?? 0).toBe(0)
  })
})

describe('LoadingSkeleton', () => {
  it('renders with role="status"', () => {
    render(<LoadingSkeleton />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows loading text', () => {
    render(<LoadingSkeleton />)
    expect(screen.getByText(/Loading/)).toBeInTheDocument()
  })

  it('shows MONEYBALL CABINET title', () => {
    render(<LoadingSkeleton />)
    expect(screen.getByText('MONEYBALL CABINET')).toBeInTheDocument()
  })
})
