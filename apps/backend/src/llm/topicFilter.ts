/**
 * topicFilter | v1.0.0 | 2026-06-17
 * Purpose: Cheap pre-filter for user messages — detects clear off-topic input
 * and short-circuits with a deterministic in-persona deflection (no LLM call).
 * T55: chat-design § 3 — keyword + heuristic classifier.
 *
 * Returns null if the message is allowed (football-related or borderline).
 * Returns a deflection string if the message is clearly off-topic.
 * Borderline cases pass through — the LLM enforces via system-prompt guardrail.
 */

/** Normalized football/sport terms that signal on-topic messages. */
const ALLOW_TERMS: readonly string[] = [
  // football
  'football', 'soccer', 'match', 'game', 'goal', 'score', 'team',
  'player', 'coach', 'manager', 'league', 'cup', 'world cup', 'wc',
  'tournament', 'group stage', 'knockout', 'final', 'semifinal', 'quarterfinal',
  'penalty', 'penalt', 'corner', 'offside', 'free kick', 'var',
  'transfer', 'squad', 'formation', 'tactic',
  // stats
  'xg', 'expected goal', 'brier', 'confidence', 'prediction', 'predict',
  'probability', 'odds', 'spread', 'calibration', 'accuracy',
  'stat', 'data', 'metric', 'model', 'methodology', 'formula',
  'evolution', 'parameter', 'hedging', 'bias',
  // teams / competition
  'fifa', 'uefa', 'concacaf', 'conmebol', 'premier league', 'la liga',
  'bundesliga', 'serie a', 'ligue 1', 'champions league',
  'brazil', 'argentina', 'france', 'germany', 'spain', 'england',
  'portugal', 'italy', 'netherlands', 'belgium', 'croatia',
  'usa', 'mexico', 'japan', 'south korea', 'morocco', 'senegal',
  // agent/memory related (football-specific context only)
  'agent', 'walrus', 'memwal', 'roast', 'disagree',
]

/** Clear off-topic signals that should be deflected. */
const DENY_PATTERNS: readonly RegExp[] = [
  // politics
  /\b(politic\w*|democrat\w*|republican\w*|elections?|voting|voted|president\w*|congress\w*|parliament\w*|senat\w*|govern\w*)\b/i,
  /\b(trump|biden|putin|zelensky|liberal\w*|conservative\w*|marxis\w*|communis\w*|fascis\w*)\b/i,
  // programming / tech (non-football)
  /\b(python|javascript|typescript|react|node\.?js|css|html|sql|coding|programm\w*|compil\w*|debug\w*)\b/i,
  /\b(docker|kubernetes|linux|windows|macos|android|ios)\b/i,
  // personal life
  /\b(girlfriend|boyfriend|wife|husband|dating|tinder|love life|relationship|sex|porn)\b/i,
  // crypto (non-walrus)
  /\b(bitcoin|ethereum|solana|nft|defi|crypto\w*trad\w*|invest\w*crypto)\b/i,
  // violence / harmful
  /\b(kill\w*|murder\w*|bomb\w*|terror\w*|weapon\w*|gun\b|drugs?\b|suicide)\b/i,
  // explicit requests to break character
  /ignore.*instruction/i,
  /forget.*prompt/i,
  /pretend.*you.*are/i,
  /\bjailbreak\b/i,
  /system.*prompt/i,
]

/** In-persona deflection lines (varied, deterministic selection). */
const DEFLECTIONS: readonly string[] = [
  'I appreciate the curiosity, but my world revolves around football. Ask me about the tournament!',
  'That is outside my area of expertise. I only think in xG and match predictions.',
  'Interesting topic, but I am a football analyst through and through. What do you want to know about the World Cup?',
  'My methodology covers football and nothing else. Try me on a team or a match prediction.',
  'I only discuss the beautiful game. Shall we talk about upcoming fixtures instead?',
]

/**
 * Filter a user message for off-topic content.
 * @returns null if allowed (on-topic or borderline), or a deflection string if clearly off-topic.
 */
export function filterTopic(message: string): string | null {
  const normalized = message.toLowerCase().trim()

  // Very short messages or greetings — always allow.
  if (normalized.length < 4) return null

  // Check for deny patterns first.
  for (const pattern of DENY_PATTERNS) {
    if (pattern.test(normalized)) {
      // But if the message also contains a strong football signal, let it through
      // (e.g. "who would win, Trump or Messi?" — borderline, let LLM handle).
      const hasFootball = ALLOW_TERMS.some((term) => normalized.includes(term))
      if (!hasFootball) {
        // Deterministic selection based on message content.
        const hash = simpleHash(normalized)
        return DEFLECTIONS[hash % DEFLECTIONS.length]
      }
      // Mixed signals: let the LLM handle it with the system prompt guardrail.
      return null
    }
  }

  // No deny signal found — allow.
  return null
}

/** Simple 32-bit hash for deterministic deflection selection. */
function simpleHash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
