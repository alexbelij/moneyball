/**
 * manualProvider | v0.1.0 | 2026-06-12
 * Purpose: Admin-fed MatchProvider. Fallback when no API token is configured
 * and the engine behind demo/"simulate day" flows: create a match, resolve it
 * with a score — the rest of the pipeline (predict → resolve → sleep) is
 * identical to the live path.
 */

import type { Match, MatchProvider, MatchStage } from './types'
import { outcomeFromScore } from './types'

export class ManualMatchProvider implements MatchProvider {
  readonly name = 'manual'
  private readonly matches = new Map<string, Match>()
  private seq = 0

  async fetchWindow(fromUtc: string, toUtc: string): Promise<readonly Match[]> {
    return [...this.matches.values()].filter(
      (m) => m.kickoffUtc >= fromUtc && m.kickoffUtc <= toUtc,
    )
  }

  create(input: {
    homeTeam: string
    awayTeam: string
    kickoffUtc?: string
    stage?: MatchStage
  }): Match {
    const id = `manual:m${++this.seq}`
    const match: Match = {
      id,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      kickoffUtc: input.kickoffUtc ?? new Date().toISOString(),
      stage: input.stage ?? 'group',
      status: 'scheduled',
      result: null,
    }
    this.matches.set(id, match)
    return match
  }

  resolve(id: string, homeScore: number, awayScore: number): Match | null {
    const match = this.matches.get(id)
    if (!match) return null
    const finished: Match = {
      ...match,
      status: 'finished',
      result: { homeScore, awayScore, outcome: outcomeFromScore(homeScore, awayScore) },
    }
    this.matches.set(id, finished)
    return finished
  }

  get(id: string): Match | null {
    return this.matches.get(id) ?? null
  }
}
