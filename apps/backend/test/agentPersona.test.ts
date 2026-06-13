/**
 * agentPersona.test | v1.0.0 | 2026-06-13
 * Purpose: Verify deterministic roast selection + thought-bubble access (T29).
 */

import { describe, expect, it } from 'vitest'
import {
  AgentPersonaService,
  hashString,
  dayKey,
  pickDeterministic,
  THOUGHT_STATES,
} from '../src/agents/agentPersonaService'

const svc = new AgentPersonaService()

describe('hash + pick helpers', () => {
  it('hashString is stable and unsigned', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).toBeGreaterThanOrEqual(0)
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })

  it('dayKey returns the UTC YYYY-MM-DD bucket', () => {
    expect(dayKey(new Date('2026-06-15T23:59:59Z'))).toBe('2026-06-15')
    expect(dayKey(new Date('2026-06-16T00:00:01Z'))).toBe('2026-06-16')
  })

  it('pickDeterministic returns null for empty and is stable', () => {
    expect(pickDeterministic([], 'seed')).toBeNull()
    const items = ['a', 'b', 'c', 'd']
    expect(pickDeterministic(items, 'seed')).toBe(pickDeterministic(items, 'seed'))
  })
})

describe('AgentPersonaService', () => {
  it('loads roastLines + all thought states for a known agent', () => {
    const p = svc.get('dr_morgan')!
    expect(p).not.toBeNull()
    expect(p.roastLines.length).toBeGreaterThan(0)
    for (const s of THOUGHT_STATES) {
      expect(Array.isArray(p.thoughtBubbles[s])).toBe(true)
      expect(p.thoughtBubbles[s].length).toBeGreaterThan(0)
    }
  })

  it('returns null persona/thoughts for unknown agents', () => {
    expect(svc.get('nobody')).toBeNull()
    expect(svc.thoughtsFor('nobody')).toBeNull()
    expect(svc.roastFor('nobody', 'sui:0xabc')).toBeNull()
  })

  it('roastFor is deterministic for the same user/agent/day', () => {
    const day = new Date('2026-06-15T10:00:00Z')
    const a = svc.roastFor('dr_morgan', 'sui:0xabc', day)
    const b = svc.roastFor('dr_morgan', 'sui:0xabc', day)
    expect(a).toBe(b)
    expect(svc.get('dr_morgan')!.roastLines).toContain(a!)
  })

  it('roast rotates across days (different day → may differ, still from the set)', () => {
    const d1 = new Date('2026-06-15T10:00:00Z')
    const d2 = new Date('2026-06-22T10:00:00Z')
    const r1 = svc.roastFor('dr_morgan', 'sui:0xabc', d1)!
    const r2 = svc.roastFor('dr_morgan', 'sui:0xabc', d2)!
    const set = svc.get('dr_morgan')!.roastLines
    expect(set).toContain(r1)
    expect(set).toContain(r2)
  })

  it('different users can get different roasts on the same day', () => {
    const day = new Date('2026-06-15T10:00:00Z')
    const results = new Set(
      ['sui:0xaaa', 'sui:0xbbb', 'guest:cccccccccc', 'sui:0xddd', 'guest:eeeeeeeeee'].map(
        (u) => svc.roastFor('dr_morgan', u, day),
      ),
    )
    // With 5 users and multiple lines, expect at least 2 distinct picks.
    expect(results.size).toBeGreaterThan(1)
  })
})
