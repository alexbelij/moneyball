/**
 * readModel.test | v1.0.0 | 2026-06-14
 * T40b: Deterministic read-model for agent events.
 * Tests: exact count, 5-call determinism, recall-reject resilience, dedup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentEventService } from '../src/agents/agentEventService'

describe('T40b: deterministic read-model', () => {
  let svc: AgentEventService

  beforeEach(() => {
    svc = new AgentEventService()
  })

  // ── Exact count ──────────────────────────────────────────────────────
  it('listPredictions returns exactly N after N addPrediction calls', async () => {
    const N = 5
    for (let i = 0; i < N; i++) {
      await svc.addPrediction({
        agentId: 'dr_morgan',
        matchId: `match-${i}`,
        pick: '1',
        confidence: 0.6,
        reasoning: `Prediction ${i}`,
      })
    }
    const result = await svc.listPredictions('dr_morgan', 50)
    expect(result.length).toBe(N)
  })

  it('listEvolution returns exactly N after N addEvolution calls', async () => {
    const N = 4
    for (let i = 0; i < N; i++) {
      await svc.addEvolution({
        agentId: 'scout_alvarez',
        summary: `Evolution round ${i}: adjusted narrative weight`,
        parameterDiff: { narrativeWeight: -0.01 * i },
      })
    }
    const result = await svc.listEvolution('scout_alvarez', 50)
    expect(result.length).toBe(N)
  })

  it('listOutcomes returns exactly N after N addOutcome calls', async () => {
    const N = 3
    for (let i = 0; i < N; i++) {
      await svc.addOutcome({
        agentId: 'viktor_kane',
        predictionId: `pred-${i}`,
        correct: i % 2 === 0,
        resolvedAt: new Date(Date.now() + i * 1000).toISOString(),
      })
    }
    const result = await svc.listOutcomes('viktor_kane', 50)
    expect(result.length).toBe(N)
  })

  // ── 5-call determinism ───────────────────────────────────────────────
  it('5 consecutive listPredictions calls return identical results', async () => {
    for (let i = 0; i < 3; i++) {
      await svc.addPrediction({
        agentId: 'sofia_mendes',
        matchId: `wc-${i}`,
        pick: '2',
        confidence: 0.7 + i * 0.01,
        reasoning: `Expected value model pick ${i}`,
      })
    }

    const results: string[] = []
    for (let call = 0; call < 5; call++) {
      const items = await svc.listPredictions('sofia_mendes', 50)
      results.push(JSON.stringify(items))
    }
    // All 5 must be identical
    for (let i = 1; i < 5; i++) {
      expect(results[i]).toBe(results[0])
    }
  })

  it('5 consecutive listEvolution calls return identical results', async () => {
    await svc.addEvolution({
      agentId: 'madame_pythia',
      summary: 'Numerology alignment shifted after group stage.',
      parameterDiff: { mysticWeight: 0.04 },
    })
    await svc.addEvolution({
      agentId: 'madame_pythia',
      summary: 'Tarot calibration round 2.',
      parameterDiff: { tarotBias: -0.02 },
    })

    const results: string[] = []
    for (let call = 0; call < 5; call++) {
      const items = await svc.listEvolution('madame_pythia', 50)
      results.push(JSON.stringify(items))
    }
    for (let i = 1; i < 5; i++) {
      expect(results[i]).toBe(results[0])
    }
  })

  // ── recall() reject resilience ───────────────────────────────────────
  it('reads work even when recall() rejects (index-based, no MemWal dependency)', async () => {
    // Add events first
    await svc.addPrediction({
      agentId: 'dr_morgan',
      matchId: 'crash-test-1',
      pick: '1',
      confidence: 0.55,
      reasoning: 'Pre-crash prediction',
    })
    await svc.addEvolution({
      agentId: 'dr_morgan',
      summary: 'Pre-crash evolution entry.',
      parameterDiff: { confidenceBias: -0.03 },
    })

    // Now mock recall to always reject
    const mockClient = {
      recall: vi.fn().mockRejectedValue(new Error('MemWal 429 rate limit')),
      remember: vi.fn(),
      waitForRememberJob: vi.fn(),
    }
    vi.spyOn(svc as any, 'getClient').mockReturnValue(mockClient)
    Object.defineProperty(svc, 'enabled', { value: true })

    // Reads still work — they come from the index, not recall
    const preds = await svc.listPredictions('dr_morgan', 50)
    expect(preds.length).toBe(1)
    expect(preds[0].matchId).toBe('crash-test-1')

    const evos = await svc.listEvolution('dr_morgan', 50)
    expect(evos.length).toBe(1)
    expect(evos[0].summary).toBe('Pre-crash evolution entry.')
  })

  // ── Dedup on repeated add ────────────────────────────────────────────
  it('deduplicates predictions with the same predictionId', async () => {
    const base = {
      agentId: 'dr_morgan',
      matchId: 'dup-match',
      predictionId: 'pred:dup-match:dr_morgan',
      pick: '1',
      confidence: 0.65,
      reasoning: 'First insert',
    }

    await svc.addPrediction(base)
    await svc.addPrediction({ ...base, reasoning: 'Duplicate insert' })

    const result = await svc.listPredictions('dr_morgan', 50)
    expect(result.length).toBe(1)
    expect(result[0].reasoning).toBe('First insert')
  })

  it('deduplicates evolution with the same agentId+createdAt+summary prefix', async () => {
    // Force same createdAt by using a fixed timestamp
    const now = new Date().toISOString()
    const base = {
      agentId: 'scout_alvarez',
      summary: 'Day 2: adjusted narrative weight after upset streak.',
      parameterDiff: { narrativeWeight: -0.1 },
    }

    // Add first
    const ev1 = await svc.addEvolution(base)
    // Add "duplicate" with same summary — but createdAt will differ by a few ms
    // So let's directly test the index dedup with identical events
    const ev1Copy = { ...ev1 }
    ;(svc as any).indexEvolution(ev1Copy) // should be rejected

    const result = await svc.listEvolution('scout_alvarez', 50)
    expect(result.length).toBe(1)
  })

  // ── Cross-agent isolation ────────────────────────────────────────────
  it('events for different agents do not bleed across', async () => {
    await svc.addPrediction({
      agentId: 'dr_morgan',
      matchId: 'iso-1',
      pick: '1',
      confidence: 0.6,
      reasoning: 'Morgan only',
    })
    await svc.addPrediction({
      agentId: 'scout_alvarez',
      matchId: 'iso-2',
      pick: '2',
      confidence: 0.7,
      reasoning: 'Scout only',
    })

    const morgan = await svc.listPredictions('dr_morgan', 50)
    const scout = await svc.listPredictions('scout_alvarez', 50)
    expect(morgan.length).toBe(1)
    expect(scout.length).toBe(1)
    expect(morgan[0].reasoning).toBe('Morgan only')
    expect(scout[0].reasoning).toBe('Scout only')
  })

  // ── Outcome merge ───────────────────────────────────────────────────
  it('listPredictions merges outcomes by predictionId', async () => {
    await svc.addPrediction({
      agentId: 'dr_morgan',
      matchId: 'merge-1',
      predictionId: 'pred:merge-1:dr_morgan',
      pick: '1',
      confidence: 0.8,
      reasoning: 'Confident pick',
    })
    await svc.addOutcome({
      agentId: 'dr_morgan',
      predictionId: 'pred:merge-1:dr_morgan',
      correct: true,
      resolvedAt: new Date().toISOString(),
    })

    const preds = await svc.listPredictions('dr_morgan', 50)
    expect(preds.length).toBe(1)
    expect(preds[0].outcome).toBeDefined()
    expect(preds[0].outcome!.correct).toBe(true)
  })
})
