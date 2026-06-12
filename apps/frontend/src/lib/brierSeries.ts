/**
 * brierSeries | v1.0.0 | 2026-06-13
 * Purpose: Pure function to compute rolling Brier score series per agent
 * from resolved predictions. Used by StatsReport SVG chart (T15).
 *
 * Brier score for a single binary prediction:
 *   BS = (forecast - outcome)²
 * where forecast = confidence (0–1) and outcome = 1 if correct, 0 if not.
 *
 * Rolling average: cumulative mean of all resolved predictions up to that point.
 * Lower is better (0 = perfect, 1 = worst).
 */

import type { PredictionItem } from '@/lib/api'

/** One data point in the rolling Brier series. */
export interface BrierPoint {
  /** 1-based match index (x-axis). */
  matchIndex: number
  /** Match ID for tooltip. */
  matchId: string
  /** The agent's pick. */
  pick: string
  /** Whether the prediction was correct. */
  correct: boolean
  /** Individual Brier score for this prediction. */
  brierScore: number
  /** Cumulative rolling average Brier score up to this point. */
  rollingBrier: number
  /** ISO timestamp of resolution. */
  resolvedAt: string
}

export interface AgentBrierSeries {
  agentId: string
  points: BrierPoint[]
}

/**
 * Build the rolling Brier series for one agent from their prediction items.
 * Only resolved predictions (with outcome) are included.
 * Returns points sorted by resolvedAt ascending.
 */
export function buildBrierSeries(agentId: string, items: PredictionItem[]): AgentBrierSeries {
  const resolved = items
    .filter((p) => p.outcome != null)
    .sort((a, b) => a.outcome!.resolvedAt.localeCompare(b.outcome!.resolvedAt))

  let cumSum = 0
  const points: BrierPoint[] = resolved.map((p, i) => {
    const outcome = p.outcome!.correct ? 1 : 0
    const bs = (p.confidence - outcome) ** 2
    cumSum += bs
    return {
      matchIndex: i + 1,
      matchId: p.matchId,
      pick: p.pick,
      correct: p.outcome!.correct,
      brierScore: bs,
      rollingBrier: cumSum / (i + 1),
      resolvedAt: p.outcome!.resolvedAt,
    }
  })

  return { agentId, points }
}

/**
 * Build series for multiple agents. Useful for the overlay chart.
 */
export function buildAllBrierSeries(
  data: Array<{ agentId: string; items: PredictionItem[] }>,
): AgentBrierSeries[] {
  return data.map((d) => buildBrierSeries(d.agentId, d.items))
}
