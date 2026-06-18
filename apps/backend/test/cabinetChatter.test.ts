/**
 * cabinetChatter.test | v1.0.0 | 2026-06-17
 * Purpose: Verify deterministic cross-agent chatter selection (T53).
 */

import { describe, expect, it } from 'vitest'
import {
  pickChatter,
  pickAmbientChatter,
  shouldChatter,
  CORE_AGENT_IDS,
  AGENT_NAMES,
  type ChatterResult,
} from '../src/agents/cabinetChatter'

describe('pickChatter', () => {
  it('returns a deterministic result for the same seed', () => {
    const a = pickChatter('test-seed-42')
    const b = pickChatter('test-seed-42')
    expect(a).toEqual(b)
  })

  it('different seeds may produce different results', () => {
    const results = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const r = pickChatter(`seed-${i}`)
      results.add(`${r.speaker}->${r.target}`)
    }
    // With 20 templates × 3 lines, 20 seeds should cover at least a few pairs
    expect(results.size).toBeGreaterThan(1)
  })

  it('speaker and target are always different agents', () => {
    for (let i = 0; i < 50; i++) {
      const r = pickChatter(`pair-check-${i}`)
      expect(r.speaker).not.toBe(r.target)
    }
  })

  it('speaker and target are both core agent IDs', () => {
    for (let i = 0; i < 50; i++) {
      const r = pickChatter(`id-check-${i}`)
      expect(CORE_AGENT_IDS).toContain(r.speaker)
      expect(CORE_AGENT_IDS).toContain(r.target)
    }
  })

  it('formatted text replaces $target with the target name', () => {
    for (let i = 0; i < 20; i++) {
      const r = pickChatter(`format-${i}`)
      const targetName = AGENT_NAMES[r.target]
      expect(r.formatted).not.toContain('$target')
      // The raw template should have had $target
      expect(r.text).toContain('$target')
    }
  })

  it('formatted text contains the target display name', () => {
    const r = pickChatter('name-check')
    const targetName = AGENT_NAMES[r.target]
    expect(r.formatted).toContain(targetName)
  })
})

describe('pickAmbientChatter', () => {
  it('is deterministic within the same UTC minute', () => {
    const t = new Date('2026-06-17T12:30:15Z')
    const a = pickAmbientChatter(t)
    const b = pickAmbientChatter(new Date('2026-06-17T12:30:45Z'))
    expect(a).toEqual(b)
  })

  it('rotates across different minutes', () => {
    const results: ChatterResult[] = []
    for (let m = 0; m < 30; m++) {
      results.push(pickAmbientChatter(new Date(`2026-06-17T12:${String(m).padStart(2, '0')}:00Z`)))
    }
    const unique = new Set(results.map((r) => `${r.speaker}|${r.target}|${r.text}`))
    expect(unique.size).toBeGreaterThan(1)
  })
})

describe('shouldChatter', () => {
  it('fires on every 3rd tick', () => {
    expect(shouldChatter(0)).toBe(true)
    expect(shouldChatter(1)).toBe(false)
    expect(shouldChatter(2)).toBe(false)
    expect(shouldChatter(3)).toBe(true)
    expect(shouldChatter(6)).toBe(true)
    expect(shouldChatter(9)).toBe(true)
  })
})
