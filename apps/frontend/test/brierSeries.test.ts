/**
 * brierSeries.test.ts | v1.0.0 | 2026-06-13
 * Tests for T15: pure Brier series builder.
 */

import { describe, it, expect } from 'vitest'
import { buildBrierSeries, buildAllBrierSeries, type BrierPoint } from '@/lib/brierSeries'
import type { PredictionItem } from '@/lib/api'

function pred(
  matchId: string,
  confidence: number,
  correct: boolean,
  resolvedAt: string,
): PredictionItem {
  return {
    agentId: 'test',
    createdAt: '2026-06-01T00:00:00Z',
    matchId,
    pick: correct ? '1' : 'X',
    confidence,
    reasoning: 'test',
    outcome: { correct, resolvedAt },
  }
}

function unresolved(matchId: string): PredictionItem {
  return {
    agentId: 'test',
    createdAt: '2026-06-01T00:00:00Z',
    matchId,
    pick: '1',
    confidence: 0.7,
    reasoning: 'test',
  }
}

describe('buildBrierSeries', () => {
  it('returns empty points for no resolved predictions', () => {
    const series = buildBrierSeries('a', [unresolved('m1'), unresolved('m2')])
    expect(series.agentId).toBe('a')
    expect(series.points).toHaveLength(0)
  })

  it('returns empty points for empty input', () => {
    const series = buildBrierSeries('a', [])
    expect(series.points).toHaveLength(0)
  })

  it('computes correct Brier score for a single correct prediction', () => {
    // confidence 0.8, correct: BS = (0.8 - 1)² = 0.04
    const items = [pred('m1', 0.8, true, '2026-06-12T15:00:00Z')]
    const series = buildBrierSeries('a', items)
    expect(series.points).toHaveLength(1)
    expect(series.points[0].brierScore).toBeCloseTo(0.04, 10)
    expect(series.points[0].rollingBrier).toBeCloseTo(0.04, 10)
    expect(series.points[0].matchIndex).toBe(1)
    expect(series.points[0].correct).toBe(true)
  })

  it('computes correct Brier score for a single wrong prediction', () => {
    // confidence 0.9, wrong: BS = (0.9 - 0)² = 0.81
    const items = [pred('m1', 0.9, false, '2026-06-12T15:00:00Z')]
    const series = buildBrierSeries('a', items)
    expect(series.points[0].brierScore).toBeCloseTo(0.81, 10)
    expect(series.points[0].rollingBrier).toBeCloseTo(0.81, 10)
    expect(series.points[0].correct).toBe(false)
  })

  it('computes rolling average over multiple predictions', () => {
    const items = [
      pred('m1', 0.8, true, '2026-06-12T15:00:00Z'),  // BS = 0.04
      pred('m2', 0.6, false, '2026-06-12T17:00:00Z'),  // BS = 0.36
      pred('m3', 0.9, true, '2026-06-13T15:00:00Z'),   // BS = 0.01
    ]
    const series = buildBrierSeries('a', items)
    expect(series.points).toHaveLength(3)
    // Point 1: rolling = 0.04
    expect(series.points[0].rollingBrier).toBeCloseTo(0.04, 10)
    // Point 2: rolling = (0.04 + 0.36) / 2 = 0.20
    expect(series.points[1].rollingBrier).toBeCloseTo(0.20, 10)
    // Point 3: rolling = (0.04 + 0.36 + 0.01) / 3 ≈ 0.1367
    expect(series.points[2].rollingBrier).toBeCloseTo(0.41 / 3, 10)
  })

  it('sorts by resolvedAt ascending', () => {
    const items = [
      pred('m2', 0.5, true, '2026-06-13T15:00:00Z'),
      pred('m1', 0.8, true, '2026-06-12T15:00:00Z'),
    ]
    const series = buildBrierSeries('a', items)
    expect(series.points[0].matchId).toBe('m1')
    expect(series.points[1].matchId).toBe('m2')
  })

  it('filters out unresolved predictions', () => {
    const items = [
      pred('m1', 0.8, true, '2026-06-12T15:00:00Z'),
      unresolved('m2'),
      pred('m3', 0.6, false, '2026-06-13T15:00:00Z'),
    ]
    const series = buildBrierSeries('a', items)
    expect(series.points).toHaveLength(2)
    expect(series.points.map((p) => p.matchId)).toEqual(['m1', 'm3'])
  })

  it('perfect confidence (1.0) on correct gives BS = 0', () => {
    const items = [pred('m1', 1.0, true, '2026-06-12T15:00:00Z')]
    const series = buildBrierSeries('a', items)
    expect(series.points[0].brierScore).toBe(0)
  })

  it('zero confidence on wrong gives BS = 0', () => {
    const items = [pred('m1', 0.0, false, '2026-06-12T15:00:00Z')]
    const series = buildBrierSeries('a', items)
    expect(series.points[0].brierScore).toBe(0)
  })

  it('worst case: confidence 1.0 on wrong gives BS = 1', () => {
    const items = [pred('m1', 1.0, false, '2026-06-12T15:00:00Z')]
    const series = buildBrierSeries('a', items)
    expect(series.points[0].brierScore).toBe(1)
  })
})

describe('buildAllBrierSeries', () => {
  it('builds series for multiple agents', () => {
    const data = [
      { agentId: 'a', items: [pred('m1', 0.8, true, '2026-06-12T15:00:00Z')] },
      { agentId: 'b', items: [pred('m1', 0.6, false, '2026-06-12T15:00:00Z')] },
    ]
    const all = buildAllBrierSeries(data)
    expect(all).toHaveLength(2)
    expect(all[0].agentId).toBe('a')
    expect(all[1].agentId).toBe('b')
  })
})
