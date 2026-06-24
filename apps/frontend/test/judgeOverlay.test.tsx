/**
 * judgeOverlay.test.tsx | v1.0.0 | 2026-06-24
 * Tests for the For-Judges overlay (#/judge): closed renders nothing; open
 * renders headline stats, per-agent rows, and on-chain verify links.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

vi.mock('@/lib/api', () => ({
  getMemoryMoment: vi.fn(),
  getVerifiability: vi.fn(),
  getAgentEvolution: vi.fn(),
  listAgents: vi.fn(),
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { JudgeOverlay } from '@/components/JudgeOverlay'
import { useJudgeStore } from '@/store/judgeStore'
import { getMemoryMoment, getVerifiability, getAgentEvolution, listAgents } from '@/lib/api'

const mockMoment = vi.mocked(getMemoryMoment)
const mockVerify = vi.mocked(getVerifiability)
const mockEvolution = vi.mocked(getAgentEvolution)
const mockListAgents = vi.mocked(listAgents)

const AGENTS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia']

const MM: any = {
  ok: true,
  generatedAt: '2026-06-24T00:00:00.000Z',
  tournamentDay: 14,
  summary: 'Tournament Day 14.',
  agents: AGENTS.map((id, i) => ({
    agentId: id,
    currentVersion: 1,
    accuracy: { predictions: 20, outcomes: 8, correct: 4 - (i % 2), pct: 50 - i * 5 },
    evolutions: 3,
    substantiveEvolutions: 2,
    sleepCycles: 1,
    lastEvolution: `${id} recalibrated after resolved outcomes.`,
    mood: { mood: 'confident', streak: 1, recentCorrect: 3, recentTotal: 5, confidenceModifier: 1.04 },
    walrusWrites: 23,
  })),
}

const VF: any = {
  ok: true,
  walrusSiteObject: '0xa22ada9c09100eaca2571b64a2494f00a5393b012132aa74392bdcc6bd0a3272',
  frontendUrl: 'https://taken.wal.app',
  memwalRelayer: 'https://relayer.memory.walrus.xyz',
  memwalAccountId: '0x265869e1',
  memwalAccountObjectUrl: 'https://suiscan.xyz/mainnet/object/0x265869e1',
  memwalNamespacePattern: 'mwc-agent:{agentId}',
  agents: [],
  explorers: { walrus: [], sui: [] },
  howToVerify: [],
}

beforeEach(() => {
  useJudgeStore.setState({ open: false })
  mockMoment.mockResolvedValue(MM)
  mockVerify.mockResolvedValue(VF)
  mockListAgents.mockResolvedValue({
    ok: true,
    agents: [
      { agentId: 'dr_morgan', name: 'Dr. Morgan', role: 'Bayesian Analyst', persona: '', methodology: '', seed: 1, source: 'core', createdAt: '' },
      { agentId: 'sofia_mendes', name: 'Sofia Mendes', role: 'Market Analyst', persona: '', methodology: '', seed: 1, source: 'core', createdAt: '' },
    ],
  } as any)
  mockEvolution.mockResolvedValue({
    ok: true,
    agentId: 'dr_morgan',
    items: [
      { agentId: 'dr_morgan', createdAt: '2026-06-14T00:00:00Z', summary: 'x', parameterDiff: { confidenceBias: 0.03, hedgingLevel: -0.03 }, fromVersion: 1, toVersion: 2 },
    ],
  } as any)
})

describe('JudgeOverlay (#/judge)', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<JudgeOverlay />)
    expect(screen.queryByTestId('judge-overlay')).toBeNull()
    expect(container).toBeTruthy()
  })

  it('renders headline, agents, and verify links when open', async () => {
    useJudgeStore.setState({ open: true })
    render(<JudgeOverlay />)

    expect(await screen.findByTestId('judge-overlay')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/Memories on Walrus/i)).toBeInTheDocument()
    })

    // Agent display name resolved from listAgents.
    expect(screen.getByText(/DR\. MORGAN/i)).toBeInTheDocument()
    // Judging-criteria map present.
    expect(screen.getByText(/Memory depth/i)).toBeInTheDocument()
    // On-chain verify link.
    expect(screen.getByText(/MemWalAccount on Sui mainnet/i)).toBeInTheDocument()
  })

  it('shows an error + retry when the backend is unreachable', async () => {
    mockMoment.mockRejectedValueOnce(new Error('down'))
    useJudgeStore.setState({ open: true })
    render(<JudgeOverlay />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'RETRY' })).toBeInTheDocument()
    })
  })
})
