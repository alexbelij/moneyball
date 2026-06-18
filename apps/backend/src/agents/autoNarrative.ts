/**
 * autoNarrative | v1.0.0 | 2026-06-18 (T79)
 * Purpose: After each sleep cycle, generate a 1–2 sentence template-based
 * narrative summary and write it to MemWal as a "tournament diary" entry.
 * No LLM — pure template + data. Produces the long-term memory trail that
 * judges can inspect as proof of genuine memory accumulation.
 */

import type { SleepRunResult } from '@moneyball/sleep-worker'

export interface NarrativeEntry {
  agentId: string
  timestamp: string
  text: string
  kind: 'evolved' | 'noop' | 'rolled_back'
}

const EVOLVE_TEMPLATES = [
  (id: string, from: number, to: number) =>
    `${id} recalibrated after reviewing outcomes (params v${from} → v${to}). The model now weighs recent evidence differently.`,
  (id: string, from: number, to: number) =>
    `Sleep cycle complete. ${id} evolved from v${from} to v${to} — adjusting confidence thresholds based on prediction accuracy.`,
  (id: string, from: number, to: number) =>
    `${id} dreamt of past mistakes and emerged changed (v${from} → v${to}). Memory shapes behavior.`,
]

const NOOP_TEMPLATES = [
  (id: string, reason: string) =>
    `${id} reviewed recent results but found no reason to adjust: ${reason}. Staying the course.`,
  (id: string, reason: string) =>
    `Sleep cycle for ${id}: reflection complete, no parameter changes needed. ${reason}`,
]

const ROLLBACK_TEMPLATES = [
  (id: string, to: number) =>
    `${id} detected calibration drift and rolled back to v${to}. Sometimes memory means knowing when to undo.`,
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateNarrative(
  agentId: string,
  result: SleepRunResult,
): NarrativeEntry | null {
  const ts = new Date().toISOString()
  const name = formatName(agentId)

  switch (result.kind) {
    case 'evolved':
      return {
        agentId,
        timestamp: ts,
        kind: 'evolved',
        text: pick(EVOLVE_TEMPLATES)(name, result.fromVersion, result.toVersion),
      }
    case 'noop':
      return {
        agentId,
        timestamp: ts,
        kind: 'noop',
        text: pick(NOOP_TEMPLATES)(name, result.reason ?? 'no significant drift detected'),
      }
    case 'rolled_back':
      return {
        agentId,
        timestamp: ts,
        kind: 'rolled_back',
        text: pick(ROLLBACK_TEMPLATES)(name, result.toVersion),
      }
    default:
      return null // not_due, lock_busy, aborted — no narrative
  }
}

function formatName(agentId: string): string {
  return agentId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Build the MemWal remember key for the narrative namespace. */
export function narrativeMemwalKey(entry: NarrativeEntry): string {
  return `moneyball:narrative:${entry.agentId}:${entry.timestamp}`
}

/** Build the text blob to store in MemWal. */
export function narrativeMemwalText(entry: NarrativeEntry): string {
  return `${narrativeMemwalKey(entry)}\n${JSON.stringify(entry)}`
}
