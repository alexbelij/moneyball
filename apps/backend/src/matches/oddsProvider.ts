/**
 * oddsProvider | v1.1.0 | 2026-06-18
 * Purpose: Fetch real 1X2 bookmaker odds from api-football.com (v3).
 * Used by Sofia Mendes (expected_value methodology) to compare true probability
 * against real market pricing instead of synthetic noise.
 *
 * Supports two transports:
 *  1. Direct api-football.com (API_FOOTBALL_KEY)
 *  2. RapidAPI proxy (RAPIDAPI_KEY) — automatic fallback
 *
 * Rate-limiting: free tier = 100 req/day, 10 req/min.
 * Strategy: pre-fetch all WC2026 odds in one batch, cache in memory with TTL.
 */

const DIRECT_BASE = 'https://v3.football.api-sports.io'
const RAPID_BASE = 'https://api-football-v1.p.rapidapi.com/v3'
const CACHE_TTL_MS = 30 * 60_000 // 30 minutes

export interface MatchOdds {
  homeTeam: string
  awayTeam: string
  homeWin: number
  draw: number
  awayWin: number
  bookmaker: string
  updatedAt: string
}

interface CacheEntry {
  data: MatchOdds
  fetchedAt: number
}

function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function oddsKey(home: string, away: string): string {
  return `${normalizeTeam(home)}::${normalizeTeam(away)}`
}

interface ApiFixture {
  fixture: { id: number; date: string }
  league: { id: number }
  teams: { home: { name: string }; away: { name: string } }
}

interface ApiOddsResponse {
  response: Array<{
    fixture: { id: number }
    bookmakers: Array<{
      name: string
      bets: Array<{
        name: string
        values: Array<{ value: string; odd: string }>
      }>
    }>
  }>
}

export interface OddsProviderConfig {
  apiFootballKey?: string
  rapidApiKey?: string
}

export class OddsProvider {
  private readonly cache = new Map<string, CacheEntry>()
  private lastBatchFetch = 0
  private batchPromise: Promise<void> | null = null
  private readonly apiFootballKey: string
  private readonly rapidApiKey: string

  constructor(config: OddsProviderConfig | string) {
    if (typeof config === 'string') {
      // Backward compat: single apiKey string
      this.apiFootballKey = config
      this.rapidApiKey = ''
    } else {
      this.apiFootballKey = config.apiFootballKey ?? ''
      this.rapidApiKey = config.rapidApiKey ?? ''
    }
  }

  /** Determine transport: direct api-football or RapidAPI fallback. */
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
    throw new Error('[oddsProvider] No API key configured')
  }

  /**
   * Get odds for a match. Uses batch-cached data; triggers refresh if stale.
   * Returns null if odds are unavailable (match not found, API error, etc.).
   */
  async getOdds(homeTeam: string, awayTeam: string): Promise<MatchOdds | null> {
    const now = Date.now()
    if (now - this.lastBatchFetch > CACHE_TTL_MS) {
      await this.fetchBatch()
    }
    return this.cache.get(oddsKey(homeTeam, awayTeam))?.data ?? null
  }

  private async fetchBatch(): Promise<void> {
    if (this.batchPromise) return this.batchPromise
    this.batchPromise = this._doBatchFetch()
    try {
      await this.batchPromise
    } finally {
      this.batchPromise = null
    }
  }

  private async _doBatchFetch(): Promise<void> {
    try {
      const { base, headers } = this.transport

      // Step 1: get fixture list for WC2026
      const fixturesRes = await fetch(`${base}/fixtures?league=1&season=2026`, { headers })
      if (!fixturesRes.ok) {
        console.error(`[oddsProvider] fixtures fetch ${fixturesRes.status}`)
        return
      }
      const fixturesBody = (await fixturesRes.json()) as { response: ApiFixture[] }
      const fixtures = fixturesBody.response ?? []

      const fixtureTeams = new Map<number, { home: string; away: string }>()
      for (const f of fixtures) {
        fixtureTeams.set(f.fixture.id, {
          home: f.teams.home.name,
          away: f.teams.away.name,
        })
      }

      // Step 2: fetch odds
      const oddsRes = await fetch(`${base}/odds?league=1&season=2026`, { headers })
      if (!oddsRes.ok) {
        console.error(`[oddsProvider] odds fetch ${oddsRes.status}`)
        return
      }
      const oddsBody = (await oddsRes.json()) as ApiOddsResponse
      const now = Date.now()

      for (const item of oddsBody.response ?? []) {
        const teams = fixtureTeams.get(item.fixture.id)
        if (!teams) continue

        // Prefer Bet365, fallback to first bookmaker
        const bookmaker =
          item.bookmakers.find((b) => b.name === 'Bet365') ?? item.bookmakers[0]
        if (!bookmaker) continue

        const bet = bookmaker.bets.find(
          (b) => b.name === 'Match Winner' || b.name === '1X2' || b.name === 'Home/Draw/Away',
        )
        if (!bet) continue

        const homeOdd = bet.values.find((v) => v.value === 'Home')?.odd
        const drawOdd = bet.values.find((v) => v.value === 'Draw')?.odd
        const awayOdd = bet.values.find((v) => v.value === 'Away')?.odd

        if (!homeOdd || !drawOdd || !awayOdd) continue

        const odds: MatchOdds = {
          homeTeam: teams.home,
          awayTeam: teams.away,
          homeWin: parseFloat(homeOdd),
          draw: parseFloat(drawOdd),
          awayWin: parseFloat(awayOdd),
          bookmaker: bookmaker.name,
          updatedAt: new Date().toISOString(),
        }

        this.cache.set(oddsKey(teams.home, teams.away), { data: odds, fetchedAt: now })
      }

      this.lastBatchFetch = now
      console.log(`[oddsProvider] cached odds for ${this.cache.size} matches (${base})`)
    } catch (err) {
      console.error('[oddsProvider] batch fetch error:', err)
    }
  }
}
