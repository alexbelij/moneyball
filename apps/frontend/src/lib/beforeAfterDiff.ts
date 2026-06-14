/**
 * beforeAfterDiff | v1.0.0 | 2026-06-14
 * Purpose: Pure, deterministic diff builder for the "Day 1 vs Day N"
 * before/after comparison panel (T36). Takes evolution events + current
 * params + predictions and produces a judge-legible comparison.
 *
 * No LLM, no randomness — every word is template-derived from the data.
 */

import type { EvolutionItem, PredictionItem, AgentParamsInfo } from '@/lib/api'

// ── Day-1 defaults (mirror sleep-worker's defaultParams) ────────────────

export const DAY1_DEFAULTS = {
  confidenceBias: 0,
  hedgingLevel: 0.3,
} as const

// ── Types ───────────────────────────────────────────────────────────────

export interface ParamSnapshot {
  confidenceBias: number
  hedgingLevel: number
  /** Topic calibration entries (key → value). Empty on day 1. */
  topics: Record<string, number>
}

export interface ParamDiffEntry {
  key: string
  label: string
  day1: number
  dayN: number
  delta: number
  direction: 'up' | 'down' | 'flat'
}

export interface BeforeAfterDiff {
  /** Agent ID. */
  agentId: string
  /** How many evolution events occurred. */
  evolutionCount: number
  /** Current params version. */
  paramsVersion: number
  /** Day 1 snapshot. */
  day1: ParamSnapshot
  /** Day N snapshot (current). */
  dayN: ParamSnapshot
  /** Per-parameter diffs (core + aggregated evolution diffs). */
  diffs: ParamDiffEntry[]
  /** Brier score on first half of resolved predictions (day-1 era). */
  brierEarly: number | null
  /** Brier score on second half of resolved predictions (day-N era). */
  brierLate: number | null
  /** Brier delta (late - early). Negative = improved. */
  brierDelta: number | null
  /** 1–2 sentence human-readable summary. */
  summary: string
}

// ── Helpers ─────────────────────────────────────────────────────────────

function humanLabel(key: string): string {
  const labels: Record<string, string> = {
    confidenceBias: 'Confidence bias',
    hedgingLevel: 'Hedging level',
    narrativeWeight: 'Narrative weight',
    squadDepthWeight: 'Squad depth weight',
    contrarianism: 'Contrarianism',
    publicSentimentWeight: 'Public sentiment weight',
    publicSentimentThreshold: 'Sentiment threshold',
    marketEfficiency: 'Market efficiency',
    lineMovementWeight: 'Line movement weight',
    mysticismIntensity: 'Mysticism intensity',
    planetaryAlignment: 'Planetary alignment',
    numerologyBias: 'Numerology bias',
    recentFormWeight: 'Recent form weight',
    topicCalibration: 'Topic calibration',
  }
  return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

function computeBrier(predictions: PredictionItem[]): number {
  if (predictions.length === 0) return 0
  let sum = 0
  for (const p of predictions) {
    const outcome = p.outcome!.correct ? 1 : 0
    sum += (p.confidence - outcome) ** 2
  }
  return sum / predictions.length
}

function magnitudeWord(abs: number): string {
  if (abs < 0.02) return 'slightly'
  if (abs < 0.08) return 'moderately'
  return 'sharply'
}

// ── Main builder ────────────────────────────────────────────────────────

export function buildBeforeAfterDiff(
  agentId: string,
  params: AgentParamsInfo | null,
  evolutions: EvolutionItem[],
  predictions: PredictionItem[],
): BeforeAfterDiff {
  // Day 1 snapshot
  const day1: ParamSnapshot = {
    confidenceBias: DAY1_DEFAULTS.confidenceBias,
    hedgingLevel: DAY1_DEFAULTS.hedgingLevel,
    topics: {},
  }

  // Day N snapshot (from current params)
  const dayN: ParamSnapshot = {
    confidenceBias: params?.confidenceBias ?? DAY1_DEFAULTS.confidenceBias,
    hedgingLevel: params?.hedgingLevel ?? DAY1_DEFAULTS.hedgingLevel,
    topics: {},
  }

  // Copy topicCalibration from params
  if (params?.topicCalibration) {
    for (const [k, v] of Object.entries(params.topicCalibration)) {
      dayN.topics[k] = typeof v === 'number' ? v : (v as any)?.multiplier ?? 0
    }
  }

  // Aggregate all evolution diffs to show non-core params too
  const aggregatedDiffs = new Map<string, number>()
  for (const ev of evolutions) {
    if (!ev.parameterDiff) continue
    for (const [k, v] of Object.entries(ev.parameterDiff)) {
      aggregatedDiffs.set(k, (aggregatedDiffs.get(k) ?? 0) + v)
    }
  }

  // Build diff entries for core params
  const diffs: ParamDiffEntry[] = []

  // Core params always shown
  for (const key of ['confidenceBias', 'hedgingLevel'] as const) {
    const d1 = day1[key]
    const dN = dayN[key]
    const delta = dN - d1
    diffs.push({
      key, label: humanLabel(key),
      day1: d1, dayN: dN, delta,
      direction: delta > 0.001 ? 'up' : delta < -0.001 ? 'down' : 'flat',
    })
  }

  // Add aggregated evolution-diff params that aren't core
  for (const [key, totalDelta] of aggregatedDiffs) {
    if (key === 'confidenceBias' || key === 'hedgingLevel') continue
    diffs.push({
      key, label: humanLabel(key),
      day1: 0, dayN: totalDelta, delta: totalDelta,
      direction: totalDelta > 0.001 ? 'up' : totalDelta < -0.001 ? 'down' : 'flat',
    })
  }

  // Sort by absolute delta (largest drift first)
  diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  // Brier score: split resolved predictions into early and late halves
  const resolved = predictions
    .filter(p => p.outcome)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const mid = Math.floor(resolved.length / 2)
  const brierEarly = mid >= 1 ? computeBrier(resolved.slice(0, mid)) : null
  const brierLate = mid >= 1 ? computeBrier(resolved.slice(mid)) : null
  const brierDelta = brierEarly !== null && brierLate !== null
    ? parseFloat((brierLate - brierEarly).toFixed(4))
    : null

  // Build summary sentence
  const summary = buildSummary(agentId, evolutions.length, diffs, brierDelta, params?.version ?? 0)

  return {
    agentId,
    evolutionCount: evolutions.length,
    paramsVersion: params?.version ?? 0,
    day1,
    dayN,
    diffs,
    brierEarly,
    brierLate,
    brierDelta,
    summary,
  }
}

function buildSummary(
  _agentId: string,
  evoCount: number,
  diffs: ParamDiffEntry[],
  brierDelta: number | null,
  version: number,
): string {
  if (evoCount === 0) {
    return 'No evolution yet — the scout is still running on Day 1 defaults.'
  }

  const significantChanges = diffs.filter(d => Math.abs(d.delta) >= 0.02)
  const parts: string[] = []

  // Opening
  parts.push(`After ${evoCount} evolution${evoCount === 1 ? '' : 's'} (now v${version})`)

  // Biggest changes
  if (significantChanges.length > 0) {
    const top = significantChanges.slice(0, 2)
    const phrases = top.map(d => {
      const dir = d.delta > 0 ? 'raised' : 'lowered'
      return `${dir} ${d.label.toLowerCase()} ${magnitudeWord(Math.abs(d.delta))}`
    })
    parts[0] += `, the scout ${phrases.join(' and ')}.`
  } else {
    parts[0] += ', parameters shifted only slightly.'
  }

  // Brier delta
  if (brierDelta !== null) {
    if (brierDelta < -0.01) {
      parts.push(`Accuracy improved: Brier score dropped ${Math.abs(brierDelta).toFixed(3)} (lower = better).`)
    } else if (brierDelta > 0.01) {
      parts.push(`Accuracy dipped slightly: Brier score rose ${brierDelta.toFixed(3)}.`)
    } else {
      parts.push('Accuracy held steady across the tournament.')
    }
  }

  return parts.join(' ')
}
