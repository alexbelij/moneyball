/**
 * journalEntries | v1.0.0 | 2026-06-17
 * Purpose: Synthesize human-readable "agent journal" entries from raw
 * prediction outcomes and evolution events. Judges see a NARRATIVE of
 * how the agent learned — not just tables of numbers.
 */

import type { PredictionItem, EvolutionItem } from '@/lib/api'

export interface JournalEntry {
  /** ISO timestamp */
  date: string
  /** 'prediction' | 'evolution' | 'reflection' */
  kind: 'prediction' | 'evolution' | 'reflection'
  /** One-line headline */
  headline: string
  /** 2-3 sentence narrative */
  body: string
  /** Sentiment: positive / negative / neutral */
  sentiment: 'positive' | 'negative' | 'neutral'
}

/**
 * Build chronological journal entries from raw API data.
 * Returns most recent first, capped at 20 entries.
 */
export function buildJournalEntries(
  agentName: string,
  predictions: PredictionItem[],
  evolutions: EvolutionItem[],
): JournalEntry[] {
  const entries: JournalEntry[] = []

  // Prediction-based entries (resolved only)
  for (const p of predictions) {
    if (!p.outcome) continue
    const ok = p.outcome.correct
    const conf = Math.round(p.confidence * 100)
    entries.push({
      date: p.createdAt,
      kind: 'prediction',
      headline: ok
        ? `Called it: ${p.pick} (${conf}% confidence)`
        : `Missed: predicted ${p.pick} (${conf}%)`,
      body: ok
        ? `${agentName} correctly predicted ${p.pick} for ${p.matchId}. ${conf >= 70 ? 'High confidence paid off.' : 'Cautious but accurate.'}`
        : `${agentName} predicted ${p.pick} for ${p.matchId} with ${conf}% confidence, but was wrong. ${conf >= 70 ? 'Overconfidence on this one.' : 'Low confidence — at least the doubt was warranted.'}`,
      sentiment: ok ? 'positive' : 'negative',
    })
  }

  // Evolution-based entries
  for (const ev of evolutions) {
    const diffs = Object.entries(ev.parameterDiff ?? {})
    const isNoop = ev.evolutionType === 'noop' || diffs.length === 0

    if (isNoop) continue // skip noops in journal

    const totalShift = diffs.reduce((sum, [, v]) => sum + Math.abs(v), 0)
    const mainParam = diffs.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]

    entries.push({
      date: ev.createdAt,
      kind: 'evolution',
      headline: `Evolved: ${mainParam ? `${mainParam[0]} ${mainParam[1] >= 0 ? '+' : ''}${mainParam[1].toFixed(3)}` : 'parameter update'}`,
      body: ev.summary
        ? ev.summary
        : `After reflecting on recent results, ${agentName} adjusted ${diffs.length} parameter${diffs.length > 1 ? 's' : ''}. Total shift magnitude: ${totalShift.toFixed(3)}. ${totalShift > 0.1 ? 'A significant recalibration.' : 'Fine-tuning the approach.'}`,
      sentiment: 'neutral',
    })
  }

  // Sort by date descending (most recent first)
  entries.sort((a, b) => b.date.localeCompare(a.date))

  return entries.slice(0, 20)
}
