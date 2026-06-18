/**
 * verifyPanel.test.tsx | v1.0.0 | 2026-06-18
 * Tests for T64: VerifyPanel -- identifiers, explorer links, agent rows, recipe, feedback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { VerifyPanel } from '@/components/VerifyPanel'

const MOCK_DATA = {
  ok: true,
  walrusSiteObject: '0xa22ada9c09100eaca2571b64a2494f00a5393b012132aa74392bdcc6bd0a3272',
  frontendUrl: 'https://taken.wal.app',
  memwalRelayer: 'https://relayer.memory.walrus.xyz',
  memwalAccountId: '0xabc123',
  memwalNamespacePattern: 'mwc-agent:{agentId}',
  agents: [
    { agentId: 'dr_morgan', memwalNamespace: 'mwc-agent:dr_morgan', counts: { predictions: 8, outcomes: 5, evolutions: 3, substantiveEvolutions: 2 } },
    { agentId: 'scout_alvarez', memwalNamespace: 'mwc-agent:scout_alvarez', counts: { predictions: 8, outcomes: 5, evolutions: 3, substantiveEvolutions: 2 } },
    { agentId: 'viktor_kane', memwalNamespace: 'mwc-agent:viktor_kane', counts: { predictions: 8, outcomes: 5, evolutions: 3, substantiveEvolutions: 2 } },
    { agentId: 'sofia_mendes', memwalNamespace: 'mwc-agent:sofia_mendes', counts: { predictions: 8, outcomes: 4, evolutions: 2, substantiveEvolutions: 1 } },
    { agentId: 'madame_pythia', memwalNamespace: 'mwc-agent:madame_pythia', counts: { predictions: 8, outcomes: 4, evolutions: 2, substantiveEvolutions: 1 } },
  ],
  explorers: {
    walrus: [{ name: 'WalrusScan', baseUrl: 'https://walruscan.com' }],
    sui: [{ name: 'Suivision', baseUrl: 'https://suivision.xyz' }],
  },
  howToVerify: [
    'Open any agent dossier.',
    'Each memory write goes to MemWal.',
    'The blob_id is the content-addressable identifier.',
  ],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(MOCK_DATA) }))
})

describe('VerifyPanel (T64)', () => {
  it('renders the Walrus site object ID', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText(/0xa22ada9c/)).toBeInTheDocument() })
  })

  it('renders MemWal relayer URL', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText(/relayer\.memory\.walrus/)).toBeInTheDocument() })
  })

  it('renders namespace pattern', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText('mwc-agent:{agentId}')).toBeInTheDocument() })
  })

  it('renders all 5 agent rows', async () => {
    render(<VerifyPanel />)
    await waitFor(() => {
      expect(screen.getByText('dr_morgan')).toBeInTheDocument()
      expect(screen.getByText('scout_alvarez')).toBeInTheDocument()
      expect(screen.getByText('viktor_kane')).toBeInTheDocument()
      expect(screen.getByText('sofia_mendes')).toBeInTheDocument()
      expect(screen.getByText('madame_pythia')).toBeInTheDocument()
    })
  })

  it('renders per-agent namespace', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText('mwc-agent:dr_morgan')).toBeInTheDocument() })
  })

  it('renders how-to-verify steps', async () => {
    render(<VerifyPanel />)
    await waitFor(() => {
      expect(screen.getByText('How to verify')).toBeInTheDocument()
      expect(screen.getByText(/Open any agent dossier/)).toBeInTheDocument()
    })
  })

  it('renders explorer links', async () => {
    render(<VerifyPanel />)
    await waitFor(() => {
      expect(screen.getByText('WalrusScan')).toBeInTheDocument()
      expect(screen.getByText('Suivision')).toBeInTheDocument()
    })
  })

  it('renders feedback section', async () => {
    render(<VerifyPanel />)
    await waitFor(() => {
      expect(screen.getByText('Feedback to Walrus / Mysten Labs')).toBeInTheDocument()
      expect(screen.getByText(/enumeration API/)).toBeInTheDocument()
    })
  })

  it('shows copy buttons', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getAllByText('copy').length).toBeGreaterThanOrEqual(1) })
  })

  it('shows error state on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText(/could not load/i)).toBeInTheDocument() })
  })

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(<VerifyPanel />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('contains no Cyrillic', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText(/0xa22ada9c/)).toBeInTheDocument() })
    expect(document.body.textContent ?? '').not.toMatch(/[\u0400-\u04FF]/)
  })

  it('renders On-chain identifiers heading', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText('On-chain identifiers')).toBeInTheDocument() })
  })

  it('renders Per-agent verification heading', async () => {
    render(<VerifyPanel />)
    await waitFor(() => { expect(screen.getByText('Per-agent verification')).toBeInTheDocument() })
  })
})
