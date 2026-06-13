/**
 * agentPerfChart.test.tsx | v1.0.0 | 2026-06-13
 * Tests for T27: AgentPerfChart renders a single-agent rolling-Brier SVG with
 * headline accuracy/Brier, accessible data points, and evolution markers.
 */

import { describe, it, expect, vi } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import React from 'react'
import { render, screen } from '@testing-library/react'
import { AgentPerfChart } from '@/components/AgentPerfChart'
import { buildAgentPerfSeries } from '@/lib/agentPerf'
import type { PredictionItem } from '@/lib/api'

function pred(matchId: string, conf: number, correct: boolean, resolvedAt: string, paramsVersion?: number): PredictionItem {
  return {
    matchId, pick: '1', confidence: conf, reasoning: 'r',
    createdAt: '2026-06-13T08:00:00Z',
    outcome: { correct, resolvedAt },
    paramsVersion,
  } as PredictionItem
}

describe('AgentPerfChart (T27)', () => {
  it('renders headline accuracy/Brier and an accessible chart with one button per point', () => {
    const series = buildAgentPerfSeries('dr_morgan', [
      pred('a', 0.8, true, '2026-06-14T00:00:00Z', 1),
      pred('b', 0.5, false, '2026-06-15T00:00:00Z', 1),
    ])
    render(<AgentPerfChart series={series} />)

    // headline: acc 50% (1/2), brier 0.145
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('0.145')).toBeInTheDocument()
    // chart role=img with descriptive label
    expect(screen.getByRole('img', { name: /rolling brier score for dr morgan/i })).toBeInTheDocument()
    // one focusable data point per resolved match
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /match 1: brier .* correct/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /match 2: brier .* incorrect/i })).toBeInTheDocument()
  })

  it('draws an evolution marker when the params version bumps', () => {
    const series = buildAgentPerfSeries('x', [
      pred('a', 0.6, true, '2026-06-14T00:00:00Z', 1),
      pred('b', 0.6, true, '2026-06-15T00:00:00Z', 2),
    ])
    const { container } = render(<AgentPerfChart series={series} />)
    // 'evo' marker label appears for the version bump at index 2
    expect(screen.getByText('evo')).toBeInTheDocument()
    // dashed gold vertical marker line present
    const markerLines = container.querySelectorAll('line[stroke-dasharray="3 2"]')
    expect(markerLines.length).toBe(1)
  })
})
