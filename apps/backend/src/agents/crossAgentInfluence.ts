/**
 * crossAgentInfluence | v1.0.0 | 2026-06-18 (T79)
 * Purpose: Agents coordinate through shared Walrus memory. After all agents
 * predict a match, compute consensus. If an agent's pick disagrees with the
 * majority, apply a small confidence adjustment. This is genuine multi-agent
 * coordination through a common source of truth (MemWal).
 *
 * Flow:
 *   1. All 5 agents predict match X independently
 *   2. crossAgentInfluence.computeConsensus() reads all picks from the index
 *   3. Dissenters get a small confidence modifier:
 *      - 4/5 agree, you dissent → -3% (lonely contrarian penalty)
 *      - 3/5 agree, you dissent → no change (reasonable split)
 *      - Full consensus → +2% (group confidence boost)
 *
 * This feeds into the prediction's effective confidence (stacks with mood).
 */

import type { AgentEventService, AgentPredictionEvent } from './agentEventService'

export interface ConsensusResult {
  matchId: string
  /** The majority pick, or null if no clear majority. */
  majorityPick: string | null
  /** How many agents picked the majority. */
  majorityCount: number
  totalAgents: number
  /** Per-agent consensus modifier (multiplier on confidence). */
  modifiers: Record<string, number>
  /** Per-agent pick for the match. */
  picks: Record<string, string>
}

/**
 * Compute consensus for a given match across all agents.
 * Call after all agents have predicted.
 */
export function computeConsensus(
  agentIds: readonly string[],
  matchId: string,
  events: AgentEventService,
): ConsensusResult {
  const picks: Record<string, string> = {}
  const pickCounts = new Map<string, number>()

  for (const agentId of agentIds) {
    const predId = `pred:${matchId}:${agentId}`
    // Access the prediction index directly via the public listPredictions
    // We check all predictions for this agent to find the one for this match
    const preds = (events as any).predictionIndex?.get(agentId) as AgentPredictionEvent[] | undefined
    if (!preds) continue

    const pred = preds.find((p) => p.matchId === matchId || p.predictionId === predId)
    if (!pred) continue

    // Extract the core pick (team name or 'Draw')
    const pick = extractPick(pred.pick)
    picks[agentId] = pick
    pickCounts.set(pick, (pickCounts.get(pick) ?? 0) + 1)
  }

  // Find majority
  let majorityPick: string | null = null
  let majorityCount = 0
  for (const [pick, count] of pickCounts) {
    if (count > majorityCount) {
      majorityCount = count
      majorityPick = pick
    }
  }

  const totalAgents = Object.keys(picks).length
  const modifiers: Record<string, number> = {}

  for (const agentId of agentIds) {
    const agentPick = picks[agentId]
    if (!agentPick) {
      modifiers[agentId] = 1.0
      continue
    }

    if (majorityCount === totalAgents) {
      // Full consensus — small group confidence boost
      modifiers[agentId] = 1.02
    } else if (majorityCount >= 4 && agentPick !== majorityPick) {
      // Strong consensus, agent dissents — lonely contrarian penalty
      modifiers[agentId] = 0.97
    } else if (majorityCount >= 4 && agentPick === majorityPick) {
      // Strong consensus, agent agrees — slight boost
      modifiers[agentId] = 1.01
    } else {
      // Split opinion — no modifier
      modifiers[agentId] = 1.0
    }
  }

  return { matchId, majorityPick, majorityCount, totalAgents, modifiers, picks }
}

function extractPick(pick: string): string {
  // pick format: "Germany win" / "Draw" / "Scotland win — reasoning..."
  const dashIdx = pick.indexOf('—')
  const clean = dashIdx >= 0 ? pick.slice(0, dashIdx).trim() : pick.trim()
  return clean.replace(/ win$/, '')
}

/** Format consensus as a narrative for MemWal storage. */
export function consensusNarrative(c: ConsensusResult): string {
  if (c.majorityCount === c.totalAgents && c.majorityPick) {
    return `Unanimous: all ${c.totalAgents} agents picked ${c.majorityPick} for match ${c.matchId}.`
  }
  if (c.majorityCount >= 4 && c.majorityPick) {
    const dissenters = Object.entries(c.picks)
      .filter(([, p]) => p !== c.majorityPick)
      .map(([id]) => formatName(id))
    return `Strong consensus: ${c.majorityCount}/${c.totalAgents} agents back ${c.majorityPick}. ${dissenters.join(', ')} ${dissenters.length === 1 ? 'dissents' : 'dissent'}.`
  }
  return `Split opinion on match ${c.matchId}: no clear consensus (${c.majorityCount}/${c.totalAgents} max agreement).`
}

function formatName(agentId: string): string {
  return agentId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
