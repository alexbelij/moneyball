/**
 * mysticism.test | v0.1.0 | 2026-06-12
 * Unit tests for Madame Pythia's books: numerology reduction, name numbers,
 * life path, zodiac boundaries (incl. year wrap), day rulers, determinism
 * and confidence bounds of the verdict.
 */

import { describe, expect, it } from 'vitest'
import {
  dayRuler,
  divine,
  elementAffinity,
  lifePath,
  nameNumber,
  reduceNumber,
  zodiacOf,
} from '../src/matches/mysticism/mysticismEngine'

describe('numerology', () => {
  it('reduces by digit sum to 1..9', () => {
    expect(reduceNumber(32)).toBe(5)
    expect(reduceNumber(48)).toBe(3) // 48 → 12 → 3
    expect(reduceNumber(9)).toBe(9)
  })

  it('preserves master numbers 11 and 22', () => {
    expect(reduceNumber(11)).toBe(11)
    expect(reduceNumber(22)).toBe(22)
    expect(reduceNumber(29)).toBe(11) // 29 → 11 (master, stop)
  })

  it('never returns 0', () => {
    expect(reduceNumber(0)).toBe(9)
  })

  it('computes Pythagorean name numbers (Brazil = 5)', () => {
    // b2 r9 a1 z8 i9 l3 = 32 → 5
    expect(nameNumber('Brazil')).toBe(5)
    expect(nameNumber('brazil')).toBe(5) // case-insensitive
    expect(nameNumber('B-r a z i l!')).toBe(5) // non-letters ignored
  })

  it('computes life path with master preservation', () => {
    expect(lifePath('2026-06-15T18:00:00Z')).toBe(22) // 2+0+2+6+0+6+1+5 = 22
    expect(lifePath('2026-06-14T18:00:00Z')).toBe(3) // 21 → 3
  })
})

describe('astrology', () => {
  it('maps dates to zodiac signs incl. boundaries', () => {
    expect(zodiacOf('2026-06-20').sign).toBe('Gemini')
    expect(zodiacOf('2026-06-21').sign).toBe('Cancer')
  })

  it('handles the Capricorn year wrap', () => {
    expect(zodiacOf('2026-12-25').sign).toBe('Capricorn')
    expect(zodiacOf('2026-01-05').sign).toBe('Capricorn')
  })

  it('maps UTC weekday to planetary ruler', () => {
    expect(dayRuler('2026-06-14')).toBe('Sun') // Sunday
    expect(dayRuler('2026-06-15')).toBe('Moon') // Monday
    expect(dayRuler('2026-06-20')).toBe('Saturn') // Saturday
  })

  it('element affinity is symmetric-by-table and bounded', () => {
    expect(elementAffinity('fire', 'air')).toBe(0.75)
    expect(elementAffinity('fire', 'water')).toBe(0)
    expect(elementAffinity('earth', 'earth')).toBe(1)
  })
})

describe('divine()', () => {
  const kickoff = '2026-06-16T18:00:00Z'

  it('is deterministic', () => {
    const a = divine('Brazil', 'Germany', kickoff)
    const b = divine('Brazil', 'Germany', kickoff)
    expect(a).toEqual(b)
  })

  it('respects confidence bounds [0.5, 0.97]', () => {
    const teams = ['Brazil', 'Germany', 'Spain', 'France', 'Japan', 'USA', 'Mexico', 'Croatia']
    for (let d = 11; d < 30; d++) {
      const date = `2026-06-${String(d).padStart(2, '0')}T18:00:00Z`
      for (const h of teams) {
        for (const a of teams) {
          if (h === a) continue
          const v = divine(h, a, date)
          expect(v.rawConfidence).toBeGreaterThanOrEqual(0.5)
          expect(v.rawConfidence).toBeLessThanOrEqual(0.97)
          expect(['1', 'X', '2']).toContain(v.pick)
        }
      }
    }
  })

  it('screams on master life-path days', () => {
    const v = divine('Brazil', 'Germany', '2026-06-15T18:00:00Z') // life path 22
    expect(v.rawConfidence).toBeGreaterThanOrEqual(0.93)
    expect(v.reasoning).toContain('MASTER')
  })

  it('produces all three outcomes across the fixture space', () => {
    const teams = ['Brazil', 'Germany', 'Spain', 'France', 'Japan', 'USA', 'Mexico', 'Croatia', 'England', 'Italy']
    const picks = new Set<string>()
    for (let d = 11; d < 30; d++) {
      const date = `2026-06-${String(d).padStart(2, '0')}T18:00:00Z`
      for (const h of teams) for (const a of teams) if (h !== a) picks.add(divine(h, a, date).pick)
    }
    expect(picks).toEqual(new Set(['1', 'X', '2']))
  })

  it('cites both books in the reasoning', () => {
    const v = divine('Brazil', 'Germany', kickoff)
    expect(v.reasoning).toMatch(/vibrates at \d+/)
    expect(v.reasoning).toMatch(/falls under \w+/)
    expect(v.reasoning).toMatch(/life path \d+/)
  })
})
