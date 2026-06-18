/**
 * dataSource.test | v2.0.0 | 2026-06-18
 * Purpose: Lock the honesty invariants of the model-input provenance (T30, T78).
 * T78: MODEL_INPUTS is now dynamic (buildModelInputs), accessed via getDataSourceSummary().
 */

import { describe, expect, it } from 'vitest'
import {
  MODEL_INPUTS_VERSION,
  getDataSourceSummary,
} from '../src/matches/dataSource'

describe('model input provenance', () => {
  it('summary includes team strength input with FIFA ranking', () => {
    const s = getDataSourceSummary()
    const byKey = Object.fromEntries(s.inputs.map((i) => [i.key, i]))
    expect(byKey.teamStrength).toBeDefined()
    expect(byKey.teamStrength.detail.toLowerCase()).toContain('fifa')
  })

  it('every input has a non-empty honest detail and a known source', () => {
    const s = getDataSourceSummary()
    for (const i of s.inputs) {
      expect(i.detail.trim().length).toBeGreaterThan(0)
      expect(['synthetic', 'manual', 'live']).toContain(i.source)
    }
  })

  it('summary is versioned', () => {
    const s = getDataSourceSummary()
    expect(s.version).toBe(MODEL_INPUTS_VERSION)
    expect(s.inputs.length).toBeGreaterThan(0)
  })

  it('providers array is present', () => {
    const s = getDataSourceSummary()
    expect(Array.isArray(s.providers)).toBe(true)
  })
})
