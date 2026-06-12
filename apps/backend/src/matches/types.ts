/**
 * matches/types | v0.1.0 | 2026-06-12
 * Purpose: Domain types + provider port for the WC2026 match pipeline.
 */

export type MatchStatus = 'scheduled' | 'live' | 'finished'

/** 1X2 pick code: home win / draw / away win. */
export type PickCode = '1' | 'X' | '2'

export type MatchStage = 'group' | 'knockout'

export interface Match {
  /** Provider-scoped stable id, prefixed: `fd:498765` or `manual:m1`. */
  id: string
  homeTeam: string
  awayTeam: string
  kickoffUtc: string
  stage: MatchStage
  status: MatchStatus
  /** Present when status === 'finished'. */
  result: { homeScore: number; awayScore: number; outcome: PickCode } | null
}

/**
 * Port over a fixtures/results source. Implementations:
 *  - FootballDataProvider (football-data.org v4, free tier, competition WC)
 *  - ManualMatchProvider  (admin-fed; fallback + demo "simulate day" mode)
 */
export interface MatchProvider {
  readonly name: string
  /** All matches in [fromUtc, toUtc] with current status/result. */
  fetchWindow(fromUtc: string, toUtc: string): Promise<readonly Match[]>
}

export function outcomeFromScore(homeScore: number, awayScore: number): PickCode {
  if (homeScore > awayScore) return '1'
  if (homeScore < awayScore) return '2'
  return 'X'
}
