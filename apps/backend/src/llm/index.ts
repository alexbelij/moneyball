/**
 * llm/index | v1.0.0 | 2026-06-17
 * Purpose: Factory for building an LlmClient from env configuration.
 * T55: chat-design § 1 — provider chain is env-driven, never hardcoded.
 * A provider is only added if its API key is present; otherwise the chain
 * is just [deterministic]. Tests/CI never need a key.
 */

import type { LlmClient } from './types'
import { GroqClient } from './groqClient'
import { GeminiClient } from './geminiClient'
import { DeterministicClient } from './deterministicClient'
import { ChainedLlmClient } from './chainedClient'

export interface LlmEnv {
  LLM_PRIMARY?: string
  LLM_FALLBACK?: string
  GROQ_API_KEY?: string
  GROQ_MODEL?: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  LLM_TIMEOUT_MS?: number
  LLM_MAX_OUTPUT_TOKENS?: number
}

/**
 * Build an LlmClient from environment configuration.
 * The chain always ends with DeterministicClient (never fails).
 */
export function buildLlmClient(llmEnv: LlmEnv): LlmClient {
  const chain: LlmClient[] = []
  const timeoutMs = llmEnv.LLM_TIMEOUT_MS ?? 8000

  // Primary provider.
  const primary = llmEnv.LLM_PRIMARY?.toLowerCase()
  if (primary === 'groq' && llmEnv.GROQ_API_KEY) {
    chain.push(
      new GroqClient({
        apiKey: llmEnv.GROQ_API_KEY,
        model: llmEnv.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        timeoutMs,
      }),
    )
  } else if (primary === 'gemini' && llmEnv.GEMINI_API_KEY) {
    chain.push(
      new GeminiClient({
        apiKey: llmEnv.GEMINI_API_KEY,
        model: llmEnv.GEMINI_MODEL ?? 'gemini-flash-latest',
        timeoutMs,
      }),
    )
  }

  // Fallback provider (only if different from primary and key present).
  const fallback = llmEnv.LLM_FALLBACK?.toLowerCase()
  if (fallback && fallback !== primary) {
    if (fallback === 'groq' && llmEnv.GROQ_API_KEY) {
      chain.push(
        new GroqClient({
          apiKey: llmEnv.GROQ_API_KEY,
          model: llmEnv.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
          timeoutMs,
        }),
      )
    } else if (fallback === 'gemini' && llmEnv.GEMINI_API_KEY) {
      chain.push(
        new GeminiClient({
          apiKey: llmEnv.GEMINI_API_KEY,
          model: llmEnv.GEMINI_MODEL ?? 'gemini-flash-latest',
          timeoutMs,
        }),
      )
    }
  }

  // Always end with deterministic (never fails, no key needed).
  chain.push(new DeterministicClient())

  console.log(
    `[llm] provider chain: ${chain.map((c) => c.constructor.name).join(' → ')}`,
  )

  return new ChainedLlmClient(chain)
}

// Re-export types and key modules for convenience.
export type { LlmClient, LlmRequest, LlmResult, ChatTurn } from './types'
export { buildAgentChatContext, type ContextAssemblerInput } from './contextAssembler'
export { filterTopic } from './topicFilter'
