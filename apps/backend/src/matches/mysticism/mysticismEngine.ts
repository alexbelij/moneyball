/**
 * mysticismEngine | v0.1.0 | 2026-06-12
 * Purpose: Madame Pythia's "books" — Pythagorean numerology + classical
 * astrology, loaded from versioned JSON data files and applied as pure
 * deterministic rules. No RNG, no LLM: same match ⇒ same omen, forever.
 *
 * Method (each step cites a book entry in the reasoning):
 *   1. Team name → Pythagorean name number (masters 11/22 preserved).
 *   2. Kickoff date → life-path number + zodiac sign + planetary day ruler.
 *   3. Score each side: element affinity (name element vs zodiac element)
 *      + planetary friendship (name planet vs day ruler) + master bonus.
 *   4. Life path resonance: a side whose number equals the day's life path
 *      is favored; life path 2/11 (balance numbers) pull toward the draw.
 *   5. Margin → 1/X/2; confidence from |margin|, capped; master-number days
 *      make the spirits scream.
 */

import numerologyBook from './numerology.v1.json'
import astrologyBook from './astrology.v1.json'

export type Element = 'fire' | 'air' | 'earth' | 'water'

interface NumberEntry {
  planet: string
  element: string
  keyword: string
  omen: string
}

// ── Numerology ───────────────────────────────────────────────────────────────

/** Reduce by digit sum to 1..9, preserving master numbers 11 and 22. */
export function reduceNumber(n: number): number {
  const masters = new Set(numerologyBook.masterNumbers)
  let v = Math.abs(Math.trunc(n))
  while (v > 9 && !masters.has(v)) {
    v = String(v).split('').reduce((s, d) => s + Number(d), 0)
  }
  return v === 0 ? 9 : v
}

/** Pythagorean name number of a team. Non-letters are ignored. */
export function nameNumber(name: string): number {
  const values = numerologyBook.letterValues as Record<string, number>
  const sum = name
    .toLowerCase()
    .split('')
    .reduce((s, ch) => s + (values[ch] ?? 0), 0)
  return reduceNumber(sum)
}

/** Life-path number of an ISO date (UTC date part). */
export function lifePath(isoDate: string): number {
  const digits = isoDate.slice(0, 10).replace(/\D/g, '')
  return reduceNumber(digits.split('').reduce((s, d) => s + Number(d), 0))
}

export function numberEntry(n: number): NumberEntry {
  const book = numerologyBook.numbers as Record<string, NumberEntry>
  return book[String(n)] ?? book['9']
}

// ── Astrology ────────────────────────────────────────────────────────────────

export interface ZodiacEntry {
  sign: string
  element: string
  ruler: string
}

export function zodiacOf(isoDate: string): ZodiacEntry {
  const mmdd = isoDate.slice(5, 10)
  for (const z of astrologyBook.zodiac) {
    if (z.from <= z.to) {
      if (mmdd >= z.from && mmdd <= z.to) return z
    } else if (mmdd >= z.from || mmdd <= z.to) {
      return z // Capricorn wraps the year boundary
    }
  }
  return astrologyBook.zodiac[0]
}

/** Planetary ruler of the UTC weekday (chaldean order). */
export function dayRuler(isoDate: string): string {
  const dow = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).getUTCDay()
  return astrologyBook.dayRulers[dow] ?? 'Sun'
}

export function elementAffinity(a: string, b: string): number {
  const table = astrologyBook.elementAffinity as Record<string, Record<string, number>>
  return table[a]?.[b] ?? 0.25
}

function planetFriendship(a: string, b: string): number {
  if (a === b) return 1
  const pairs = numerologyBook.planetFriendships as string[][]
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) ? 0.5 : 0
}

// ── Verdict ──────────────────────────────────────────────────────────────────

export interface MysticVerdict {
  pick: '1' | 'X' | '2'
  rawConfidence: number
  reasoning: string
  /** Exposed for tests and the Memory tab. */
  detail: {
    homeNumber: number
    awayNumber: number
    lifePath: number
    sign: string
    ruler: string
    homeScore: number
    awayScore: number
  }
}

const W_ELEMENT = 0.5
const W_PLANET = 0.3
const MASTER_BONUS = 0.15
const LIFE_PATH_BONUS = 0.2
const DRAW_BAND = 0.12

export function divine(
  homeTeam: string,
  awayTeam: string,
  kickoffUtc: string,
  params: Record<string, number> = {},
): MysticVerdict {
  const masters = new Set(numerologyBook.masterNumbers)
  const hN = nameNumber(homeTeam)
  const aN = nameNumber(awayTeam)
  const lp = lifePath(kickoffUtc)
  const zodiac = zodiacOf(kickoffUtc)
  const ruler = dayRuler(kickoffUtc)
  const hE = numberEntry(hN)
  const aE = numberEntry(aN)

  const sideScore = (n: number, e: NumberEntry): number =>
    W_ELEMENT * elementAffinity(e.element, zodiac.element) +
    W_PLANET * planetFriendship(e.planet, ruler) +
    (masters.has(n) ? MASTER_BONUS : 0) +
    (n === lp ? LIFE_PATH_BONUS : 0)

  const homeScore = sideScore(hN, hE)
  const awayScore = sideScore(aN, aE)
  // Balance numbers pull the omen toward equilibrium.
  const drawPull = lp === 2 || lp === 11 ? 0.1 : 0
  const margin = homeScore - awayScore
  const band = (params.draw_band ?? DRAW_BAND) + drawPull

  const pick: MysticVerdict['pick'] = margin > band ? '1' : margin < -band ? '2' : 'X'
  const scream = masters.has(lp)
  const base = 0.52 + Math.min(Math.abs(margin) * 0.6, 0.3)
  const rawConfidence = scream
    ? Math.min(params.scream_confidence ?? 0.93, 0.97)
    : Math.min(Math.max(base, 0.5), 0.85)

  const verdictText =
    pick === '1' ? `${homeTeam} prevails` : pick === '2' ? `${awayTeam} prevails` : 'the scales refuse to tip'

  const reasoning =
    `${homeTeam} vibrates at ${hN} — ${hE.keyword} (${hE.planet}, ${hE.element}): ${hE.omen}. ` +
    `${awayTeam} carries ${aN} — ${aE.keyword} (${aE.planet}, ${aE.element}). ` +
    `The match falls under ${zodiac.sign} (${zodiac.element}) on ${ruler}'s day, life path ${lp}` +
    (scream ? ' — a MASTER number, the spirits are deafening' : '') +
    (drawPull > 0 ? ' — a number of balance' : '') +
    `. The omens weigh ${homeScore.toFixed(2)} against ${awayScore.toFixed(2)}: ${verdictText}.`

  return {
    pick,
    rawConfidence,
    reasoning,
    detail: { homeNumber: hN, awayNumber: aN, lifePath: lp, sign: zodiac.sign, ruler, homeScore, awayScore },
  }
}
