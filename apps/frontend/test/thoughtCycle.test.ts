/**
 * thoughtCycle.test.ts | v1.0.0 | 2026-06-13
 * Tests for T29 pure room thought-cycle logic.
 */

import { describe, it, expect } from 'vitest'
import {
  mapStatusToThoughtState,
  pickLine,
  thoughtForCycle,
  hashString,
} from '@/lib/thoughtCycle'

describe('mapStatusToThoughtState', () => {
  it('maps known statuses', () => {
    expect(mapStatusToThoughtState('thinking')).toBe('analyzing')
    expect(mapStatusToThoughtState('acting')).toBe('arguing')
    expect(mapStatusToThoughtState('busy')).toBe('busy')
    expect(mapStatusToThoughtState('idle')).toBe('watching')
  })
  it('falls back to coffee for unknown statuses', () => {
    expect(mapStatusToThoughtState('napping')).toBe('coffee')
  })
})

describe('hashString / pickLine', () => {
  it('hash is stable', () => {
    expect(hashString('x|y|1')).toBe(hashString('x|y|1'))
  })
  it('pickLine returns null for empty and is in-range + stable', () => {
    expect(pickLine([], 's')).toBeNull()
    const lines = ['a', 'b', 'c']
    const r = pickLine(lines, 's')
    expect(lines).toContain(r)
    expect(pickLine(lines, 's')).toBe(r)
  })
})

describe('thoughtForCycle', () => {
  const bubbles = {
    analyzing: ['calc xG', 'load data', 'cross-ref'],
    watching: ['observe'],
  }
  it('picks from the matching state list', () => {
    const r = thoughtForCycle('dr_morgan', 'analyzing', bubbles, 0)
    expect(bubbles.analyzing).toContain(r)
  })
  it('is deterministic per (agent, state, tick)', () => {
    expect(thoughtForCycle('dr_morgan', 'analyzing', bubbles, 3))
      .toBe(thoughtForCycle('dr_morgan', 'analyzing', bubbles, 3))
  })
  it('advances across ticks (cycles the list)', () => {
    const seen = new Set(
      [0, 1, 2, 3, 4, 5].map((t) => thoughtForCycle('dr_morgan', 'analyzing', bubbles, t)),
    )
    expect(seen.size).toBeGreaterThan(1)
  })
  it('returns null when the state has no lines', () => {
    expect(thoughtForCycle('dr_morgan', 'busy', bubbles, 0)).toBeNull()
    expect(thoughtForCycle('dr_morgan', 'analyzing', null, 0)).toBeNull()
  })
})
