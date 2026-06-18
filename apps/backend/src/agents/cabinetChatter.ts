/**
 * cabinetChatter | v1.0.0 | 2026-06-17
 * Purpose: Deterministic cross-agent chatter — agents reference each other's
 * predictions, methodology, and personality in the ambient thought loop (T53).
 *
 * All text is pure template + deterministic selection (FNV-1a). No LLM, no RNG
 * beyond the time-bucket seed. Every invocation with the same seed produces
 * the same (speaker, target, line) triple.
 *
 * Chatter augments the existing ambient loop: every ~3rd cycle, instead of a
 * solo thought-bubble a cross-reference fires between two agents.
 */

import { hashString, dayKey } from './agentPersonaService'

export const CORE_AGENT_IDS = [
  'dr_morgan',
  'scout_alvarez',
  'viktor_kane',
  'sofia_mendes',
  'madame_pythia',
] as const

export type CoreAgentId = (typeof CORE_AGENT_IDS)[number]

/** Short display name for each agent (English, no Cyrillic). */
export const AGENT_NAMES: Record<CoreAgentId, string> = {
  dr_morgan: 'Dr. Morgan',
  scout_alvarez: 'Scout',
  viktor_kane: 'Kane',
  sofia_mendes: 'Sofia',
  madame_pythia: 'Pythia',
}

// ── Cross-reference templates ───────────────────────────────────────────
// {speaker} talks about/to {target}. Templates use `$target` placeholder.
// Grouped by speaker so each agent has a distinctive voice.

export interface ChatterTemplate {
  speaker: CoreAgentId
  target: CoreAgentId
  lines: string[]
}

const CHATTER_LINES: ChatterTemplate[] = [
  // Dr. Morgan → others
  {
    speaker: 'dr_morgan', target: 'scout_alvarez',
    lines: [
      '$target relies on "vibes"… my regression model would like a word.',
      'I respect $target\'s scouting eye, but his sample size is anecdotal at best.',
      'Interesting — $target picked the same side. Probably for the wrong reasons.',
    ],
  },
  {
    speaker: 'dr_morgan', target: 'viktor_kane',
    lines: [
      '$target disagrees on principle. At least my principles have p-values.',
      'Contrarianism without data is just noise — right, $target?',
      '$target flipped my pick again. Statistically, he has to be right eventually.',
    ],
  },
  {
    speaker: 'dr_morgan', target: 'sofia_mendes',
    lines: [
      '$target follows the money. I follow the model. We agree more than she admits.',
      'The market isn\'t always efficient, $target. My data says so.',
      '$target\'s line movement agrees with my xG. Even broken clocks…',
    ],
  },
  {
    speaker: 'dr_morgan', target: 'madame_pythia',
    lines: [
      '$target just blamed a loss on Mercury retrograde. I need a moment.',
      'Shirt numbers predicting outcomes? $target, that\'s not methodology — it\'s numerology.',
      'If $target\'s stars aligned with my confidence intervals, I\'d be worried.',
    ],
  },

  // Scout Alvarez → others
  {
    speaker: 'scout_alvarez', target: 'dr_morgan',
    lines: [
      '$target can crunch numbers all day. Numbers don\'t see a captain\'s eyes before kickoff.',
      'I watched the warm-up; $target watched a spreadsheet. We\'re not the same.',
      '$target\'s model missed the narrative again. Form is a feeling.',
    ],
  },
  {
    speaker: 'scout_alvarez', target: 'viktor_kane',
    lines: [
      '$target bets against everyone on instinct. At least my instinct has been on the pitch.',
      'Going contrarian again, $target? Even rebels need a reason.',
      '$target and I agree for once — that worries me more than the match.',
    ],
  },
  {
    speaker: 'scout_alvarez', target: 'sofia_mendes',
    lines: [
      '$target thinks money tells the story. I think the pitch does.',
      'Follow the odds, $target says. I follow the players.',
      '$target\'s value line shifted — maybe the bookies watch warm-ups too.',
    ],
  },
  {
    speaker: 'scout_alvarez', target: 'madame_pythia',
    lines: [
      '$target sees cosmic signs. I see body language. Same intuition, different channel.',
      'The stars and the scout agree today, $target. Make of that what you will.',
      '$target draws a tarot card; I draw from 30 years of scouting. Both valid? …Maybe.',
    ],
  },

  // Viktor Kane → others
  {
    speaker: 'viktor_kane', target: 'dr_morgan',
    lines: [
      'Everyone trusts $target\'s model. That\'s exactly why I don\'t.',
      '$target says 72% confidence. The market says 68%. I say under.',
      'If $target is this confident, there\'s value on the other side.',
    ],
  },
  {
    speaker: 'viktor_kane', target: 'scout_alvarez',
    lines: [
      '$target "felt" a win coming. The last three "feelings" were losses.',
      'Narrative-driven picks, $target? The narrative usually has a plot twist.',
      '$target saw determination in their eyes. I saw a team about to collapse.',
    ],
  },
  {
    speaker: 'viktor_kane', target: 'sofia_mendes',
    lines: [
      '$target follows the sharp money. I follow what the sharp money is wrong about.',
      'When $target and the market agree, I start looking at the draw.',
      'Market efficiency is a myth, $target. That\'s why I exist.',
    ],
  },
  {
    speaker: 'viktor_kane', target: 'madame_pythia',
    lines: [
      'At least $target has the honesty to call it mysticism. The rest pretend it\'s science.',
      '$target\'s numerology got that last one right. Broken clock? Or broken universe?',
      'Even $target\'s tarot cards disagree with the consensus. Respect.',
    ],
  },

  // Sofia Mendes → others
  {
    speaker: 'sofia_mendes', target: 'dr_morgan',
    lines: [
      '$target ignores the market. The market doesn\'t ignore $target.',
      'Your xG model is cute, $target. But the line just moved 15 cents against you.',
      '$target and I landed on the same side — the value must be real.',
    ],
  },
  {
    speaker: 'sofia_mendes', target: 'scout_alvarez',
    lines: [
      '$target bets with his heart. The bookmakers thank him every week.',
      'Eyes on the pitch, sure, $target. My eyes are on the odds board.',
      '$target called it before the line moved. Even I\'m impressed. Once.',
    ],
  },
  {
    speaker: 'sofia_mendes', target: 'viktor_kane',
    lines: [
      '$target goes against the grain for sport. I go where the expected value is.',
      'Contrarian for the sake of it, $target? Show me the edge.',
      '$target faded the public and won. Even I can respect that EV.',
    ],
  },
  {
    speaker: 'sofia_mendes', target: 'madame_pythia',
    lines: [
      '$target consults the stars while I consult the sharps. Different oracles.',
      'Planetary alignment? $target, the only alignment I trust is line value.',
      '$target\'s mysticism somehow overlaps with my value model. Suspicious.',
    ],
  },

  // Madame Pythia → others
  {
    speaker: 'madame_pythia', target: 'dr_morgan',
    lines: [
      '$target thinks numbers reveal truth. Numbers only reveal what you measure.',
      'The Wheel of Fortune spins regardless of your p-values, $target.',
      '$target\'s model sees the surface. The cards see what lies beneath.',
    ],
  },
  {
    speaker: 'madame_pythia', target: 'scout_alvarez',
    lines: [
      '$target reads body language. I read the language of the cosmos. We both see.',
      'Your gut and my cards agree today, $target. The universe nods.',
      '$target watches warm-ups; I watch the alignment of numbers. Same oracle, different altar.',
    ],
  },
  {
    speaker: 'madame_pythia', target: 'viktor_kane',
    lines: [
      '$target rebels against consensus. The Tower card approves.',
      'Going against the crowd, $target? The Fool\'s journey begins exactly this way.',
      '$target thinks he chooses to disagree. The cards chose for him long ago.',
    ],
  },
  {
    speaker: 'madame_pythia', target: 'sofia_mendes',
    lines: [
      '$target follows the money. Money flows where the stars direct it.',
      'Sharp money, $target? The sharpest edge is cosmic inevitability.',
      '$target\'s market efficiency theory meets my karmic balance theory. Both unproven. Both beautiful.',
    ],
  },
]

// ── Deterministic selection ─────────────────────────────────────────────

export interface ChatterResult {
  speaker: CoreAgentId
  target: CoreAgentId
  text: string
  /** The rendered line with $target replaced by the target's display name. */
  formatted: string
}

/**
 * Pick a deterministic chatter line for a given time-bucket seed.
 * The seed typically includes a minute-bucket so chatter rotates over time
 * but is stable within the same bucket.
 */
export function pickChatter(seed: string): ChatterResult {
  const h = hashString(seed)
  const template = CHATTER_LINES[h % CHATTER_LINES.length]
  const lineIdx = hashString(seed + ':line') % template.lines.length
  const rawLine = template.lines[lineIdx]
  const targetName = AGENT_NAMES[template.target]
  const formatted = rawLine.replace(/\$target/g, targetName)

  return {
    speaker: template.speaker,
    target: template.target,
    text: rawLine,
    formatted,
  }
}

/**
 * Pick chatter for the ambient loop. Uses UTC minute-bucket as the
 * time-varying seed component so the same minute always yields the same line,
 * but consecutive minutes rotate.
 */
export function pickAmbientChatter(now: Date = new Date()): ChatterResult {
  const day = dayKey(now)
  const minuteBucket = Math.floor(now.getTime() / 60000)
  return pickChatter(`chatter|${day}|${minuteBucket}`)
}

/**
 * Should the ambient loop fire a cross-reference this cycle?
 * Deterministic based on a tick counter — roughly every 3rd cycle.
 */
export function shouldChatter(tick: number): boolean {
  return tick % 3 === 0
}
