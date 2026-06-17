/**
 * readModelDurability.test | T57
 * Simulates a cold start (fresh, in-memory read-model index — the equivalent of
 * a redeploy that wiped the ephemeral .data disk) and asserts that the boot
 * rebuild reconstructs the deterministic demo baseline WITHOUT a manual re-seed:
 *
 *   - 8 predictions / agent, all with stable `manual:seed-*` matchIds
 *   - substantive (non-noop) evolutions: dr/scout/viktor = 2, sofia/pythia = 1
 *   - reads are deterministic (5 consecutive reads identical)
 *   - re-running the rebuild is idempotent (no duplicates)
 *   - /health readiness counters reflect the rebuilt index
 */

import { describe, expect, it } from 'vitest'
import { AgentEventService } from '../src/agents/agentEventService'
import { hasSeedBaseline, seedReadModel } from '../src/agents/seedReadModel'
import { SEED_AGENT_IDS } from '../src/agents/seedFixture'

const TRIPLE = ['dr_morgan', 'scout_alvarez', 'viktor_kane']
const DOUBLE = ['sofia_mendes', 'madame_pythia']

/** Fresh, disk-less service — a clean cold start every time. */
function coldService() {
  return new AgentEventService({ dataDir: null })
}

describe('T57 read-model durability — cold-start rebuild', () => {
  it('starts empty (cold) and reports no baseline', async () => {
    const svc = coldService()
    expect(await hasSeedBaseline(svc)).toBe(false)
    for (const a of SEED_AGENT_IDS) expect(svc.predictionCount(a)).toBe(0)
  })

  it('rebuilds the deterministic baseline from the fixture', async () => {
    const svc = coldService()
    const r = await seedReadModel(svc)
    expect(r.predictions).toBe(40) // 8 matches × 5 agents
    expect(r.outcomes).toBe(40)
    expect(r.evolutions).toBe(13) // wave1 (5) + wave2 (3) + noop (5)

    expect(await hasSeedBaseline(svc)).toBe(true)

    for (const a of SEED_AGENT_IDS) {
      const preds = await svc.listPredictions(a, 100)
      expect(preds.length, `${a} predictions`).toBe(8)
      // every prediction is a stable seed match, fully resolved
      for (const p of preds) {
        expect(p.matchId).toMatch(/^manual:seed-\d+$/)
        expect(p.predictionId).toBe(`pred:${p.matchId}:${a}`)
        expect(p.outcome, `${a} ${p.matchId} outcome`).toBeDefined()
        expect(typeof p.outcome?.correct).toBe('boolean')
      }
    }
  })

  it('store baseline 3/3/3/2/2 (incl 1 noop/agent), substantive 2/2/2/1/1', async () => {
    const svc = coldService()
    await seedReadModel(svc)
    // Store totals: substantive + 1 noop per agent
    for (const a of TRIPLE) {
      expect(svc.evolutionCount(a), `${a} total`).toBe(3) // 2 substantive + 1 noop
      expect(svc.substantiveEvolutionCount(a), `${a} substantive`).toBe(2)
    }
    for (const a of DOUBLE) {
      expect(svc.evolutionCount(a), `${a} total`).toBe(2) // 1 substantive + 1 noop
      expect(svc.substantiveEvolutionCount(a), `${a} substantive`).toBe(1)
    }
    // Every evolution carries a stable runId for dedup
    for (const a of SEED_AGENT_IDS) {
      const evo = await svc.listEvolution(a, 100)
      expect(evo.every((e) => Boolean(e.runId)), `${a} evolutions carry runId`).toBe(true)
      // Exactly 1 noop per agent
      const noops = evo.filter((e) => e.evolutionType === 'noop')
      expect(noops.length, `${a} noop count`).toBe(1)
      expect(Object.keys(noops[0].parameterDiff ?? {}).length, `${a} noop has empty diff`).toBe(0)
    }
  })

  it('read-filtered baseline (panel default) = 2/2/2/1/1 — no noop', async () => {
    const svc = coldService()
    await seedReadModel(svc)
    // Simulate what the GET /evolution endpoint returns by default (no ?includeNoops)
    for (const a of SEED_AGENT_IDS) {
      const all = await svc.listEvolution(a, 100)
      const filtered = all.filter(
        (e) => e.evolutionType !== 'noop' && Object.keys(e.parameterDiff ?? {}).length > 0,
      )
      const expected = TRIPLE.includes(a) ? 2 : 1
      expect(filtered.length, `${a} filtered`).toBe(expected)
      expect(filtered.every((e) => e.evolutionType !== 'noop'), `${a} no noop in filtered`).toBe(true)
    }
  })

  it('is deterministic — 5 consecutive reads are byte-identical', async () => {
    const svc = coldService()
    await seedReadModel(svc)
    const snapshots: string[] = []
    for (let i = 0; i < 5; i++) {
      const all: Record<string, unknown> = {}
      for (const a of SEED_AGENT_IDS) {
        all[a] = {
          preds: await svc.listPredictions(a, 100),
          evo: await svc.listEvolution(a, 100),
          out: await svc.listOutcomes(a, 100),
        }
      }
      snapshots.push(JSON.stringify(all))
    }
    expect(new Set(snapshots).size).toBe(1)
  })

  it('is idempotent — re-running the rebuild adds nothing', async () => {
    const svc = coldService()
    await seedReadModel(svc)
    const second = await seedReadModel(svc)
    expect(second.predictions).toBe(0)
    expect(second.outcomes).toBe(0)
    expect(second.evolutions).toBe(0)
    for (const a of SEED_AGENT_IDS) {
      expect(svc.predictionCount(a)).toBe(8)
      expect(svc.outcomeCount(a)).toBe(8)
    }
  })

  it('two independent cold boots reconstruct identical baselines', async () => {
    const a = coldService()
    const b = coldService()
    await seedReadModel(a)
    await seedReadModel(b)
    for (const id of SEED_AGENT_IDS) {
      const pa = await a.listPredictions(id, 100)
      const pb = await b.listPredictions(id, 100)
      // strip volatile createdAt before comparing prediction content
      const norm = (xs: typeof pa) =>
        JSON.stringify(xs.map(({ createdAt, ...rest }) => rest))
      expect(norm(pa), id).toBe(norm(pb))
    }
  })

  it('readinessReport reflects the rebuilt index for /health', async () => {
    const svc = coldService()
    expect(svc.readinessReport(SEED_AGENT_IDS).ready).toBe(false)
    await seedReadModel(svc)
    const report = svc.readinessReport(SEED_AGENT_IDS)
    expect(report.ready).toBe(true)
    expect(report.totals.predictions).toBe(40)
    expect(report.totals.outcomes).toBe(40)
    expect(report.totals.evolutions).toBe(13) // 8 substantive + 5 noop
    expect(report.totals.substantiveEvolutions).toBe(8)
    expect(report.agents.dr_morgan.predictions).toBe(8)
    expect(report.agents.dr_morgan.evolutions).toBe(3) // 2 substantive + 1 noop
    expect(report.agents.dr_morgan.substantiveEvolutions).toBe(2)
    expect(report.agents.sofia_mendes.evolutions).toBe(2) // 1 substantive + 1 noop
    expect(report.agents.sofia_mendes.substantiveEvolutions).toBe(1)
  })

  it('slept/evolved counters: every agent shows "slept 1 · evolved N"', async () => {
    const svc = coldService()
    await seedReadModel(svc)
    for (const a of SEED_AGENT_IDS) {
      const total = svc.evolutionCount(a)
      const substantive = svc.substantiveEvolutionCount(a)
      const slept = total - substantive
      expect(slept, `${a} slept`).toBe(1) // 1 noop per agent
      expect(substantive, `${a} evolved`).toBeGreaterThanOrEqual(1)
    }
  })
})
