/**
 * formProvider | v1.1.0 | 2026-06-18
 * Purpose: Fetch recent team form (last 5 results) from api-football.com.
 * Used by Scout Alvarez (narrative_sentiment) to replace the synthetic hash
 * with a real "gut feel" derived from momentum.
 *
 * Supports two transports:
 *  1. Direct api-football.com (apiFootballKey)
 *  2. RapidAPI proxy (rapidApiKey) — automatic fallback
 *
 * Rate-limiting: shares the api-football.com quota (100 req/day free tier).
 * Strategy: cache per-team form with 60-minute TTL.
 */

const DIRECT_BASE = 'https://v3.football.api-sports.io'
const RAPID_BASE = 'https://api-football-v1.p.rapidapi.com/v3'
const CACHE_TTL_MS = 60 * 60_000 // 60 minutes

export interface TeamForm {
  team: string
  /** Last 5 match results, most recent first */
  last5: ('W' | 'D' | 'L')[]
  /** 0.0–1.0 composite: W=1, D=0.5, L=0, averaged */
  formScore: number
}

interface CacheEntry {
  data: TeamForm
  fetchedAt: number
}

interface ApiTeam {
  team: { id: number; name: string }
}

interface ApiFixture {
  fixture: { id: number; date: string }
  teams: {
    home: { id: number; name: string; winner: boolean | null }
    away: { id: number; name: string; winner: boolean | null }
  }
}

function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}

export interface FormProviderConfig {
  apiFootballKey?: string
  rapidApiKey?: string
}

export class FormProvider {
  private readonly teamCache = new Map<string, CacheEntry>()
  private teamIds = new Map<string, number>()
  private teamIdsLoaded = false
  private readonly apiFootballKey: string
  private readonly rapidApiKey: string

  constructor(config: FormProviderConfig | string) {
    if (typeof config === 'string') {
      this.apiFootballKey = config
      this.rapidApiKey = ''
    } else {
      this.apiFootballKey = config.apiFootballKey ?? ''
      this.rapidApiKey = config.rapidApiKey ?? ''
    }
  }

  private get transport(): { base: string; headers: Record<string, string> } {
    if (this.apiFootballKey) {
      return {
        base: DIRECT_BASE,
        headers: { 'x-apisports-key': this.apiFootballKey },
      }
    }
    if (this.rapidApiKey) {
      return {
        base: RAPID_BASE,
        headers: {
          'x-rapidapi-key': this.rapidApiKey,
          'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
        },
      }
    }
    throw new Error('[formProvider] No API key configured')
  }

  async getForm(teamName: string): Promise<TeamForm | null> {
    const key = normalizeTeam(teamName)
    const now = Date.now()

    const cached = this.teamCache.get(key)
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data

    try {
      if (!this.teamIdsLoaded) await this.loadTeamIds()
      const teamId = this.teamIds.get(key)
      if (!teamId) return null

      const { base, headers } = this.transport
      const res = await fetch(`${base}/fixtures?team=${teamId}&last=5`, { headers })
      if (!res.ok) return null

      const body = (await res.json()) as { response: ApiFixture[] }
      const fixtures = body.response ?? []

      const results: ('W' | 'D' | 'L')[] = []
      for (const f of fixtures) {
        const isHome = f.teams.home.id === teamId
        const winner = isHome ? f.teams.home.winner : f.teams.away.winner
        if (winner === true) results.push('W')
        else if (winner === false) results.push('L')
        else results.push('D')
      }

      const formScore =
        results.length > 0
          ? results.reduce((sum, r) => sum + (r === 'W' ? 1 : r === 'D' ? 0.5 : 0), 0) / results.length
          : 0.5

      const form: TeamForm = { team: teamName, last5: results, formScore }
      this.teamCache.set(key, { data: form, fetchedAt: now })
      return form
    } catch (err) {
      console.error(`[formProvider] error fetching form for ${teamName}:`, err)
      return null
    }
  }

  private async loadTeamIds(): Promise<void> {
    try {
      const { base, headers } = this.transport
      const res = await fetch(`${base}/teams?league=1&season=2026`, { headers })
      if (!res.ok) return

      const body = (await res.json()) as { response: ApiTeam[] }
      for (const t of body.response ?? []) {
        this.teamIds.set(normalizeTeam(t.team.name), t.team.id)
      }
      this.teamIdsLoaded = true
      console.log(`[formProvider] loaded ${this.teamIds.size} team IDs (${base})`)
    } catch (err) {
      console.error('[formProvider] loadTeamIds error:', err)
    }
  }
}
