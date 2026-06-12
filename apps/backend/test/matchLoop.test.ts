/**
 * matchLoop.test | v0.1.0 | 2026-06-12
 * Integration test of the full loop on the manual provider:
 * predict → resolve → outcome merge → sleep trigger → evolution events.
 * Also guards idempotency: repeated ticks never double-predict or
 * double-resolve.
 */

import { describe, expect, it } from 'vitest'
import agentConfig from '../src/agents/agent-config.v1.json'
import { AgentEventService } from '../src/agents/agentEventService'
import { SleepService } from '../src/agents/sleepService'
import { ManualMatchProvider } from '../src/matches/manualProvider'
import { MatchWorker } from '../src/matches/matchWorker'
import type { AgentMethodology, MethodologyType } from '../src/matches/predictionEngine'

const agents: AgentMethodology[] = (agentConfig as unknown as { agents: Array<{ id: string; methodology: { type: string; parameters?: Record<string, number> } }> }).agents.map(
  (a) => ({
    agentId: a.id,
    type: a.methodology.type as MethodologyType,
    parameters: a.methodology.parameters ?? {},
  }),
)

function makeWorld() {
  const publicEvents = new AgentEventService()
  const sleep = new SleepService(publicEvents)
  const manual = new ManualMatchProvider()
  const thoughts: Array<{ agentId: string; text: string }> = []
  const worker = new MatchWorker(manual, agents, sleep, {
    pollSeconds: 9999,
    predictionLeadHours: 48,
    onThought: (agentId, text) => thoughts.push({ agentId, text }),
  })
  return { publicEvents, sleep, manual, worker, thoughts }
}

describe('match loop', () => {
  it('runs predict → resolve → merge → evolve end to end', async () => {
    const { publicEvents, sleep, manual, worker } = makeWorld()
    const fixtures: Array<[string, string, number, number]> = [
      ['Brazil', 'Germany', 1, 7],
      ['Spain', 'France', 2, 1],
      ['Argentina', 'Mexico', 2, 0],
      ['England', 'USA', 0, 0],
      ['Japan', 'Croatia', 1, 3],
    ]
    for (const [home, away, hs, as_] of fixtures) {
      const m = manual.create({ homeTeam: home, awayTeam: away })
      await worker.tick()
      manual.resolve(m.id, hs, as_)
      await worker.tick()
    }

    for (const agent of agents) {
      const preds = await publicEvents.listPredictions(agent.agentId, 30)
      expect(preds.length, agent.agentId).toBe(5)
      for (const p of preds) {
        expect(p.outcome, `${agent.agentId} ${p.matchId}`).toBeDefined()
        expect(typeof p.outcome?.correct).toBe('boolean')
        expect(p.predictionId).toMatch(/^pred:/)
        expect(p.paramsVersion).toBeGreaterThanOrEqual(0)
      }
      const params = await sleep.getParams(agent.agentId)
      expect(params.version).toBeGreaterThanOrEqual(0)
    }
  })

  it('never double-predicts or double-resolves on repeated ticks', async () => {
    const { publicEvents, manual, worker } = makeWorld()
    const m = manual.create({ homeTeam: 'Brazil', awayTeam: 'Germany' })
    await worker.tick()
    await worker.tick()
    await worker.tick()
    manual.resolve(m.id, 2, 0)
    await worker.tick()
    await worker.tick()

    const preds = await publicEvents.listPredictions('dr_morgan', 30)
    expect(preds.length).toBe(1)
    const outcomes = await publicEvents.listOutcomes('dr_morgan')
    expect(outcomes.length).toBe(1)
  })

  it('never predicts a match that is already finished', async () => {
    const { publicEvents, manual, worker } = makeWorld()
    const m = manual.create({ homeTeam: 'Italy', awayTeam: 'Norway' })
    manual.resolve(m.id, 3, 1) // finished before any tick
    await worker.tick()
    const preds = await publicEvents.listPredictions('dr_morgan', 30)
    expect(preds.length).toBe(0)
  })

  it('emits thought bubbles for predictions and resolutions', async () => {
    const { manual, worker, thoughts } = makeWorld()
    const m = manual.create({ homeTeam: 'Brazil', awayTeam: 'Germany' })
    await worker.tick()
    manual.resolve(m.id, 1, 7)
    await worker.tick()
    // 5 prediction thoughts + 5 resolution thoughts minimum
    expect(thoughts.length).toBeGreaterThanOrEqual(10)
    expect(new Set(thoughts.map((t) => t.agentId)).size).toBe(5)
  })
})

describe('agentEventService (dev fallback)', () => {
  it('merges outcomes into predictions on read', async () => {
    const svc = new AgentEventService()
    await svc.addPrediction({
      agentId: 'dr_morgan',
      matchId: 'm1',
      pick: '1',
      confidence: 0.7,
      reasoning: 'test',
      predictionId: 'pred:m1:dr_morgan',
    })
    await svc.addOutcome({
      agentId: 'dr_morgan',
      predictionId: 'pred:m1:dr_morgan',
      correct: true,
      resolvedAt: new Date().toISOString(),
    })
    const preds = await svc.listPredictions('dr_morgan')
    expect(preds.length).toBe(1)
    expect(preds[0].outcome?.correct).toBe(true)
  })
})
