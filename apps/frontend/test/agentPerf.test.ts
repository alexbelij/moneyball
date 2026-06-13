/**
 * agentPerf.test.ts | v1.0.0 | 2026-06-13
 * Tests for T27: per-agent performance series transform + version markers.
 */

import { describe, it, expect } from 'vitest'
import { buildAgentPerfSeries, versionChangeIndices } from '@/lib/agentPerf'
import type { PredictionItem } from '@/lib/api'

function pred(p: Partial<PredictionItem> & { matchId: string }): PredictionItem {
  return {
    matchId: p.matchId,
    pick: p.pick ?? '1',
    confidence: p.confidence ?? 0.6,
    reasoning: p.reasoning ?? 'r',
    createdAt: p.createdAt ?? '2026-06-13T08:00:00Z',
    outcome: p.outcome ?? null,
    paramsVersion: p.paramsVersion,
    predictionId: p.predictionId,
  } as PredictionItem
}

describe('buildAgentPerfSeries', () => {
  it('returns an empty series with null summaries when no resolved predictions', () => {
    const s = buildAgentPerfSeries('dr_morgan', [pred({ matchId: 'm1' })])
    expect(s.resolvedCount).toBe(0)
    expect(s.points).toEqual([])
    expect(s.finalAccuracy).toBeNull()
    expect(s.finalBrier).toBeNull()
  })

  it('computes rolling brier + accuracy in resolution order', () => {
    const items = [
      pred({ matchId: 'b', confidence: 0.5, outcome: { correct: false, resolvedAt: '2026-06-15T00:00:00Z' } }),
      pred({ matchId: 'a', confidence: 0.8, outcome: { correct: true, resolvedAt: '2026-06-14T00:00:00Z' } }),
    ]
    const s = buildAgentPerfSeries('x', items)
    // sorted by resolvedAt: 'a' first (0.8, correct), then 'b' (0.5, wrong)
    expect(s.points.map((p) => p.matchId)).toEqual(['a', 'b'])
    // point 1: brier (0.8-1)^2 = 0.04, acc 1/1
    expect(s.points[0].brierScore).toBeCloseTo(0.04, 6)
    expect(s.points[0].rollingBrier).toBeCloseTo(0.04, 6)
    expect(s.points[0].rollingAccuracy).toBe(1)
    // point 2: brier (0.5-0)^2 = 0.25; rolling = (0.04+0.25)/2 = 0.145; acc 1/2
    expect(s.points[1].brierScore).toBeCloseTo(0.25, 6)
    expect(s.points[1].rollingBrier).toBeCloseTo(0.145, 6)
    expect(s.points[1].rollingAccuracy).toBe(0.5)
    expect(s.finalAccuracy).toBe(0.5)
    expect(s.finalBrier).toBeCloseTo(0.145, 6)
    expect(s.resolvedCount).toBe(2)
  })

  it('carries paramsVersion through and ignores unresolved items', () => {
    const items = [
      pred({ matchId: 'a', paramsVersion: 1, outcome: { correct: true, resolvedAt: '2026-06-14T00:00:00Z' } }),
      pred({ matchId: 'pending' }), // unresolved → excluded
      pred({ matchId: 'b', paramsVersion: 2, outcome: { correct: true, resolvedAt: '2026-06-15T00:00:00Z' } }),
    ]
    const s = buildAgentPerfSeries('x', items)
    expect(s.resolvedCount).toBe(2)
    expect(s.points.map((p) => p.paramsVersion)).toEqual([1, 2])
  })
})

describe('versionChangeIndices', () => {
  it('flags indices where params version increased', () => {
    const s = buildAgentPerfSeries('x', [
      pred({ matchId: 'a', paramsVersion: 1, outcome: { correct: true, resolvedAt: '2026-06-14T00:00:00Z' } }),
      pred({ matchId: 'b', paramsVersion: 1, outcome: { correct: false, resolvedAt: '2026-06-15T00:00:00Z' } }),
      pred({ matchId: 'c', paramsVersion: 2, outcome: { correct: true, resolvedAt: '2026-06-16T00:00:00Z' } }),
    ])
    // version bumps from index 2 (v1) to index 3 (v2)
    expect(versionChangeIndices(s.points)).toEqual([3])
  })

  it('returns empty when versions are missing or flat', () => {
    const s = buildAgentPerfSeries('x', [
      pred({ matchId: 'a', outcome: { correct: true, resolvedAt: '2026-06-14T00:00:00Z' } }),
      pred({ matchId: 'b', outcome: { correct: true, resolvedAt: '2026-06-15T00:00:00Z' } }),
    ])
    expect(versionChangeIndices(s.points)).toEqual([])
  })
})
