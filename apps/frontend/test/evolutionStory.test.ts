/**
 * evolutionStory.test.ts | v1.0.0 | 2026-06-13
 * Tests for T28: deterministic human-readable evolution narrative.
 */

import { describe, it, expect } from 'vitest'
import { buildEvolutionStory } from '@/lib/evolutionStory'
import type { EvolutionItem } from '@/lib/api'

function ev(p: Partial<EvolutionItem>): EvolutionItem {
  return {
    agentId: 'dr_morgan',
    createdAt: '2026-06-15T08:00:00Z',
    summary: p.summary ?? '',
    ...p,
  } as EvolutionItem
}

describe('buildEvolutionStory', () => {
  it('builds a headline from versions + humanised type', () => {
    const s = buildEvolutionStory(ev({ fromVersion: 1, toVersion: 2, evolutionType: 'weight_tuning' }))
    expect(s.headline).toBe('v1 → v2 · weight tuning')
  })

  it('falls back to "evolution" when versions are absent', () => {
    const s = buildEvolutionStory(ev({}))
    expect(s.headline).toBe('evolution')
  })

  it('describes a no-op consolidation when there are no deltas', () => {
    const s = buildEvolutionStory(ev({ fromVersion: 2, toVersion: 3, evolutionType: 'memory_consolidation' }))
    expect(s.changes).toHaveLength(0)
    expect(s.narrative).toBe('After memory consolidation, the scout consolidated its memory without changing any weights.')
  })

  it('orders changes by magnitude and humanises labels + direction', () => {
    const s = buildEvolutionStory(ev({
      fromVersion: 1, toVersion: 2, evolutionType: 'learning',
      parameterDiff: { confidenceBias: 0.01, learning_rate: -0.15, hedgingLevel: 0.05 },
    }))
    // largest magnitude first: learning_rate (-0.15), hedging (0.05), confidence (0.01)
    expect(s.changes.map((c) => c.key)).toEqual(['learning_rate', 'hedgingLevel', 'confidenceBias'])
    expect(s.changes[0].phrase).toBe('lowered learning rate sharply')
    expect(s.changes[1].phrase).toBe('raised hedging moderately')
    expect(s.changes[2].phrase).toBe('raised confidence slightly')
    expect(s.narrative).toBe(
      'After learning, the scout lowered learning rate sharply, raised hedging moderately and raised confidence slightly. 3 parameters adjusted on this cycle.',
    )
  })

  it('ignores zero deltas and uses singular wording for one change', () => {
    const s = buildEvolutionStory(ev({
      fromVersion: 1, toVersion: 2,
      parameterDiff: { confidenceBias: 0.2, hedgingLevel: 0 },
    }))
    expect(s.changes).toHaveLength(1)
    expect(s.narrative).toBe('The scout raised confidence sharply. 1 parameter adjusted on this cycle.')
  })

  it('humanises dotted topic-calibration keys', () => {
    const s = buildEvolutionStory(ev({
      parameterDiff: { 'topicCalibration.derby': -0.08 },
    }))
    expect(s.changes[0].label).toBe('derby calibration')
    expect(s.changes[0].phrase).toBe('lowered derby calibration moderately')
  })

  it('is deterministic for identical input', () => {
    const item = ev({ fromVersion: 1, toVersion: 2, parameterDiff: { learning_rate: -0.1 } })
    expect(buildEvolutionStory(item)).toEqual(buildEvolutionStory(item))
  })
})
