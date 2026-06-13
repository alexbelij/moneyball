/**
 * evolutionStory | v1.0.0 | 2026-06-13
 * Purpose: Turn a raw EvolutionItem (version bump + parameter deltas) into a
 * human-readable narrative for the dossier Evolution tab (T28).
 *
 * STRICTLY deterministic & template-based — NO LLM. Every word is derived from
 * the event's own fields (versions, evolutionType, parameterDiff). Given the
 * same event it always produces the same story.
 */

import type { EvolutionItem } from '@/lib/api'

export interface EvolutionChange {
  /** Raw parameter key. */
  key: string
  /** Humanised label. */
  label: string
  /** Signed delta. */
  delta: number
  /** Plain-language phrase, e.g. "raised confidence sharply". */
  phrase: string
}

export interface EvolutionStory {
  /** Short headline, e.g. "v1 → v2 · learning". */
  headline: string
  /** One or two full sentences describing what changed and why. */
  narrative: string
  /** Per-parameter changes, ordered by magnitude (largest first). */
  changes: EvolutionChange[]
}

/** Known parameter → friendly label. Falls back to de-snake-casing the key. */
const LABELS: Record<string, string> = {
  confidenceBias: 'confidence',
  hedgingLevel: 'hedging',
  learning_rate: 'learning rate',
  error_threshold: 'error tolerance',
  injury_weight_adjustment: 'injury weighting',
  omen_penalty: 'omen penalty',
}

function humanLabel(key: string): string {
  if (LABELS[key]) return LABELS[key]
  // topicCalibration.<topic> → "<topic> calibration"
  const dot = key.indexOf('.')
  if (dot >= 0) return `${key.slice(dot + 1).replace(/_/g, ' ')} calibration`
  return key.replace(/_/g, ' ')
}

function magnitudeWord(abs: number): string {
  if (abs < 0.02) return 'slightly'
  if (abs < 0.1) return 'moderately'
  return 'sharply'
}

function changePhrase(label: string, delta: number): string {
  const dir = delta >= 0 ? 'raised' : 'lowered'
  return `${dir} ${label} ${magnitudeWord(Math.abs(delta))}`
}

/** Humanise the evolutionType token, e.g. "weight_tuning" → "weight tuning". */
function humanType(t?: string): string | null {
  if (!t) return null
  return t.replace(/_/g, ' ')
}

/**
 * Build a deterministic narrative for a single evolution event.
 */
export function buildEvolutionStory(item: EvolutionItem): EvolutionStory {
  const diff = item.parameterDiff ?? {}
  const changes: EvolutionChange[] = Object.entries(diff)
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .map(([key, delta]) => {
      const label = humanLabel(key)
      return { key, label, delta, phrase: changePhrase(label, delta) }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const versionLabel =
    typeof item.fromVersion === 'number' && typeof item.toVersion === 'number'
      ? `v${item.fromVersion} → v${item.toVersion}`
      : 'evolution'
  const typeLabel = humanType(item.evolutionType)
  const headline = typeLabel ? `${versionLabel} · ${typeLabel}` : versionLabel

  const trigger = typeLabel ? `After ${typeLabel}, the scout` : 'The scout'

  let narrative: string
  if (changes.length === 0) {
    narrative = `${trigger} consolidated its memory without changing any weights.`
  } else {
    const phrases = changes.map((c) => c.phrase)
    const list =
      phrases.length === 1
        ? phrases[0]
        : `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`
    const count = `${changes.length} parameter${changes.length === 1 ? '' : 's'}`
    narrative = `${trigger} ${list}. ${count} adjusted on this cycle.`
  }

  return { headline, narrative, changes }
}
