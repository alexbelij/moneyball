/**
 * offlineBanner.test.tsx | v2.0.0 | 2026-06-14
 * Tests for T18 + T41: OfflineBanner waking-state UX, gameStore reducer
 * (cachePredictions, connection state), and offline/online transitions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { useGameStore } from '@/store/gameStore'
import { OfflineBanner } from '@/components/OfflineBanner'
import type { PredictionItem } from '@/lib/api'

const resetStore = () => {
  useGameStore.setState({
    agents: {},
    predictions: {},
    ui: { selectedAgentId: null, isConnected: false, isWalletFlowActive: false },
  })
}

describe('OfflineBanner (T41 waking-state)', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('shows waking-state banner after delay when disconnected', async () => {
    render(<OfflineBanner />)
    // Before 800ms delay: banner not visible yet (avoids flash)
    expect(screen.queryByRole('status')).toBeNull()
    // Advance past the waking delay
    await act(async () => { vi.advanceTimersByTime(900) })
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/waking up|reviewing|brewing|sharpening|checking|consulting|cold-starting|warming/i)
  })

  it('hides when connected', () => {
    useGameStore.getState().setConnected(true)
    const { container } = render(<OfflineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('has role="status" and aria-live for screen readers', async () => {
    render(<OfflineBanner />)
    await act(async () => { vi.advanceTimersByTime(900) })
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })
})

describe('gameStore connection reducer', () => {
  beforeEach(resetStore)

  it('starts disconnected', () => {
    expect(useGameStore.getState().ui.isConnected).toBe(false)
  })

  it('setConnected(true) then setConnected(false) round-trips', () => {
    useGameStore.getState().setConnected(true)
    expect(useGameStore.getState().ui.isConnected).toBe(true)
    useGameStore.getState().setConnected(false)
    expect(useGameStore.getState().ui.isConnected).toBe(false)
  })
})

describe('gameStore cachePredictions reducer', () => {
  beforeEach(resetStore)

  it('starts with empty predictions', () => {
    expect(useGameStore.getState().predictions).toEqual({})
  })

  it('cachePredictions stores items by agentId', () => {
    const items: PredictionItem[] = [
      {
        agentId: 'dr_morgan',
        createdAt: '2026-06-12T10:00:00Z',
        matchId: 'm1',
        pick: '1',
        confidence: 0.8,
        reasoning: 'test',
      },
    ]
    useGameStore.getState().cachePredictions('dr_morgan', items)
    const cached = useGameStore.getState().predictions['dr_morgan']
    expect(cached).toHaveLength(1)
    expect(cached[0].matchId).toBe('m1')
  })

  it('cachePredictions replaces existing items for same agent', () => {
    const items1: PredictionItem[] = [
      { agentId: 'a', createdAt: '', matchId: 'm1', pick: '1', confidence: 0.5, reasoning: '' },
    ]
    const items2: PredictionItem[] = [
      { agentId: 'a', createdAt: '', matchId: 'm2', pick: 'X', confidence: 0.6, reasoning: '' },
      { agentId: 'a', createdAt: '', matchId: 'm3', pick: '2', confidence: 0.7, reasoning: '' },
    ]
    useGameStore.getState().cachePredictions('a', items1)
    expect(useGameStore.getState().predictions['a']).toHaveLength(1)
    useGameStore.getState().cachePredictions('a', items2)
    expect(useGameStore.getState().predictions['a']).toHaveLength(2)
    expect(useGameStore.getState().predictions['a'][0].matchId).toBe('m2')
  })

  it('applyWorldState does not clear predictions', () => {
    useGameStore.getState().cachePredictions('x', [
      { agentId: 'x', createdAt: '', matchId: 'm', pick: '1', confidence: 0.5, reasoning: '' },
    ])
    useGameStore.getState().applyWorldState({
      worldId: 'main', tick: 1, serverTime: '', connectedClients: 1,
      agents: [{ agentId: 'x', name: 'X', role: 'r', status: 'idle', position: { x: 0, y: 0 } }],
    })
    // Predictions should survive world state updates
    expect(useGameStore.getState().predictions['x']).toHaveLength(1)
  })
})
