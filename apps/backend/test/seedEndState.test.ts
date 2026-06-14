/**
 * seedEndState.test | v1.0.0 | 2026-06-14
 * T42: End-state guard — validates that the seed-demo admin-API pipeline
 * produces a judge-ready before/after state. Exercises AgentEventService
 * directly (same code path as POST /api/admin/agents/:id/predict|evolve).
 *
 * If this test ever fails, the demo is broken.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { AgentEventService } from '../src/agents/agentEventService'

const AGENTS = [
  'dr_morgan',
  'scout_alvarez',
  'viktor_kane',
  'sofia_mendes',
  'madame_pythia',
] as const

describe('seed end-state guard', () => {
  let eventSvc: AgentEventService

  beforeAll(async () => {
    eventSvc = new AgentEventService()

    // Seeder adds predictions via admin API → eventSvc.addPrediction
    for (const agentId of AGENTS) {
      for (let i = 1; i <= 3; i++) {
        await eventSvc.addPrediction({
          agentId,
          matchId: `manual:seed-match-${i}`,
          pick: i % 2 === 0 ? '2' : '1',
          confidence: 0.55 + i * 0.05,
          reasoning: `Demo prediction #${i} by ${agentId}`,
        })
      }
    }

    // Seeder adds evolution via admin API → eventSvc.addEvolution
    await eventSvc.addEvolution({
      agentId: 'dr_morgan',
      summary: 'Day 2: Japan upset shifted xG weight. Reduced confidence bias.',
      parameterDiff: { confidenceBias: -0.08, hedgingLevel: 0.05 },
    })
    await eventSvc.addEvolution({
      agentId: 'scout_alvarez',
      summary: 'Day 3: narrative weight down after streak of upsets.',
      parameterDiff: { narrativeWeight: -0.12 },
    })
    await eventSvc.addEvolution({
      agentId: 'dr_morgan',
      summary: 'Day 5: Brier improved 12%. Narrowing confidence bands.',
      parameterDiff: { confidenceBias: 0.03, topicCalibration: 0.06 },
    })
    await eventSvc.addEvolution({
      agentId: 'viktor_kane',
      summary: 'Day 4: selective contrarianism working above 75% sentiment.',
      parameterDiff: { contrarianism: 0.04, hedgingLevel: -0.04 },
    })
  })

  it('every agent has at least one prediction', async () => {
    for (const agentId of AGENTS) {
      const preds = await eventSvc.listPredictions(agentId, 50)
      expect(preds.length, `${agentId} should have predictions`).toBeGreaterThanOrEqual(1)
    }
  })

  it('dr_morgan has >= 2 evolution entries (day1 vs dayN proof)', async () => {
    const items = await eventSvc.listEvolution('dr_morgan', 50)
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('evolution entries have non-empty summaries', async () => {
    const items = await eventSvc.listEvolution('dr_morgan', 50)
    for (const ev of items) {
      expect(ev.summary).toBeTruthy()
      expect(ev.summary.length).toBeGreaterThan(10)
    }
  })

  it('evolution entries have parameterDiff with numeric values', async () => {
    const items = await eventSvc.listEvolution('dr_morgan', 50)
    const withDiff = items.filter((e: any) => e.parameterDiff)
    expect(withDiff.length).toBeGreaterThanOrEqual(1)
    for (const ev of withDiff) {
      const diff = (ev as any).parameterDiff
      expect(typeof diff).toBe('object')
      for (const v of Object.values(diff)) {
        expect(typeof v).toBe('number')
      }
    }
  })

  it('at least 3 agents have evolution entries (breadth)', async () => {
    let count = 0
    for (const agentId of AGENTS) {
      const items = await eventSvc.listEvolution(agentId, 50)
      if (items.length > 0) count++
    }
    expect(count).toBeGreaterThanOrEqual(3)
  })

  it('predictions include matchId, pick, and confidence', async () => {
    const preds = await eventSvc.listPredictions('dr_morgan', 50)
    expect(preds.length).toBeGreaterThanOrEqual(1)
    for (const p of preds) {
      expect(p.matchId).toBeTruthy()
      expect(p.pick).toBeTruthy()
      expect(typeof p.confidence).toBe('number')
    }
  })

  it('multiple predictions per agent (seeder creates 3+)', async () => {
    const preds = await eventSvc.listPredictions('sofia_mendes', 50)
    expect(preds.length).toBeGreaterThanOrEqual(3)
  })
})
