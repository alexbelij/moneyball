/**
 * deterministicClient | v1.0.0 | 2026-06-17
 * Purpose: Final-fallback LLM client — never fails, never needs a key.
 * T55: chat-design § 1 — returns in-persona canned lines built from
 * catchphrases and deterministic context. Used when all LLM providers fail
 * AND as the default when no keys are configured (CI/test safe).
 *
 * The response is built from the agent's catchphrases injected into the system
 * prompt, plus a handful of generic football fallbacks. Selection is
 * deterministic per (message hash) so the same input always yields the same line.
 */

import type { LlmClient, LlmRequest, LlmResult } from './types'
import { hashString } from '../agents/agentPersonaService'

/** Generic in-persona fallbacks when no catchphrases are available. */
const GENERIC_LINES: readonly string[] = [
  'Interesting question. My analysis says the numbers will do the talking on the pitch.',
  'I appreciate the thought, but I trust my methodology more than hunches.',
  'The beautiful game has a way of proving everyone wrong. Except my model.',
  'Every match is a new data point. Let me crunch a few more before I commit.',
  'My confidence levels are recalibrating as we speak. Check back after the next round.',
  'Football is the only language I speak fluently. And the data agrees.',
]

/**
 * Attempt to extract catchphrases from the system prompt. The context
 * assembler injects them after "Catchphrases:" — we grab the first few
 * quoted strings. Falls back to GENERIC_LINES.
 */
function extractCatchphrases(system: string): string[] {
  const catchIdx = system.indexOf('Catchphrases:')
  if (catchIdx === -1) return []

  // Grab up to 500 chars after "Catchphrases:" and pick quoted strings.
  const slice = system.slice(catchIdx, catchIdx + 500)
  const matches = slice.match(/"([^"]+)"/g)
  if (!matches || matches.length === 0) return []

  return matches.map((m) => m.replace(/^"|"$/g, ''))
}

export class DeterministicClient implements LlmClient {
  async complete(req: LlmRequest): Promise<LlmResult> {
    const catchphrases = extractCatchphrases(req.system)
    const pool = catchphrases.length > 0 ? catchphrases : [...GENERIC_LINES]

    // Deterministic selection based on the last user message.
    const lastUserMsg = [...req.messages].reverse().find((m) => m.role === 'user')
    const seed = lastUserMsg?.content ?? 'fallback'
    const idx = hashString(seed) % pool.length
    const text = pool[idx]

    return { text, provider: 'deterministic' }
  }
}
