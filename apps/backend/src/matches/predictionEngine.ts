/**
 * predictionEngine | v0.2.0 | 2026-06-12
 * Purpose: Deterministic, zero-LLM prediction methodologies for the 5 agents.
 * Same (agentId, match) ⇒ same pick/confidence/reasoning, forever — the
 * decision log rule "LLM never mutates numbers" extends to "no RNG in the
 * prediction path". Personality lives in the formula + templates; learning
 * lives in AgentParams (sleep-worker) which calibrates the RAW confidence
 * into the EFFECTIVE one at the call site.
 *
 * V2 note: pseudo-strength below is a hash of the team name — a placeholder
 * with honest variance. Swapping in real xG/odds feeds only changes
 * `teamStrength`/`syntheticOdds`, not the engine contract.
 */

import type { Match, PickCode } from './types'
import { divine } from './mysticism/mysticismEngine'

export interface AgentPick {
  pick: PickCode
  rawConfidence: number
  reasoning: string
}

export type MethodologyType =
  | 'weighted_metrics'
  | 'narrative_sentiment'
  | 'contrarian_inversion'
  | 'expected_value'
  | 'deterministic_mysticism'

// ── Deterministic primitives ─────────────────────────────────────────────────

/** FNV-1a 32-bit → [0, 1). Stable across runs and platforms. */
export function hash01(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 0x100000000
}

const clamp01 = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v))

/** Pseudo team strength in [0.3, 0.7] — placeholder for real xG (V2). */
function teamStrength(team: string): number {
  return 0.3 + hash01(`strength:${team}`) * 0.4
}

function pickByMargin(margin: number, drawBand: number): PickCode {
  if (margin > drawBand) return '1'
  if (margin < -drawBand) return '2'
  return 'X'
}

const pct = (v: number): string => `${Math.round(v * 100)}%`

// ── Methodologies ────────────────────────────────────────────────────────────

function drMorgan(m: Match): AgentPick {
  const home = teamStrength(m.homeTeam) + 0.04 // home advantage term
  const away = teamStrength(m.awayTeam)
  const margin = home - away
  const pick = pickByMargin(margin, 0.05)
  const rawConfidence = clamp01(0.58 + Math.abs(margin) * 1.4, 0.55, 0.88)
  return {
    pick,
    rawConfidence,
    reasoning: `xG model: ${m.homeTeam} ${home.toFixed(2)} vs ${m.awayTeam} ${away.toFixed(2)} (home term +0.04). Margin ${margin.toFixed(2)} → ${pick}. Sample-weighted confidence ${pct(rawConfidence)}.`,
  }
}

function scoutAlvarez(m: Match): AgentPick {
  // Narrative sentiment: gut signal salted by matchday — moods change daily.
  const day = m.kickoffUtc.slice(0, 10)
  const gut = hash01(`gut:${m.homeTeam}:${m.awayTeam}:${day}`)
  const pick: PickCode = gut > 0.55 ? '1' : gut < 0.45 ? '2' : 'X'
  const rawConfidence = clamp01(0.62 + Math.abs(gut - 0.5) * 0.7, 0.6, 0.95)
  const side = pick === '1' ? m.homeTeam : pick === '2' ? m.awayTeam : 'neither side'
  return {
    pick,
    rawConfidence,
    reasoning: `The dressing room tells me everything. Today the fire is with ${side} — captain's eyes don't lie. Gut index ${gut.toFixed(2)}, conviction ${pct(rawConfidence)}.`,
  }
}

function viktorKane(m: Match, p: Record<string, number>): AgentPick {
  // Invert the consensus (Dr. Morgan's model = the crowd) when it's strong.
  const consensus = drMorgan(m)
  const consensusThreshold = p.consensus_threshold ?? 0.72
  const floor = p.contrarian_confidence_floor ?? 0.55
  const strongConsensus = consensus.rawConfidence >= consensusThreshold
  const inverted: PickCode =
    consensus.pick === '1' ? '2' : consensus.pick === '2' ? '1' : 'X'
  const pick = strongConsensus ? inverted : 'X'
  const rawConfidence = clamp01(
    floor + (consensus.rawConfidence - consensusThreshold) * (p.upset_multiplier ?? 1.2),
    floor,
    0.82,
  )
  return {
    pick,
    rawConfidence,
    reasoning: strongConsensus
      ? `The herd is ${pct(consensus.rawConfidence)} sure of ${consensus.pick}. That certainty is exactly the trap — fading it: ${pick}.`
      : `No strong consensus to fade (${pct(consensus.rawConfidence)} < ${pct(consensusThreshold)}). When the crowd hesitates, chaos wins: X.`,
  }
}

function sofiaMendes(m: Match, p: Record<string, number>): AgentPick {
  // True probabilities from strengths; a synthetic MARKET misprices them with
  // deterministic per-outcome noise + favorite shading (public over-bets
  // favorites). EV_i = pTrue_i / pMarket_i; bet only when the edge clears
  // min_edge, otherwise pass (X) — "no value, no bet".
  const home = teamStrength(m.homeTeam) + 0.04
  const away = teamStrength(m.awayTeam)
  const total = home + away + 0.25 // draw mass
  const pTrue: Record<PickCode, number> = {
    '1': home / total,
    '2': away / total,
    X: 0.25 / total,
  }
  const bias = p.public_bias_correction ?? 0.03
  const favorite: PickCode = pTrue['1'] >= pTrue['2'] ? '1' : '2'
  const noise = (o: PickCode): number => (hash01(`market:${m.id}:${o}`) - 0.5) * 0.16
  const pMarket = {} as Record<PickCode, number>
  for (const o of ['1', 'X', '2'] as PickCode[]) {
    pMarket[o] = Math.max(0.03, pTrue[o] * (1 + noise(o)) + (o === favorite ? bias : -bias / 2))
  }
  const ev = {} as Record<PickCode, number>
  for (const o of ['1', 'X', '2'] as PickCode[]) ev[o] = pTrue[o] / pMarket[o]

  const best = (['1', 'X', '2'] as PickCode[]).reduce((a, b) => (ev[b] > ev[a] ? b : a))
  const minEdge = p.min_edge ?? 0.04
  const hasValue = ev[best] >= 1 + minEdge
  const pick: PickCode = hasValue ? best : 'X'
  const rawConfidence = hasValue
    ? clamp01(0.55 + (ev[best] - 1) * 2.2, 0.55, 0.85)
    : 0.55
  const fmt = (o: PickCode) => (1 / pMarket[o]).toFixed(2)
  return {
    pick,
    rawConfidence,
    reasoning: hasValue
      ? `Market odds 1/X/2 = ${fmt('1')}/${fmt('X')}/${fmt('2')} vs my model — edge ${((ev[best] - 1) * 100).toFixed(1)}% on ${pick}. Value bet, stake-confidence ${pct(rawConfidence)}.`
      : `Market odds 1/X/2 = ${fmt('1')}/${fmt('X')}/${fmt('2')} are efficient today (best edge ${((ev[best] - 1) * 100).toFixed(1)}% < ${(minEdge * 100).toFixed(0)}%). No value, no bet — X.`,
  }
}

function madamePythia(m: Match, p: Record<string, number>): AgentPick {
  // v0.2: real books — Pythagorean numerology + classical astrology
  // (mysticism/*.v1.json), applied as pure deterministic rules.
  const v = divine(m.homeTeam, m.awayTeam, m.kickoffUtc, p)
  return { pick: v.pick, rawConfidence: v.rawConfidence, reasoning: v.reasoning }
}

// ── Engine ───────────────────────────────────────────────────────────────────

export interface AgentMethodology {
  agentId: string
  type: MethodologyType
  parameters: Record<string, number>
}

export function predictMatch(agent: AgentMethodology, match: Match): AgentPick {
  switch (agent.type) {
    case 'weighted_metrics':
      return drMorgan(match)
    case 'narrative_sentiment':
      return scoutAlvarez(match)
    case 'contrarian_inversion':
      return viktorKane(match, agent.parameters)
    case 'expected_value':
      return sofiaMendes(match, agent.parameters)
    case 'deterministic_mysticism':
      return madamePythia(match, agent.parameters)
  }
}
