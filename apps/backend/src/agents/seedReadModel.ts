/**
 * seedReadModel | v1.0.0 | 2026-06-15 | T57
 * Purpose: Deterministically rebuild the demo read-model baseline at boot so a
 * cold start (ephemeral disk wiped on redeploy) is judge-ready WITHOUT a manual
 * re-seed. MemWal stays the durable source of truth; this only reconstructs the
 * in-memory read-model that the public endpoints serve.
 *
 * Why not just "replay from MemWal"? The MemWal SDK exposes only semantic
 * top-K recall(), not full enumeration — so a complete, reliable replay is not
 * possible from MemWal alone. The read-model, however, is a pure deterministic
 * function of (matches + scores): the prediction engine has no RNG and the demo
 * evolutions are fixed. We rebuild it from the committed fixture instead.
 *
 * Idempotent: predictions key on `predictionId` (`pred:manual:seed-N:agent`),
 * outcomes on the same id, evolutions on `runId`. Running this twice — or over a
 * warm index that already has the events — adds nothing.
 */

import { applyCalibration, defaultParams } from '@moneyball/sleep-worker'
import { predictMatch, type AgentMethodology, type MethodologyType } from '../matches/predictionEngine'
import { outcomeFromScore, type Match, type PickCode } from '../matches/types'
import type { AgentEventService } from './agentEventService'
import agentConfig from './agent-config.v1.json'
import { SEED_AGENT_IDS, SEED_EVOLUTIONS, SEED_MATCHES, SEED_RESOLVED_AT, type SeedMatch } from './seedFixture'

const pickLabel = (m: { homeTeam: string; awayTeam: string }, p: PickCode): string =>
  p === '1' ? `${m.homeTeam} win` : p === '2' ? `${m.awayTeam} win` : 'Draw'

function agents(): AgentMethodology[] {
  return (agentConfig as unknown as {
    agents: Array<{ id: string; methodology: { type: string; parameters?: Record<string, number> } }>
  }).agents.map((a) => ({
    agentId: a.id,
    type: a.methodology.type as MethodologyType,
    parameters: a.methodology.parameters ?? {},
  }))
}

function matchOf(seed: SeedMatch): Match {
  return {
    id: seed.id,
    homeTeam: seed.homeTeam,
    awayTeam: seed.awayTeam,
    kickoffUtc: seed.kickoffUtc,
    stage: seed.stage,
    status: 'finished',
    result: {
      homeScore: seed.homeScore,
      awayScore: seed.awayScore,
      outcome: outcomeFromScore(seed.homeScore, seed.awayScore),
    },
  }
}

export interface SeedResult {
  predictions: number
  outcomes: number
  evolutions: number
}

/**
 * True once every seed agent already has its full 8-match prediction baseline.
 * Cheap guard so we skip the rebuild on a warm boot (the rebuild is idempotent
 * regardless, but this avoids re-touching the index for nothing).
 */
export async function hasSeedBaseline(svc: AgentEventService): Promise<boolean> {
  const sentinel = SEED_MATCHES[SEED_MATCHES.length - 1].id // manual:seed-8
  for (const agentId of SEED_AGENT_IDS) {
    const preds = await svc.listPredictions(agentId, 100)
    const hasAll = preds.some((p) => p.matchId === sentinel && p.predictionId === `pred:${sentinel}:${agentId}`)
    if (!hasAll) return false
  }
  return true
}

/**
 * Replay the deterministic fixture into the read-model. Idempotent.
 * Returns how many NEW events were written (0 on a fully warm index).
 */
export async function seedReadModel(svc: AgentEventService): Promise<SeedResult> {
  const ag = agents().filter((a) => (SEED_AGENT_IDS as readonly string[]).includes(a.agentId))
  const nowIso = new Date().toISOString()
  let predictions = 0
  let outcomes = 0
  let evolutions = 0

  for (const seed of SEED_MATCHES) {
    const match = matchOf(seed)
    const topic = `wc_${match.stage}`
    const resolvedAt = SEED_RESOLVED_AT(seed)
    for (const agent of ag) {
      const raw = predictMatch(agent, match)
      // v0 calibration (default params, no sleep applied) — identity-ish.
      const effective = applyCalibration(defaultParams(agent.agentId, nowIso), topic, raw.rawConfidence)
      const predictionId = `pred:${match.id}:${agent.agentId}`

      const beforeP = svc.predictionCount(agent.agentId)
      await svc.addPrediction({
        agentId: agent.agentId,
        matchId: match.id,
        pick: pickLabel(match, raw.pick),
        confidence: effective,
        reasoning: `${pickLabel(match, raw.pick)} — ${raw.reasoning}`,
        predictionId,
        topic,
        rawConfidence: raw.rawConfidence,
        paramsVersion: 0,
      })
      if (svc.predictionCount(agent.agentId) > beforeP) predictions++

      const correct = raw.pick === match.result!.outcome
      const beforeO = svc.outcomeCount(agent.agentId)
      await svc.addOutcome({ agentId: agent.agentId, predictionId, correct, resolvedAt })
      if (svc.outcomeCount(agent.agentId) > beforeO) outcomes++
    }
  }

  for (const evo of SEED_EVOLUTIONS) {
    const before = svc.evolutionCount(evo.agentId)
    await svc.addEvolution({
      agentId: evo.agentId,
      createdAt: evo.createdAt,
      summary: evo.summary,
      parameterDiff: evo.parameterDiff,
      runId: evo.runId,
      fromVersion: evo.fromVersion,
      toVersion: evo.toVersion,
      evolutionType: 'param_update',
    })
    if (svc.evolutionCount(evo.agentId) > before) evolutions++
  }

  return { predictions, outcomes, evolutions }
}
