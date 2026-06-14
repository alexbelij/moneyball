/**
 * beforeAfterDiff.test | v1.0.0 | 2026-06-14
 * T36: Test the pure diff/summary builder for "Day 1 vs Day N".
 * Verifies correctness with seed-like data.
 */

import { describe, it, expect } from 'vitest'
import { buildBeforeAfterDiff, DAY1_DEFAULTS } from '../src/lib/beforeAfterDiff'
import type { AgentParamsInfo, EvolutionItem, PredictionItem } from '../src/lib/api'

const NOW = '2026-06-14T12:00:00Z'

function makePrediction(
  overrides: Partial<PredictionItem> & { matchId: string },
): PredictionItem {
  return {
    agentId: 'dr_morgan',
    createdAt: NOW,
    pick: '1',
    confidence: 0.6,
    reasoning: 'Test prediction',
    ...overrides,
  }
}

function makeEvolution(overrides: Partial<EvolutionItem> = {}): EvolutionItem {
  return {
    agentId: 'dr_morgan',
    createdAt: NOW,
    summary: 'Recalibrated after poor calls.',
    parameterDiff: { confidenceBias: -0.05, hedgingLevel: 0.03 },
    ...overrides,
  }
}

describe('buildBeforeAfterDiff', () => {
  it('returns day1 defaults when no evolution events exist', () => {
    const diff = buildBeforeAfterDiff('dr_morgan', null, [], [])
    expect(diff.evolutionCount).toBe(0)
    expect(diff.day1.confidenceBias).toBe(DAY1_DEFAULTS.confidenceBias)
    expect(diff.day1.hedgingLevel).toBe(DAY1_DEFAULTS.hedgingLevel)
    expect(diff.summary).toContain('Day 1 defaults')
  })

  it('computes correct diffs from params and evolution events', () => {
    const params: AgentParamsInfo = {
      agentId: 'dr_morgan',
      version: 3,
      confidenceBias: -0.05,
      hedgingLevel: 0.38,
      topicCalibration: {},
      updatedAt: NOW,
      sourceEvolutionEventId: null,
    }
    const evos: EvolutionItem[] = [
      makeEvolution({ parameterDiff: { confidenceBias: -0.08, hedgingLevel: 0.05, recentFormWeight: 0.10 } }),
      makeEvolution({ parameterDiff: { confidenceBias: 0.03, hedgingLevel: -0.03, topicCalibration: 0.06 } }),
    ]

    const diff = buildBeforeAfterDiff('dr_morgan', params, evos, [])

    expect(diff.evolutionCount).toBe(2)
    expect(diff.paramsVersion).toBe(3)
    expect(diff.day1.confidenceBias).toBe(0)
    expect(diff.day1.hedgingLevel).toBe(0.3)
    expect(diff.dayN.confidenceBias).toBe(-0.05)
    expect(diff.dayN.hedgingLevel).toBe(0.38)

    // Check diffs include core + evolution-only params
    const biasEntry = diff.diffs.find(d => d.key === 'confidenceBias')
    expect(biasEntry).toBeDefined()
    expect(biasEntry!.day1).toBe(0)
    expect(biasEntry!.dayN).toBe(-0.05)
    expect(biasEntry!.delta).toBe(-0.05)
    expect(biasEntry!.direction).toBe('down')

    // recentFormWeight should appear from aggregated evolution diffs
    const rfwEntry = diff.diffs.find(d => d.key === 'recentFormWeight')
    expect(rfwEntry).toBeDefined()
    expect(rfwEntry!.delta).toBe(0.10)
    expect(rfwEntry!.direction).toBe('up')
  })

  it('diffs are sorted by absolute delta (largest first)', () => {
    const params: AgentParamsInfo = {
      agentId: 'dr_morgan',
      version: 2,
      confidenceBias: -0.02,
      hedgingLevel: 0.35,
      topicCalibration: {},
      updatedAt: NOW,
      sourceEvolutionEventId: null,
    }
    const evos: EvolutionItem[] = [
      makeEvolution({ parameterDiff: { confidenceBias: -0.02, hedgingLevel: 0.05, narrativeWeight: -0.15 } }),
    ]

    const diff = buildBeforeAfterDiff('dr_morgan', params, evos, [])
    const deltas = diff.diffs.map(d => Math.abs(d.delta))
    for (let i = 1; i < deltas.length; i++) {
      expect(deltas[i]).toBeLessThanOrEqual(deltas[i - 1])
    }
  })

  it('computes Brier delta from early vs late predictions', () => {
    // 4 resolved predictions: first 2 = early, last 2 = late
    const preds: PredictionItem[] = [
      makePrediction({ matchId: 'm1', confidence: 0.9, createdAt: '2026-06-10T01:00:00Z', outcome: { correct: false, resolvedAt: '2026-06-10T03:00:00Z' } }),
      makePrediction({ matchId: 'm2', confidence: 0.6, createdAt: '2026-06-10T02:00:00Z', outcome: { correct: false, resolvedAt: '2026-06-10T04:00:00Z' } }),
      makePrediction({ matchId: 'm3', confidence: 0.7, createdAt: '2026-06-12T01:00:00Z', outcome: { correct: true, resolvedAt: '2026-06-12T03:00:00Z' } }),
      makePrediction({ matchId: 'm4', confidence: 0.8, createdAt: '2026-06-12T02:00:00Z', outcome: { correct: true, resolvedAt: '2026-06-12T04:00:00Z' } }),
    ]
    const params: AgentParamsInfo = {
      agentId: 'dr_morgan', version: 2,
      confidenceBias: -0.05, hedgingLevel: 0.35,
      topicCalibration: {}, updatedAt: NOW, sourceEvolutionEventId: null,
    }
    const evos = [makeEvolution()]

    const diff = buildBeforeAfterDiff('dr_morgan', params, evos, preds)

    expect(diff.brierEarly).not.toBeNull()
    expect(diff.brierLate).not.toBeNull()
    expect(diff.brierDelta).not.toBeNull()
    // Early: (0.9-0)^2=0.81, (0.6-0)^2=0.36 → avg=0.585
    // Late:  (0.7-1)^2=0.09, (0.8-1)^2=0.04 → avg=0.065
    // Delta = 0.065 - 0.585 = -0.52 (big improvement)
    expect(diff.brierEarly).toBeCloseTo(0.585, 3)
    expect(diff.brierLate).toBeCloseTo(0.065, 3)
    expect(diff.brierDelta!).toBeLessThan(0) // improvement
  })

  it('brierDelta is null when fewer than 2 resolved predictions', () => {
    const preds = [
      makePrediction({ matchId: 'm1', confidence: 0.7, outcome: { correct: true, resolvedAt: NOW } }),
    ]
    const diff = buildBeforeAfterDiff('dr_morgan', null, [makeEvolution()], preds)
    expect(diff.brierEarly).toBeNull()
    expect(diff.brierLate).toBeNull()
    expect(diff.brierDelta).toBeNull()
  })

  it('summary mentions evolution count and biggest change', () => {
    const params: AgentParamsInfo = {
      agentId: 'scout_alvarez', version: 2,
      confidenceBias: -0.12, hedgingLevel: 0.3,
      topicCalibration: {}, updatedAt: NOW, sourceEvolutionEventId: null,
    }
    const evos = [
      makeEvolution({
        agentId: 'scout_alvarez',
        parameterDiff: { confidenceBias: -0.12, narrativeWeight: -0.15 },
      }),
    ]

    const diff = buildBeforeAfterDiff('scout_alvarez', params, evos, [])
    expect(diff.summary).toContain('1 evolution')
    expect(diff.summary).toContain('v2')
    // Should mention the biggest change (narrativeWeight at -0.15 is biggest)
    expect(diff.summary.toLowerCase()).toContain('narrative weight')
  })

  it('deterministic: same inputs always produce same output', () => {
    const params: AgentParamsInfo = {
      agentId: 'dr_morgan', version: 3,
      confidenceBias: -0.05, hedgingLevel: 0.38,
      topicCalibration: {}, updatedAt: NOW, sourceEvolutionEventId: null,
    }
    const evos = [makeEvolution(), makeEvolution({ parameterDiff: { confidenceBias: 0.03 } })]
    const preds = [
      makePrediction({ matchId: 'm1', confidence: 0.7, createdAt: '2026-06-10T01:00:00Z', outcome: { correct: true, resolvedAt: '2026-06-10T03:00:00Z' } }),
      makePrediction({ matchId: 'm2', confidence: 0.5, createdAt: '2026-06-12T01:00:00Z', outcome: { correct: false, resolvedAt: '2026-06-12T03:00:00Z' } }),
    ]

    const results: string[] = []
    for (let i = 0; i < 5; i++) {
      results.push(JSON.stringify(buildBeforeAfterDiff('dr_morgan', params, evos, preds)))
    }
    for (let i = 1; i < 5; i++) {
      expect(results[i]).toBe(results[0])
    }
  })
})
