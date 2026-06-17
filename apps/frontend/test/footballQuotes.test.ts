/**
 * footballQuotes.test.ts | v1.0.0 | 2026-06-14
 * Tests for T50 deterministic football-quote pool + picker.
 */

import { describe, it, expect } from 'vitest'
import {
  FOOTBALL_QUOTES,
  pickFootballQuote,
  quoteOfTheDay,
} from '@/lib/footballQuotes'

describe('FOOTBALL_QUOTES pool', () => {
  it('has 30–50 quotes (spec range)', () => {
    expect(FOOTBALL_QUOTES.length).toBeGreaterThanOrEqual(30)
    expect(FOOTBALL_QUOTES.length).toBeLessThanOrEqual(50)
  })

  it('every entry has non-empty text and author', () => {
    for (const q of FOOTBALL_QUOTES) {
      expect(q.text.trim().length).toBeGreaterThan(0)
      expect(q.author.trim().length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate quote texts', () => {
    const texts = FOOTBALL_QUOTES.map((q) => q.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('is English-only (no Cyrillic characters)', () => {
    const cyrillic = /[\u0400-\u04FF]/
    for (const q of FOOTBALL_QUOTES) {
      expect(cyrillic.test(q.text)).toBe(false)
      expect(cyrillic.test(q.author)).toBe(false)
    }
  })
})

describe('pickFootballQuote', () => {
  it('is deterministic: same seed -> same quote', () => {
    expect(pickFootballQuote(7)).toEqual(pickFootballQuote(7))
    expect(pickFootballQuote(0)).toEqual(FOOTBALL_QUOTES[0])
  })

  it('wraps with modulo over the pool length', () => {
    const n = FOOTBALL_QUOTES.length
    expect(pickFootballQuote(n)).toEqual(FOOTBALL_QUOTES[0])
    expect(pickFootballQuote(n + 3)).toEqual(FOOTBALL_QUOTES[3])
  })

  it('handles negative and fractional seeds without throwing', () => {
    expect(() => pickFootballQuote(-5)).not.toThrow()
    expect(() => pickFootballQuote(2.9)).not.toThrow()
    expect(pickFootballQuote(-5)).toEqual(FOOTBALL_QUOTES[5 % FOOTBALL_QUOTES.length])
    expect(pickFootballQuote(2.9)).toEqual(FOOTBALL_QUOTES[2])
  })

  it('always returns a valid pool member', () => {
    for (let s = 0; s < 200; s++) {
      expect(FOOTBALL_QUOTES).toContain(pickFootballQuote(s))
    }
  })
})

describe('quoteOfTheDay', () => {
  it('is stable within the same UTC day', () => {
    const a = quoteOfTheDay(new Date('2026-06-14T01:00:00Z'))
    const b = quoteOfTheDay(new Date('2026-06-14T23:00:00Z'))
    expect(a).toEqual(b)
  })

  it('returns a pool member', () => {
    expect(FOOTBALL_QUOTES).toContain(quoteOfTheDay(new Date('2026-06-24T12:00:00Z')))
  })
})
