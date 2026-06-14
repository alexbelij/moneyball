/**
 * seedFixture | v1.0.0 | 2026-06-15 | T57
 * Purpose: The single, deterministic source of truth for the demo read-model
 * baseline. Replayed at boot by seedReadModel() so a cold start (ephemeral
 * disk wiped on redeploy, MemWal recall is best-effort top-K only) always
 * rebuilds the judge-ready "Day 1 → Now" state WITHOUT a manual re-seed.
 *
 * Determinism rules that make the baseline reproducible byte-for-byte:
 *   - matchId is STABLE (`manual:seed-N`), not derived from an in-memory seq
 *     counter — so a re-run on a warm provider overwrites by predictionId
 *     instead of minting `manual:m9..` duplicates (the historical "double seed").
 *   - kickoffUtc is PINNED. Some methodologies (narrative_sentiment) salt their
 *     pick by matchday; a floating `now` kickoff would drift the baseline daily.
 *   - Evolutions carry a STABLE runId → AgentEventService dedups by runId, so
 *     re-seeding never appends a second copy.
 *
 * This fixture contains ONLY substantive events. The `noop` auto-sleep events
 * that the live sleep cycle emits (and that pollute the before/after panel) are
 * intentionally NOT seeded here — they only ever arrive from the live workers.
 */

export const SEED_AGENT_IDS = [
  'dr_morgan',
  'scout_alvarez',
  'viktor_kane',
  'sofia_mendes',
  'madame_pythia',
] as const

export interface SeedMatch {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffUtc: string
  stage: 'group' | 'knockout'
  homeScore: number
  awayScore: number
}

/** 8 World Cup group-stage matches — same teams/scores as scripts/seed-demo.ts. */
export const SEED_MATCHES: readonly SeedMatch[] = [
  { id: 'manual:seed-1', homeTeam: 'Brazil', awayTeam: 'Serbia', kickoffUtc: '2026-06-11T15:00:00.000Z', stage: 'group', homeScore: 2, awayScore: 0 },
  { id: 'manual:seed-2', homeTeam: 'Germany', awayTeam: 'Japan', kickoffUtc: '2026-06-11T18:00:00.000Z', stage: 'group', homeScore: 1, awayScore: 2 },
  { id: 'manual:seed-3', homeTeam: 'Argentina', awayTeam: 'Saudi Arabia', kickoffUtc: '2026-06-12T15:00:00.000Z', stage: 'group', homeScore: 1, awayScore: 2 },
  { id: 'manual:seed-4', homeTeam: 'Spain', awayTeam: 'Costa Rica', kickoffUtc: '2026-06-12T18:00:00.000Z', stage: 'group', homeScore: 7, awayScore: 0 },
  { id: 'manual:seed-5', homeTeam: 'France', awayTeam: 'Denmark', kickoffUtc: '2026-06-13T15:00:00.000Z', stage: 'group', homeScore: 2, awayScore: 1 },
  { id: 'manual:seed-6', homeTeam: 'England', awayTeam: 'USA', kickoffUtc: '2026-06-13T18:00:00.000Z', stage: 'group', homeScore: 0, awayScore: 0 },
  { id: 'manual:seed-7', homeTeam: 'Portugal', awayTeam: 'Ghana', kickoffUtc: '2026-06-14T15:00:00.000Z', stage: 'group', homeScore: 3, awayScore: 2 },
  { id: 'manual:seed-8', homeTeam: 'Netherlands', awayTeam: 'Senegal', kickoffUtc: '2026-06-14T18:00:00.000Z', stage: 'group', homeScore: 2, awayScore: 0 },
]

/** Stable resolution timestamps drive a sensible, deterministic sort order. */
export const SEED_RESOLVED_AT = (match: SeedMatch): string => {
  // 2h after kickoff — a finished group match.
  const t = Date.parse(match.kickoffUtc) + 2 * 3600_000
  return new Date(t).toISOString()
}

export interface SeedEvolution {
  agentId: string
  runId: string
  createdAt: string
  summary: string
  parameterDiff: Record<string, number>
  fromVersion: number
  toVersion: number
}

/**
 * Two substantive evolution waves → non-noop counts 2/2/2/1/1
 * (dr_morgan / scout_alvarez / viktor_kane = 2; sofia / pythia = 1).
 * Summaries/diffs mirror scripts/seed-demo.ts so the demo narrative is intact.
 */
export const SEED_EVOLUTIONS: readonly SeedEvolution[] = [
  // ── Wave 1 (Day 2-3) — all five agents ────────────────────────────────
  {
    agentId: 'dr_morgan', runId: 'seed:dr_morgan:w1', createdAt: '2026-06-12T22:00:00.000Z',
    summary: 'Day 2 recalibration: Japan upset exposed over-reliance on historical xG. Reduced confidence bias, increased weight on recent defensive form.',
    parameterDiff: { confidenceBias: -0.08, hedgingLevel: 0.05, recentFormWeight: 0.10 }, fromVersion: 0, toVersion: 1,
  },
  {
    agentId: 'scout_alvarez', runId: 'seed:scout_alvarez:w1', createdAt: '2026-06-12T22:05:00.000Z',
    summary: 'Day 3 gut check: three upsets in a row. My instinct was right on Japan but wrong on Argentina. Adjusting narrative weight down, trusting squad depth data more.',
    parameterDiff: { narrativeWeight: -0.12, squadDepthWeight: 0.08, confidenceBias: -0.05 }, fromVersion: 0, toVersion: 1,
  },
  {
    agentId: 'viktor_kane', runId: 'seed:viktor_kane:w1', createdAt: '2026-06-12T22:10:00.000Z',
    summary: 'Day 2 contrarian review: fading every favourite worked once (Japan), failed once (Spain 7-0). Need to distinguish genuine contrarian value from blind fading.',
    parameterDiff: { contrarianism: -0.10, hedgingLevel: 0.07, publicSentimentWeight: 0.05 }, fromVersion: 0, toVersion: 1,
  },
  {
    agentId: 'sofia_mendes', runId: 'seed:sofia_mendes:w1', createdAt: '2026-06-12T22:15:00.000Z',
    summary: 'Day 3 market update: early tournament lines are wild, my edge was strongest where I trusted small-market signals. Increasing confidence on lines that move without news.',
    parameterDiff: { marketEfficiency: 0.06, confidenceBias: 0.03, lineMovementWeight: 0.12 }, fromVersion: 0, toVersion: 1,
  },
  {
    agentId: 'madame_pythia', runId: 'seed:madame_pythia:w1', createdAt: '2026-06-12T22:20:00.000Z',
    summary: 'Day 2 cosmic recalibration: the stars were clear on Japan (numerology hit) but Saturn interfered with the Argentina reading. Adjusting planetary weight modifiers.',
    parameterDiff: { mysticismIntensity: -0.05, planetaryAlignment: 0.08, numerologyBias: -0.03 }, fromVersion: 0, toVersion: 1,
  },
  // ── Wave 2 (Day 4-5) — dr_morgan / scout_alvarez / viktor_kane ─────────
  {
    agentId: 'dr_morgan', runId: 'seed:dr_morgan:w2', createdAt: '2026-06-14T22:00:00.000Z',
    summary: 'Day 5 deep review: Brier score improved 12% after Day 2 recalibration. Defensive injury data proving reliable. Narrowing confidence bands on knockout-stage picks.',
    parameterDiff: { confidenceBias: 0.03, topicCalibration: 0.06, hedgingLevel: -0.03 }, fromVersion: 1, toVersion: 2,
  },
  {
    agentId: 'scout_alvarez', runId: 'seed:scout_alvarez:w2', createdAt: '2026-06-14T22:05:00.000Z',
    summary: 'Day 5 trust shift: two more upsets confirmed — squad depth is the real signal this tournament. Narrative weight fully recalibrated. Feeling sharper.',
    parameterDiff: { narrativeWeight: -0.05, squadDepthWeight: 0.06, confidenceBias: 0.04 }, fromVersion: 1, toVersion: 2,
  },
  {
    agentId: 'viktor_kane', runId: 'seed:viktor_kane:w2', createdAt: '2026-06-14T22:10:00.000Z',
    summary: 'Day 4 edge sharpening: selective contrarianism is working. When public sentiment exceeds 75%, fading still profitable. Below that, I agree with the crowd now.',
    parameterDiff: { contrarianism: 0.04, publicSentimentThreshold: 0.10, hedgingLevel: -0.04 }, fromVersion: 1, toVersion: 2,
  },
]
