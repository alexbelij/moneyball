/**
 * fifaRankings | v1.0.0 | 2026-06-15
 * FIFA World Rankings for the 48 teams qualified for the 2026 World Cup.
 * Source: FIFA Men's World Ranking (June 2025 edition).
 *
 * The map stores each team's FIFA ranking position.
 * `rankingToStrength` converts that position into [0.30, 0.70] linearly:
 *   rank 1 → 0.70, rank 48 → 0.30.
 */

/** FIFA ranking position for each WC 2026 qualifier. */
export const FIFA_RANKINGS: ReadonlyMap<string, number> = new Map([
  ['Argentina', 1],
  ['France', 2],
  ['Spain', 3],
  ['England', 4],
  ['Brazil', 5],
  ['Belgium', 6],
  ['Netherlands', 7],
  ['Portugal', 8],
  ['Colombia', 9],
  ['Italy', 10],
  ['Germany', 11],
  ['Uruguay', 12],
  ['Croatia', 13],
  ['USA', 14],
  ['Mexico', 15],
  ['Morocco', 16],
  ['Japan', 17],
  ['Switzerland', 18],
  ['Iran', 19],
  ['South Korea', 20],
  ['Australia', 21],
  ['Denmark', 22],
  ['Serbia', 23],
  ['Turkey', 24],
  ['Austria', 25],
  ['Canada', 26],
  ['Ukraine', 27],
  ['Hungary', 28],
  ['Sweden', 29],
  ['Wales', 30],
  ['Ecuador', 31],
  ['Peru', 32],
  ['Saudi Arabia', 33],
  ['Egypt', 34],
  ['Tunisia', 35],
  ['Senegal', 36],
  ['Cameroon', 37],
  ['Nigeria', 38],
  ['Qatar', 39],
  ['Costa Rica', 40],
  ['Jamaica', 41],
  ['Panama', 42],
  ['New Zealand', 43],
  ['China', 44],
  ['India', 45],
  ['Indonesia', 46],
  ['Bahrain', 47],
  ['Trinidad and Tobago', 48],
])

const BEST_RANK = 1
const WORST_RANK = 48
const STRENGTH_MAX = 0.70
const STRENGTH_MIN = 0.30

/**
 * Convert a FIFA ranking position to a strength value in [0.30, 0.70].
 * Rank 1 → 0.70, rank 48 → 0.30, linear interpolation in between.
 */
export function rankingToStrength(rank: number): number {
  return STRENGTH_MAX - ((rank - BEST_RANK) / (WORST_RANK - BEST_RANK)) * (STRENGTH_MAX - STRENGTH_MIN)
}
