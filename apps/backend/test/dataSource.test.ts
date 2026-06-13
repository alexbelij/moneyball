/**
 * dataSource.test | v1.0.0 | 2026-06-13
 * Purpose: Lock the honesty invariants of the model-input provenance (T30).
 */

import { describe, expect, it } from 'vitest'
import {
  MODEL_INPUTS,
  MODEL_INPUTS_VERSION,
  getDataSourceSummary,
} from '../src/matches/dataSource'

describe('model input provenance', () => {
  it('declares team strength and odds as synthetic (not live)', () => {
    const byKey = Object.fromEntries(MODEL_INPUTS.map((i) => [i.key, i]))
    expect(byKey.teamStrength.source).toBe('synthetic')
    expect(byKey.syntheticOdds.source).toBe('synthetic')
  })

  it('claims NOTHING is live until a real feed is actually wired', () => {
    // If you connect a live feed, update this descriptor AND this test on purpose.
    expect(MODEL_INPUTS.some((i) => i.source === 'live')).toBe(false)
  })

  it('every input has a non-empty honest detail and a known source', () => {
    for (const i of MODEL_INPUTS) {
      expect(i.detail.trim().length).toBeGreaterThan(0)
      expect(['synthetic', 'manual', 'live']).toContain(i.source)
    }
  })

  it('summary is versioned and carries the synthetic headline', () => {
    const s = getDataSourceSummary()
    expect(s.version).toBe(MODEL_INPUTS_VERSION)
    expect(s.headline.toLowerCase()).toContain('synthetic')
    expect(s.inputs.length).toBe(MODEL_INPUTS.length)
  })
})
