/**
 * agentProfile.test | v1.0.0 | 2026-06-13
 * Purpose: Verify the public profile service shape + secret-free mapping (T26).
 */

import { describe, expect, it } from 'vitest'
import {
  AgentProfileService,
  buildPublicProfile,
  type PublicAgentProfile,
} from '../src/agents/agentProfileService'

const svc = new AgentProfileService()

describe('AgentProfileService registry', () => {
  it('loads all five agents from the bundled config', () => {
    const ids = svc.ids()
    expect(ids).toContain('dr_morgan')
    expect(ids).toContain('scout_alvarez')
    expect(ids).toContain('viktor_kane')
    expect(ids).toContain('sofia_mendes')
    expect(ids).toContain('madame_pythia')
    expect(ids.length).toBe(5)
  })

  it('returns null for an unknown agent', () => {
    expect(svc.get('nobody')).toBeNull()
  })

  it('list() returns one profile per id', () => {
    expect(svc.list().length).toBe(svc.ids().length)
  })
})

describe('formula-based agent (Dr. Morgan)', () => {
  const p = svc.get('dr_morgan') as PublicAgentProfile

  it('exposes identity fields', () => {
    expect(p.name).toBe('Dr. Morgan')
    expect(p.role).toBe('Statistician')
    expect(p.personality.length).toBeGreaterThan(0)
    expect(Array.isArray(p.catchphrases)).toBe(true)
    expect(p.catchphrases.length).toBeGreaterThan(0)
  })

  it('exposes a methodology formula + parameters + evolution trigger', () => {
    expect(p.methodology.type).toBe('weighted_metrics')
    expect(p.methodology.formula).toContain('Score')
    expect(p.methodology.parameters.learning_rate).toBe(0.15)
    expect(p.methodology.evolutionTrigger).toBeTruthy()
    expect(p.methodology.rules).toEqual([])
    expect(p.methodology.description).toBeNull()
  })
})

describe('rule-based mystic agent (Madame Pythia)', () => {
  const p = svc.get('madame_pythia') as PublicAgentProfile

  it('exposes rules + description, no formula', () => {
    expect(p.methodology.type).toBe('deterministic_mysticism')
    expect(p.methodology.formula).toBeNull()
    expect(p.methodology.description).toBeTruthy()
    expect(p.methodology.rules.length).toBeGreaterThan(0)
    for (const r of p.methodology.rules) {
      expect(r.name.length).toBeGreaterThan(0)
      expect(r.logic.length).toBeGreaterThan(0)
      expect(r.effect.length).toBeGreaterThan(0)
    }
  })
})

describe('secret-free mapping', () => {
  it('never leaks roastLines or thoughtBubbles', () => {
    for (const p of svc.list()) {
      const json = JSON.stringify(p)
      expect(json).not.toContain('roastLines')
      expect(json).not.toContain('thoughtBubbles')
      // Ensure the keys are simply absent on the object too
      expect((p as any).roastLines).toBeUndefined()
      expect((p as any).thoughtBubbles).toBeUndefined()
    }
  })
})

describe('buildPublicProfile (pure)', () => {
  it('is defensive against missing fields', () => {
    const p = buildPublicProfile({ id: 'x' })
    expect(p.id).toBe('x')
    expect(p.name).toBe('')
    expect(p.catchphrases).toEqual([])
    expect(p.methodology.type).toBe('unknown')
    expect(p.methodology.formula).toBeNull()
    expect(p.methodology.parameters).toEqual({})
    expect(p.methodology.rules).toEqual([])
  })

  it('maps evolution_trigger (snake) → evolutionTrigger (camel)', () => {
    const p = buildPublicProfile({
      id: 'y',
      methodology: { type: 't', evolution_trigger: 'because' },
    })
    expect(p.methodology.evolutionTrigger).toBe('because')
  })
})
