/**
 * footballDataProvider | v0.1.0 | 2026-06-12
 * Purpose: MatchProvider adapter for football-data.org v4 (FIFA World Cup,
 * competition code WC). Free tier: 10 req/min — the worker polls every
 * MATCH_POLL_SECONDS (default 120s), far inside the limit.
 */

import type { Match, MatchProvider, MatchStage, MatchStatus } from './types'
import { outcomeFromScore } from './types'

const BASE = 'https://api.football-data.org/v4'

type FdMatch = {
  id: number
  utcDate: string
  status: string
  stage?: string
  homeTeam?: { name?: string; shortName?: string }
  awayTeam?: { name?: string; shortName?: string }
  score?: { fullTime?: { home?: number | null; away?: number | null } }
}

function mapStatus(s: string): MatchStatus {
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished'
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'live'
  return 'scheduled' // SCHEDULED | TIMED | POSTPONED | SUSPENDED | CANCELLED
}

function mapStage(s: string | undefined): MatchStage {
  if (!s) return 'group'
  return s.includes('GROUP') ? 'group' : 'knockout'
}

export class FootballDataProvider implements MatchProvider {
  readonly name = 'football-data.org'

  constructor(
    private readonly token: string,
    private readonly competition = 'WC',
  ) {}

  async fetchWindow(fromUtc: string, toUtc: string): Promise<readonly Match[]> {
    const dateFrom = fromUtc.slice(0, 10)
    const dateTo = toUtc.slice(0, 10)
    const url = `${BASE}/competitions/${this.competition}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`

    const res = await fetch(url, { headers: { 'X-Auth-Token': this.token } })
    if (!res.ok) {
      throw new Error(`football-data.org ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    const body = (await res.json()) as { matches?: FdMatch[] }

    const out: Match[] = []
    for (const m of body.matches ?? []) {
      const home = m.homeTeam?.shortName ?? m.homeTeam?.name
      const away = m.awayTeam?.shortName ?? m.awayTeam?.name
      if (!home || !away) continue // TBD pairings in future rounds

      const status = mapStatus(m.status)
      const ftHome = m.score?.fullTime?.home
      const ftAway = m.score?.fullTime?.away
      const hasScore = typeof ftHome === 'number' && typeof ftAway === 'number'

      out.push({
        id: `fd:${m.id}`,
        homeTeam: home,
        awayTeam: away,
        kickoffUtc: m.utcDate,
        stage: mapStage(m.stage),
        status,
        result:
          status === 'finished' && hasScore
            ? { homeScore: ftHome, awayScore: ftAway, outcome: outcomeFromScore(ftHome, ftAway) }
            : null,
      })
    }
    return out
  }
}
