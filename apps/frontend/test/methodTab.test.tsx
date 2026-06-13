/**
 * methodTab.test.tsx | v1.0.0 | 2026-06-13
 * Tests for T26: AgentModal Method tab renders methodology dossier from the
 * /profile endpoint — formula-based agents and rule-based mystic agents.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

// Mock the api module so config.ts (which requires VITE_BACKEND_URL) never loads.
const getAgentProfile = vi.fn()
const getDataSource = vi.fn()
vi.mock('@/lib/api', () => ({
  getAgentProfile: (...a: unknown[]) => getAgentProfile(...a),
  // MethodTab now renders DataInputsCard (T30), which calls getDataSource.
  getDataSource: (...a: unknown[]) => getDataSource(...a),
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MethodTab } from '@/components/AgentModal'
import type { AgentProfile } from '@/lib/api'

const morgan: AgentProfile = {
  id: 'dr_morgan',
  name: 'Dr. Morgan',
  role: 'Statistician',
  personality: 'Cold, pedantic, trusts only verifiable data.',
  catchphrases: ['Probabilities never lie.'],
  methodology: {
    type: 'weighted_metrics',
    formula: 'Score = (Home_xG * 0.4) + (Away_xG_Reverse * 0.3)',
    description: null,
    parameters: { learning_rate: 0.15, error_threshold: 1.5 },
    evolutionTrigger: 'If actual goal diff deviates from xG by >1.5, bump injury weight.',
    rules: [],
  },
}

const pythia: AgentProfile = {
  id: 'madame_pythia',
  name: 'Madame Pythia',
  role: 'Tarot/Numerology Analyst',
  personality: 'Mysterious, speaks in metaphors.',
  catchphrases: ['The numbers vibrate.'],
  methodology: {
    type: 'deterministic_mysticism',
    formula: null,
    description: 'Purely algorithmic, fixed rules and constants.',
    parameters: { omen_penalty: 20 },
    evolutionTrigger: 'If a pattern fails 3x, switch leading number.',
    rules: [
      { name: 'Name Numerology', logic: 'ASCII sum mod 9', effect: 'Score -= 20' },
    ],
  },
}

describe('MethodTab (T26)', () => {
  beforeEach(() => {
    getAgentProfile.mockReset()
    getDataSource.mockReset()
    // Keep the disclosure silent in these T26 tests (returns null → no DOM).
    getDataSource.mockResolvedValue(null as any)
  })

  it('shows loading then renders a formula-based agent dossier', async () => {
    getAgentProfile.mockResolvedValue({ ok: true, profile: morgan })
    render(<MethodTab agentId="dr_morgan" />)
    expect(screen.getByText(/loading methodology/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText(/scoring formula/i)).toBeInTheDocument())
    expect(screen.getByText(/Home_xG/)).toBeInTheDocument()
    expect(screen.getByText('weighted_metrics')).toBeInTheDocument()
    expect(screen.getByText(/probabilities never lie/i)).toBeInTheDocument()
    expect(screen.getByText(/learning_rate/)).toBeInTheDocument()
    expect(screen.getByText(/how it evolves/i)).toBeInTheDocument()
    // formula agent has no rules section
    expect(screen.queryByText(/^Rules$/i)).not.toBeInTheDocument()
  })

  it('renders rule list + description for a mystic agent (no formula)', async () => {
    getAgentProfile.mockResolvedValue({ ok: true, profile: pythia })
    render(<MethodTab agentId="madame_pythia" />)

    await waitFor(() => expect(screen.getByText('Rules')).toBeInTheDocument())
    expect(screen.getByText(/purely algorithmic/i)).toBeInTheDocument()
    expect(screen.getByText('Name Numerology')).toBeInTheDocument()
    expect(screen.getByText(/Score -= 20/)).toBeInTheDocument()
    // no scoring-formula section for mystic agent
    expect(screen.queryByText(/scoring formula/i)).not.toBeInTheDocument()
  })
})
