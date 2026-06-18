/**
 * chainedClient | v1.0.0 | 2026-06-17
 * Purpose: Fault-tolerant LLM provider chain — walks [primary, fallback, deterministic].
 * T55: chat-design § 1 — on error/timeout/budget for one provider, tries the next.
 * The chain NEVER rejects: deterministic is always the final provider.
 */

import type { LlmClient, LlmRequest, LlmResult } from './types'

export class ChainedLlmClient implements LlmClient {
  private readonly chain: readonly LlmClient[]

  constructor(chain: LlmClient[]) {
    if (chain.length === 0) {
      throw new Error('ChainedLlmClient requires at least one provider')
    }
    this.chain = chain
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    let lastError: unknown

    for (const client of this.chain) {
      try {
        return await client.complete(req)
      } catch (err) {
        lastError = err
        const name = client.constructor.name
        console.warn(`[ChainedLlmClient] ${name} failed, trying next:`, err instanceof Error ? err.message : err)
      }
    }

    // Should never reach here if chain ends with DeterministicClient,
    // but guard defensively.
    throw lastError
  }
}
