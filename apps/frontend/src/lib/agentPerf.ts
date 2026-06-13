/**
 * agentPerf | v1.0.0 | 2026-06-13
 * Purpose: Pure transforms for the per-agent performance chart shown in the
 * dossier (T27). Derives a rolling Brier + rolling accuracy series from a
 * single agent's resolved predictions, and locates the resolved-match indices
 * where the params version changed (evolution markers).
 *
 * No LLM, no network — deterministic functions over PredictionItem[].
 */

import type { PredictionItem } from '@/lib/api'

export interface AgentPerfPoint {
  /** 1-based index over resolved predictions (x-axis). */
  matchIndex: number
  matchId: string
  pick: string
  correct: boolean
  /** Single-prediction Brier score: (confidence - outcome)². */
  brierScore: number
  /** Cumulative mean Brier up to this point (lower = better). */
  rollingBrier: number
  /** Cumulative accuracy (correct / total) up to this point, 0–1. */
  rollingAccuracy: number
  /** Params version active for this prediction, if known. */
  paramsVersion: number | null
  resolvedAt: string
}

export interface AgentPerfSeries {
  agentId: string
  points: AgentPerfPoint[]
  /** Final cumulative accuracy (0–1), or null if no resolved matches. */
  finalAccuracy: number | null
  /** Final rolling Brier, or null if no resolved matches. */
  finalBrier: number | null
  /** Count of resolved predictions. */
  resolvedCount: number
}

/**
 * Build the per-agent performance series from prediction items. Only resolved
 * predictions (with an outcome) are included, sorted by resolution time.
 */
export function buildAgentPerfSeries(agentId: string, items: PredictionItem[]): AgentPerfSeries {
  const resolved = items
    .filter((p) => p.outcome != null)
    .sort((a, b) => a.outcome!.resolvedAt.localeCompare(b.outcome!.resolvedAt))

  let brierSum = 0
  let correctSum = 0
  const points: AgentPerfPoint[] = resolved.map((p, i) => {
    const outcome = p.outcome!.correct ? 1 : 0
    const bs = (p.confidence - outcome) ** 2
    brierSum += bs
    correctSum += outcome
    const n = i + 1
    return {
      matchIndex: n,
      matchId: p.matchId,
      pick: p.pick,
      correct: p.outcome!.correct,
      brierScore: bs,
      rollingBrier: brierSum / n,
      rollingAccuracy: correctSum / n,
      paramsVersion: typeof p.paramsVersion === 'number' ? p.paramsVersion : null,
      resolvedAt: p.outcome!.resolvedAt,
    }
  })

  const last = points[points.length - 1]
  return {
    agentId,
    points,
    finalAccuracy: last ? last.rollingAccuracy : null,
    finalBrier: last ? last.rollingBrier : null,
    resolvedCount: points.length,
  }
}

/**
 * Indices (1-based matchIndex) at which the params version increased versus the
 * previous resolved prediction. These mark where the agent evolved between
 * matches — used to draw vertical "evolution" markers on the chart.
 */
export function versionChangeIndices(points: AgentPerfPoint[]): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].paramsVersion
    const cur = points[i].paramsVersion
    if (prev != null && cur != null && cur > prev) out.push(points[i].matchIndex)
  }
  return out
}
