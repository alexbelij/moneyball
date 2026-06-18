/**
 * agentMood | v1.0.0 | 2026-06-18 (T79)
 * Purpose: Compute an agent's "mood" from recent prediction outcomes.
 * Mood is derived from the last N outcomes and influences the agent's
 * visual state (thought bubbles, status text) and confidence bias.
 *
 * Mood types:
 *   confident  — 3+ correct in last 5 → small confidence boost
 *   validated  — 4+ correct in last 5 → larger boost, agent "glows"
 *   neutral    — mixed results, no adjustment
 *   anxious    — 3+ wrong in last 5 → slight confidence decrease
 *   humbled    — 4+ wrong in last 5 → larger decrease, agent recalibrates
 *
 * Memory → behavior: mood is computed from Walrus-stored outcomes and
 * directly modifies the next prediction's confidence. This is genuine
 * memory-driven behavior change, not just logging.
 */

export type AgentMood = 'confident' | 'validated' | 'neutral' | 'anxious' | 'humbled'

export interface MoodState {
  mood: AgentMood
  streak: number          // consecutive correct (positive) or wrong (negative)
  recentCorrect: number   // correct in last WINDOW outcomes
  recentTotal: number     // total in last WINDOW outcomes
  /** Multiplicative modifier on raw confidence. 1.0 = no change. */
  confidenceModifier: number
}

const WINDOW = 5

/**
 * Compute mood from a list of recent outcomes (most recent first).
 * Each outcome is `true` = correct, `false` = wrong.
 */
export function computeMood(outcomes: boolean[]): MoodState {
  const recent = outcomes.slice(0, WINDOW)
  const correct = recent.filter(Boolean).length
  const total = recent.length

  // Streak: count consecutive same results from most recent
  let streak = 0
  if (recent.length > 0) {
    const first = recent[0]
    for (const o of recent) {
      if (o === first) streak++
      else break
    }
    if (!first) streak = -streak // negative for wrong streak
  }

  let mood: AgentMood
  let confidenceModifier: number

  if (total < 2) {
    mood = 'neutral'
    confidenceModifier = 1.0
  } else if (correct >= 4) {
    mood = 'validated'
    confidenceModifier = 1.08 // +8% confidence
  } else if (correct >= 3) {
    mood = 'confident'
    confidenceModifier = 1.04 // +4% confidence
  } else if (total - correct >= 4) {
    mood = 'humbled'
    confidenceModifier = 0.90 // -10% confidence
  } else if (total - correct >= 3) {
    mood = 'anxious'
    confidenceModifier = 0.95 // -5% confidence
  } else {
    mood = 'neutral'
    confidenceModifier = 1.0
  }

  return { mood, streak, recentCorrect: correct, recentTotal: total, confidenceModifier }
}

/** Thought bubble text for each mood. */
export const MOOD_THOUGHTS: Record<AgentMood, string[]> = {
  validated: [
    'Everything is clicking. The model is razor-sharp right now.',
    'Four out of five. The data speaks clearly when you listen.',
    'On a roll. Confidence earned, not assumed.',
  ],
  confident: [
    'Good run lately. The calibration is paying off.',
    'Numbers are trending my way. Staying disciplined.',
    'Three correct calls. The methodology works.',
  ],
  neutral: [
    'Mixed signals. Staying level-headed.',
    'Win some, lose some. The long game matters.',
    'Data is noisy. Proceeding with caution.',
  ],
  anxious: [
    'Something is off. Need to reconsider my assumptions.',
    'Three misses. Am I overweighting something?',
    'The model is drifting. Time to pay closer attention.',
  ],
  humbled: [
    'Four wrong. The market knows something I don\'t.',
    'Brutal stretch. Lowering confidence until the data stabilizes.',
    'Humility is data-driven too. Recalibrating everything.',
  ],
}
