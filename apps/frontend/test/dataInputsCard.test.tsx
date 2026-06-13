/**
 * dataInputsCard.test.tsx | v1.0.0 | 2026-06-13
 * Tests for T30: the honest data-source disclosure in the Method tab.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

const getDataSource = vi.fn()
vi.mock('@/lib/api', () => ({
  getDataSource: (...a: unknown[]) => getDataSource(...a),
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { DataInputsCard } from '@/components/AgentModal'

beforeEach(() => {
  getDataSource.mockReset()
})

describe('DataInputsCard (T30)', () => {
  it('renders the synthetic headline and per-input source badges', async () => {
    getDataSource.mockResolvedValue({
      ok: true,
      version: 1,
      headline: 'Model inputs are synthetic (v1): predictions run on deterministic placeholders.',
      inputs: [
        { key: 'teamStrength', label: 'Team strength', source: 'synthetic', detail: 'Hash of team name.' },
        { key: 'homeAdvantage', label: 'Home advantage', source: 'manual', detail: 'Fixed +0.04.' },
      ],
    })
    render(<DataInputsCard />)

    await waitFor(() => expect(screen.getByText(/Model inputs are synthetic/i)).toBeInTheDocument())
    expect(screen.getByText('Team strength')).toBeInTheDocument()
    expect(screen.getByText('Home advantage')).toBeInTheDocument()
    // a synthetic + a manual badge, plus the headline's synthetic badge
    expect(screen.getAllByText('synthetic').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('manual')).toBeInTheDocument()
  })

  it('renders nothing when no disclosure data is returned', async () => {
    // Resolve to a falsy payload (avoids rejected-promise vitest pitfalls);
    // exercises the `!data` guard so the card stays silent.
    getDataSource.mockResolvedValue(null as any)
    const { container } = render(<DataInputsCard />)
    // give the effect a tick to resolve
    await waitFor(() => expect(getDataSource).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
