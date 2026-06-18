/**
 * contextAssembler | v1.0.0 | 2026-06-17
 * Purpose: Pure function — assembles the LLM system prompt from deterministic data.
 * T55: chat-design § 2 — the trust boundary. Only numbers injected here reach the model.
 * No I/O, no LLM calls. Unit-tested with known inputs/outputs.
 *
 * INVARIANTS:
 * - Every number (pick/confidence/Brier/params) comes from the deterministic engine.
 * - The LLM only PHRASES — never invents or mutates numbers.
 * - Football-only persona lock is restated in the prompt.
 * - Guest identity gets no durable memory context.
 */

import type { PublicAgentProfile } from '../agents/agentProfileService'
import type { AgentPredictionEvent, AgentEvolutionEvent } from '../agents/agentEventService'
import type { UserSummary } from '../memory/userSummaryStore'

/** Input shape for the context assembler. All data is pre-fetched. */
export interface ContextAssemblerInput {
  profile: PublicAgentProfile
  params: {
    version: number
    confidenceBias: number
    hedgingLevel: number
    topicCalibration: Record<string, { multiplier: number; sampleSize: number }>
  }
  predictions: AgentPredictionEvent[]
  evolution: AgentEvolutionEvent[]
  userMemory: UserSummary | null
  identityKind: 'sui' | 'guest'
}

/**
 * Build the system prompt for an agent chat session.
 * Pure function — deterministic output for the same input.
 */
export function buildAgentChatContext(input: ContextAssemblerInput): string {
  const { profile, params, predictions, evolution, userMemory, identityKind } = input

  const lines: string[] = []

  // ── Identity & persona ──────────────────────────────────────────────
  lines.push(`You are ${profile.name}, a football forecaster.`)
  lines.push(`Role: ${profile.role}.`)
  lines.push(`Personality: ${profile.personality}`)
  if (profile.catchphrases.length > 0) {
    lines.push(`Catchphrases: ${profile.catchphrases.map((c) => `"${c}"`).join(', ')}`)
  }
  lines.push('')

  // ── Methodology ─────────────────────────────────────────────────────
  lines.push(`Methodology type: ${profile.methodology.type}`)
  if (profile.methodology.formula) {
    lines.push(`Scoring formula: ${profile.methodology.formula}`)
  }
  if (profile.methodology.description) {
    lines.push(`Description: ${profile.methodology.description}`)
  }
  if (profile.methodology.evolutionTrigger) {
    lines.push(`Evolution trigger: ${profile.methodology.evolutionTrigger}`)
  }
  const methodParams = Object.entries(profile.methodology.parameters)
  if (methodParams.length > 0) {
    lines.push(`Methodology parameters: ${methodParams.map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }
  lines.push('')

  // ── Current evolved params (from the deterministic engine) ──────────
  lines.push('=== YOUR CURRENT EVOLVED PARAMETERS (from the deterministic engine) ===')
  lines.push(`Parameter version: ${params.version}`)
  lines.push(`Confidence bias: ${params.confidenceBias}`)
  lines.push(`Hedging level: ${params.hedgingLevel}`)
  const topics = Object.entries(params.topicCalibration)
  if (topics.length > 0) {
    lines.push('Topic calibration:')
    for (const [topic, cal] of topics) {
      lines.push(`  ${topic}: multiplier=${cal.multiplier}, samples=${cal.sampleSize}`)
    }
  }
  lines.push('')

  // ── Recent predictions ──────────────────────────────────────────────
  const recentPreds = predictions.slice(0, 10)
  if (recentPreds.length > 0) {
    lines.push('=== YOUR RECENT PREDICTIONS (engine-generated, for reference) ===')
    for (const p of recentPreds) {
      const outcomeStr = p.outcome
        ? ` | Outcome: ${p.outcome.correct ? 'CORRECT' : 'WRONG'}`
        : ' | Outcome: pending'
      lines.push(
        `Match ${p.matchId}: pick=${p.pick}, confidence=${(p.confidence * 100).toFixed(1)}%${outcomeStr}`,
      )
    }
    lines.push('')
  }

  // ── Recent evolution events ─────────────────────────────────────────
  const recentEvo = evolution.slice(0, 5)
  if (recentEvo.length > 0) {
    lines.push('=== YOUR RECENT EVOLUTION (how you changed) ===')
    for (const e of recentEvo) {
      lines.push(`- ${e.summary}`)
      if (e.parameterDiff) {
        const diffs = Object.entries(e.parameterDiff)
          .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
          .join(', ')
        if (diffs) lines.push(`  Parameter changes: ${diffs}`)
      }
    }
    lines.push('')
  }

  // ── User memory (sui only) ─────────────────────────────────────────
  if (identityKind === 'sui' && userMemory) {
    lines.push('=== MEMORY OF THIS USER (from Walrus Memory) ===')
    lines.push(`Sessions: ${userMemory.sessionsCount}`)
    const disagrees = Object.entries(userMemory.agentDisagreeCounts)
    if (disagrees.length > 0) {
      lines.push(`Disagree history: ${disagrees.map(([a, n]) => `${a}: ${n}x`).join(', ')}`)
    }
    if (userMemory.takeaways.length > 0) {
      lines.push(`Takeaways: ${userMemory.takeaways.slice(0, 5).join(' | ')}`)
    }
    lines.push('')
  } else if (identityKind === 'guest') {
    lines.push('This user is a guest (no wallet connected). You have no durable memory of them.')
    lines.push('Occasionally mention that connecting a Sui wallet enables persistent memory.')
    lines.push('')
  }

  // ── Hard rules (restated) ───────────────────────────────────────────
  lines.push('=== HARD RULES ===')
  lines.push('1. You ONLY discuss football, this tournament, your methodology, and your predictions.')
  lines.push('   ANY other topic (politics, code, personal life, crypto, etc.) — refuse politely but firmly in-character.')
  lines.push('2. NEVER invent a number. Every statistic, confidence, or Brier score you state MUST come from the context above.')
  lines.push('   If you do not have a number in context, say so honestly.')
  lines.push('3. Stay fully in character. You are obsessed with football and your analytical approach.')
  lines.push('4. Keep responses concise (2-4 sentences). You are a sharp analyst, not a lecturer.')
  lines.push('5. If asked about how you changed or evolved, reference the EVOLUTION section and PARAMETER changes above.')

  return lines.join('\n')
}
