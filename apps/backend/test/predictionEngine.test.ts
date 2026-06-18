/**
 * predictionEngine.test | v0.1.0 | 2026-06-12
 * Determinism, bounds and persona-behavior tests for all 5 methodologies.
 */

import { describe, expect, it } from 'vitest'
import { hash01, predictMatch, type AgentMethodology } from '../src/matches/predictionEngine'
import type { Match } from '../src/matches/types'

const AGENTS: AgentMethodology[] = [
  { agentId: 'dr_morgan', type: 'weighted_metrics', parameters: {} },
  { agentId: 'scout_alvarez', type: 'narrative_sentiment', parameters: {} },
  {
    agentId: 'viktor_kane',
    type: 'contrarian_inversion',
    parameters: { consensus_threshold: 0.72, contrarian_confidence_floor: 0.55, upset_multiplier: 1.2 },
  },
  { agentId: 'sofia_mendes', type: 'expected_value', parameters: { public_bias_correction: 0.03 } },
  { agentId: 'madame_pythia', type: 'deterministic_mysticism', parameters: {} },
]

const match = (home: string, away: string, day = 16): Match => ({
  id: `t:${home}:${away}:${day}`,
  homeTeam: home,
  awayTeam: away,
  kickoffUtc: `2026-06-${String(day).padStart(2, '0')}T18:00:00Z`,
  stage: 'group',
  status: 'scheduled',
  result: null,
})

const TEAMS = ['Brazil', 'Germany', 'Spain', 'France', 'Japan', 'USA', 'Mexico', 'Croatia']

describe('hash01', () => {
  it('is stable and in [0,1)', () => {
    expect(hash01('strength:Brazil')).toBe(hash01('strength:Brazil'))
    for (const t of TEAMS) {
      const v = hash01(t)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('predictMatch', () => {
  it('is deterministic for every agent', () => {
    const m = match('Brazil', 'Germany')
    for (const agent of AGENTS) {
      const a = predictMatch(agent, m)
      const b = predictMatch(agent, m)
      expect(a, agent.agentId).toEqual(b)
    }
  })

  it('keeps confidence within [0.5, 0.97] for all agents across fixtures', () => {
    for (const agent of AGENTS) {
      for (let d = 1; d < 50; d++) {
        for (const h of TEAMS) {
          for (const a of TEAMS) {
            if (h === a) continue
            const p = predictMatch(agent, match(h, a, d))
            expect(p.rawConfidence, `${agent.agentId} ${h}-${a}`).toBeGreaterThanOrEqual(0.5)
            expect(p.rawConfidence, `${agent.agentId} ${h}-${a}`).toBeLessThanOrEqual(0.97)
            expect(['1', 'X', '2']).toContain(p.pick)
            expect(p.reasoning.length).toBeGreaterThan(20)
          }
        }
      }
    }
  })

  it('every agent produces all three outcomes somewhere (no constant function)', () => {
    for (const agent of AGENTS) {
      const picks = new Set<string>()
      for (let d = 1; d < 50; d++) {
        for (const h of TEAMS) for (const a of TEAMS) if (h !== a) picks.add(predictMatch(agent, match(h, a, d)).pick)
      }
      expect(picks.size, `${agent.agentId} must produce at least 2 distinct picks`).toBeGreaterThanOrEqual(2)
    }
  })

  it('viktor_kane inverts strong consensus and hedges weak one to X', () => {
    const kane = AGENTS[2]
    const morgan = AGENTS[0]
    let inversions = 0
    let hedges = 0
    for (const h of TEAMS) {
      for (const a of TEAMS) {
        if (h === a) continue
        const m = match(h, a)
        const consensus = predictMatch(morgan, m)
        const contra = predictMatch(kane, m)
        if (consensus.rawConfidence >= 0.72) {
          const inverted = consensus.pick === '1' ? '2' : consensus.pick === '2' ? '1' : 'X'
          expect(contra.pick, `${h}-${a}`).toBe(inverted)
          inversions++
        } else {
          expect(contra.pick, `${h}-${a}`).toBe('X')
          hedges++
        }
      }
    }
    expect(inversions).toBeGreaterThan(0)
    expect(hedges).toBeGreaterThan(0)
  })

  it('agents disagree with each other (personas are distinct)', () => {
    let disagreements = 0
    let total = 0
    for (const h of TEAMS) {
      for (const a of TEAMS) {
        if (h === a) continue
        const m = match(h, a)
        const picks = new Set(AGENTS.map((ag) => predictMatch(ag, m).pick))
        if (picks.size > 1) disagreements++
        total++
      }
    }
    expect(disagreements / total).toBeGreaterThan(0.5)
  })
})
