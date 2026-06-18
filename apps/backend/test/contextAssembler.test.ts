/**
 * contextAssembler.test | T55 | 2026-06-17
 * Tests: buildAgentChatContext — pure function, verifiable output.
 */

import { describe, it, expect } from 'vitest'
import { buildAgentChatContext, type ContextAssemblerInput } from '../src/llm/contextAssembler'

const baseProfile = {
  id: 'dr_morgan',
  name: 'Dr. Morgan',
  role: 'Statistician',
  personality: 'Cold, pedantic, trusts only verifiable data.',
  catchphrases: ['Probabilities don\'t lie.', 'Numbers see the truth.'],
  methodology: {
    type: 'weighted_metrics',
    formula: 'Score = (Home_xG * 0.4) + (Away_xG_Reverse * 0.3)',
    description: null,
    parameters: { error_threshold: 1.5, learning_rate: 0.15 },
    evolutionTrigger: 'If xG deviates by >1.5, increase injury weight.',
    rules: [],
  },
}

const baseParams = {
  version: 3,
  confidenceBias: 0.05,
  hedgingLevel: 0.4,
  topicCalibration: {
    'group-A': { multiplier: 1.1, sampleSize: 5 },
  },
}

const basePredictions = [
  {
    schemaVersion: '1.0' as const,
    type: 'prediction' as const,
    agentId: 'dr_morgan',
    createdAt: '2026-06-15T10:00:00Z',
    matchId: 'WC26:BRA-ARG',
    pick: 'Brazil',
    confidence: 0.72,
    reasoning: 'xG favours Brazil at home.',
    outcome: { correct: true, resolvedAt: '2026-06-15T22:00:00Z' },
  },
]

const baseEvolution = [
  {
    schemaVersion: '1.0' as const,
    type: 'evolution' as const,
    agentId: 'dr_morgan',
    createdAt: '2026-06-14T08:00:00Z',
    summary: 'Increased defensive injury weight after misprediction.',
    parameterDiff: { confidenceBias: 0.02 },
  },
]

const suiMemory = {
  schemaVersion: '1.0' as const,
  guestId: 'sui:0xabc',
  updatedAt: '2026-06-16T12:00:00Z',
  sessionsCount: 5,
  agentDisagreeCounts: { dr_morgan: 3, scout_alvarez: 1 },
  takeaways: ['Pattern detected: you keep disagreeing with dr_morgan.'],
}

function buildInput(overrides: Partial<ContextAssemblerInput> = {}): ContextAssemblerInput {
  return {
    profile: baseProfile,
    params: baseParams,
    predictions: basePredictions,
    evolution: baseEvolution,
    userMemory: null,
    identityKind: 'guest',
    ...overrides,
  }
}

describe('buildAgentChatContext', () => {
  it('includes agent identity and personality', () => {
    const ctx = buildAgentChatContext(buildInput())
    expect(ctx).toContain('You are Dr. Morgan')
    expect(ctx).toContain('Statistician')
    expect(ctx).toContain('Cold, pedantic')
  })

  it('includes catchphrases', () => {
    const ctx = buildAgentChatContext(buildInput())
    expect(ctx).toContain('"Probabilities don\'t lie."')
    expect(ctx).toContain('"Numbers see the truth."')
  })

  it('includes methodology formula and parameters', () => {
    const ctx = buildAgentChatContext(buildInput())
    expect(ctx).toContain('Score = (Home_xG * 0.4)')
    expect(ctx).toContain('error_threshold=1.5')
    expect(ctx).toContain('learning_rate=0.15')
  })

  it('includes current evolved params (engine numbers)', () => {
    const ctx = buildAgentChatContext(buildInput())
    expect(ctx).toContain('Parameter version: 3')
    expect(ctx).toContain('Confidence bias: 0.05')
    expect(ctx).toContain('Hedging level: 0.4')
    expect(ctx).toContain('group-A: multiplier=1.1, samples=5')
  })

  it('includes recent predictions with outcomes', () => {
    const ctx = buildAgentChatContext(buildInput())
    expect(ctx).toContain('Match WC26:BRA-ARG')
    expect(ctx).toContain('pick=Brazil')
    expect(ctx).toContain('confidence=72.0%')
    expect(ctx).toContain('CORRECT')
  })

  it('includes evolution events', () => {
    const ctx = buildAgentChatContext(buildInput())
    expect(ctx).toContain('Increased defensive injury weight')
    expect(ctx).toContain('confidenceBias: +0.02')
  })

  it('includes user memory for sui identity', () => {
    const ctx = buildAgentChatContext(buildInput({
      identityKind: 'sui',
      userMemory: suiMemory,
    }))
    expect(ctx).toContain('MEMORY OF THIS USER')
    expect(ctx).toContain('Sessions: 5')
    expect(ctx).toContain('dr_morgan: 3x')
    expect(ctx).toContain('Pattern detected')
  })

  it('omits durable memory for guest identity', () => {
    const ctx = buildAgentChatContext(buildInput({
      identityKind: 'guest',
      userMemory: null,
    }))
    expect(ctx).toContain('guest (no wallet connected)')
    expect(ctx).toContain('connecting a Sui wallet')
    expect(ctx).not.toContain('MEMORY OF THIS USER')
  })

  it('includes hard rules (football-only, no invented numbers)', () => {
    const ctx = buildAgentChatContext(buildInput())
    expect(ctx).toContain('HARD RULES')
    expect(ctx).toContain('ONLY discuss football')
    expect(ctx).toContain('NEVER invent a number')
  })

  it('is deterministic (same input → same output)', () => {
    const input = buildInput()
    const ctx1 = buildAgentChatContext(input)
    const ctx2 = buildAgentChatContext(input)
    expect(ctx1).toBe(ctx2)
  })
})
