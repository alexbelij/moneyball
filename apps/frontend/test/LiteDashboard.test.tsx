/**
 * LiteDashboard.test.tsx | v1.0.0 | 2026-06-12
 * Purpose: Tests that LiteDashboard renders correctly from a mocked store snapshot.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

// Ensure WebGL + matchMedia are available
Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

// Mock the API module to avoid real network calls
vi.mock('@/lib/api', () => ({
  getAgentPredictions: vi.fn().mockResolvedValue({
    ok: true,
    agentId: 'dr_morgan',
    items: [
      {
        agentId: 'dr_morgan',
        matchId: 'fd:100',
        pick: '1',
        confidence: 0.72,
        reasoning: 'test',
        outcome: { correct: true, resolvedAt: '2026-06-12T10:00:00Z' },
      },
    ],
  }),
  getAgentParams: vi.fn().mockResolvedValue({
    ok: true,
    params: { agentId: 'dr_morgan', version: 1, confidenceBias: -0.01, hedgingLevel: 0.3 },
  }),
  getMatches: vi.fn().mockResolvedValue({
    ok: true,
    live: [],
    upcoming: [
      {
        id: 'fd:200',
        homeTeam: 'Brazil',
        awayTeam: 'Germany',
        kickoffUtc: '2026-06-15T18:00:00Z',
        status: 'scheduled',
        result: null,
      },
    ],
    recent: [],
  }),
}))

import { useGameStore } from '@/store/gameStore'
import { LiteDashboard } from '@/components/LiteDashboard'
import type { WorldAgentState } from '@moneyball/shared/events'

const mockAgent: WorldAgentState = {
  agentId: 'dr_morgan',
  name: 'Dr. Morgan',
  role: 'Statistician',
  status: 'idle',
  position: { x: 100, y: 100 },
}

describe('LiteDashboard', () => {
  beforeEach(() => {
    // Populate the game store with mock agent data
    useGameStore.setState({
      agents: { dr_morgan: mockAgent },
      ui: { selectedAgentId: null, isConnected: true, isWalletFlowActive: false },
    })
  })

  it('renders the title', () => {
    render(<LiteDashboard />)
    expect(screen.getByText(/MONEYBALL/i)).toBeInTheDocument()
  })

  it('shows agent card with name and role', () => {
    render(<LiteDashboard />)
    expect(screen.getAllByText('Dr. Morgan').length).toBeGreaterThan(0)
    expect(screen.getByText('Statistician')).toBeInTheDocument()
  })

  it('shows connection status indicator', () => {
    render(<LiteDashboard />)
    const dot = screen.getByTestId('status-connected')
    expect(dot).toBeInTheDocument()
  })

  it('shows disconnected status when not connected', () => {
    useGameStore.setState({
      agents: { dr_morgan: mockAgent },
      ui: { selectedAgentId: null, isConnected: false, isWalletFlowActive: false },
    })
    render(<LiteDashboard />)
    const dot = screen.getByTestId('status-disconnected')
    expect(dot).toBeInTheDocument()
  })

  it('renders leaderboard section', () => {
    render(<LiteDashboard />)
    expect(screen.getByText(/Leaderboard/i)).toBeInTheDocument()
  })

  it('renders agents section heading', () => {
    render(<LiteDashboard />)
    expect(screen.getAllByText(/Agents/i).length).toBeGreaterThan(0)
  })
})
