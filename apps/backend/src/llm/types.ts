/**
 * llm/types | v1.0.0 | 2026-06-17
 * Purpose: Provider-agnostic LLM interface types.
 * T55: chat-design § 1 — LlmClient interface + supporting shapes.
 */

/** A single turn in the conversation history. */
export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Request sent to an LlmClient. */
export interface LlmRequest {
  /** Assembled persona + deterministic context (system prompt). */
  system: string
  /** Prior user/assistant turns (session-trimmed, client-held). */
  messages: ChatTurn[]
  /** Maximum output tokens for the response. */
  maxTokens: number
  /** Sampling temperature (0 = deterministic, 1 = creative). */
  temperature?: number
}

/** Result returned from an LlmClient. */
export interface LlmResult {
  text: string
  provider: 'groq' | 'gemini' | 'cerebras' | 'deterministic'
  usage?: { inputTokens?: number; outputTokens?: number }
}

/** Provider-agnostic LLM client interface. */
export interface LlmClient {
  complete(req: LlmRequest): Promise<LlmResult>
}
