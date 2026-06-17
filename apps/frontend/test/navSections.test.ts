/**
 * navSections.test.ts | v1.0.0 | 2026-06-17
 * Tests for T51: navSections — section definitions, hash parsing, lookup.
 */

import { describe, it, expect } from 'vitest'
import {
  NAV_SECTIONS,
  getSection,
  isSectionId,
  sectionToHash,
  hashToSection,
  type SectionId,
} from '@/lib/navSections'

describe('NAV_SECTIONS', () => {
  it('contains 6 ordered entries', () => {
    expect(NAV_SECTIONS).toHaveLength(6)
    expect(NAV_SECTIONS[0].id).toBe('about')
    expect(NAV_SECTIONS[5].id).toBe('connected')
  })

  it('all ids are unique', () => {
    const ids = NAV_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('connected is the only unavailable section', () => {
    const unavailable = NAV_SECTIONS.filter((s) => !s.available)
    expect(unavailable).toHaveLength(1)
    expect(unavailable[0].id).toBe('connected')
  })
})

describe('getSection', () => {
  it('returns section for valid id', () => {
    const s = getSection('about')
    expect(s).toBeDefined()
    expect(s!.title).toBe('About Moneyball')
  })

  it('returns undefined for unknown id', () => {
    expect(getSection('nope')).toBeUndefined()
  })

  it('returns undefined for null/undefined', () => {
    expect(getSection(null)).toBeUndefined()
    expect(getSection(undefined)).toBeUndefined()
  })
})

describe('isSectionId', () => {
  it('returns true for valid section ids', () => {
    expect(isSectionId('about')).toBe(true)
    expect(isSectionId('leaderboard')).toBe(true)
  })

  it('returns false for unknown strings', () => {
    expect(isSectionId('foo')).toBe(false)
    expect(isSectionId('')).toBe(false)
    expect(isSectionId(null)).toBe(false)
  })
})

describe('sectionToHash', () => {
  it('produces hash slug', () => {
    expect(sectionToHash('about')).toBe('#/about')
    expect(sectionToHash('how-it-works')).toBe('#/how-it-works')
  })
})

describe('hashToSection', () => {
  it('parses #/about -> about', () => {
    expect(hashToSection('#/about')).toBe('about')
  })

  it('parses #about (no slash) -> about', () => {
    expect(hashToSection('#about')).toBe('about')
  })

  it('handles trailing slashes', () => {
    expect(hashToSection('#/verify/')).toBe('verify')
  })

  it('is case-insensitive', () => {
    expect(hashToSection('#/About')).toBe('about')
  })

  it('returns null for unknown hash', () => {
    expect(hashToSection('#/foo')).toBeNull()
  })

  it('returns null for empty/null', () => {
    expect(hashToSection('')).toBeNull()
    expect(hashToSection(null)).toBeNull()
    expect(hashToSection(undefined)).toBeNull()
  })
})
