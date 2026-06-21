/**
 * seedSource.test | 2026-06-21
 * Validates that seedReadModel tags all events with source: 'seed'
 * and that live events default to source: 'live'.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { AgentEventService } from '../src/agents/agentEventService'
import { seedReadModel } from '../src/agents/seedReadModel'

describe('seed vs live source tagging', () => {
  let svc: AgentEventService

  beforeAll(async () => {
    svc = new AgentEventService()
    await seedReadModel(svc)
  })

  it('seedReadModel tags all predictions as source=seed', async () => {
    const preds = await svc.listPredictions('dr_morgan', 100)
    expect(preds.length).toBeGreaterThan(0)
    for (const p of preds) {
      expect(p.source).toBe('seed')
    }
  })

  it('seedReadModel tags all evolutions as source=seed', async () => {
    const evos = await svc.listEvolution('dr_morgan', 100)
    expect(evos.length).toBeGreaterThan(0)
    for (const e of evos) {
      expect(e.source).toBe('seed')
    }
  })

  it('live predictions default to source=live', async () => {
    const ev = await svc.addPrediction({
      agentId: 'dr_morgan',
      matchId: 'live-test-match',
      pick: 'France win',
      confidence: 0.75,
      reasoning: 'Live test prediction',
    })
    expect(ev.source).toBe('live')
  })

  it('live evolutions default to source=live', async () => {
    const ev = await svc.addEvolution({
      agentId: 'dr_morgan',
      summary: 'Live recalibration after match',
      parameterDiff: { hedgingLevel: 0.01 },
    })
    expect(ev.source).toBe('live')
  })

  it('seed source can be explicitly passed and preserved', async () => {
    const ev = await svc.addPrediction({
      agentId: 'scout_alvarez',
      matchId: 'explicit-seed-test',
      pick: 'Draw',
      confidence: 0.5,
      reasoning: 'Explicit seed test',
      source: 'seed',
    })
    expect(ev.source).toBe('seed')
  })
})
